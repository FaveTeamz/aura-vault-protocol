/**
 * Contract Event Stream — Issue #285
 *
 * Server-Sent Events (SSE) endpoint that proxies the Horizon event stream for
 * the configured vault contract ID.  Clients subscribe once and receive
 * real-time deposit / withdraw / harvest / pause events without polling.
 *
 * Route:  GET /api/v1/events/stream
 *
 * Reconnect:
 *   The browser EventSource API reconnects automatically using the
 *   `Last-Event-ID` header that the server sends on every message.
 *   When the underlying Horizon stream errors the server reconnects with
 *   exponential back-off (1 s → 30 s cap) and forwards a `reconnecting`
 *   comment to all connected clients so the UI can show a banner.
 *
 * Fallback:
 *   If HORIZON_URL is not configured or the stream is unavailable, a
 *   `polling-fallback` event is sent so the frontend can switch to
 *   30-second polling.
 */

import { Router, Request, Response } from "express";
import { config } from "../config/index.js";
import { logger } from "../logger.js";

export const eventsRouter = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface SseClient {
  id: string;
  res: Response;
}

// ── In-process fan-out bus ────────────────────────────────────────────────────

const clients = new Map<string, SseClient>();
let clientIdSeq = 0;

/** Broadcast a named SSE event to all connected clients. */
function broadcast(event: string, data: unknown, id?: string): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}${id ? `\nid: ${id}` : ""}\n\n`;
  for (const client of clients.values()) {
    client.res.write(payload);
  }
}

/** Send a comment (keepalive / status) to all clients. */
function broadcastComment(comment: string): void {
  const payload = `: ${comment}\n\n`;
  for (const client of clients.values()) {
    client.res.write(payload);
  }
}

// ── Keepalive timer ───────────────────────────────────────────────────────────

// Send a SSE comment every 20 s so proxies / firewalls don't drop idle connections.
setInterval(() => {
  broadcastComment("keepalive");
}, 20_000);

// ── Horizon stream connection ─────────────────────────────────────────────────

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let horizonStreamReady = false;
let reconnectDelay = RECONNECT_BASE_MS;
let lastEventId: string | null = null;

/**
 * Start (or re-start) the Horizon event stream and pipe events to all SSE
 * clients.  Reconnects automatically on error using exponential back-off.
 */
async function connectHorizonStream(): Promise<void> {
  const { horizonUrl, vaultContractId } = config.stellar;

  if (!horizonUrl || !vaultContractId) {
    logger.warn(
      "[eventsStream] HORIZON_URL or VAULT_CONTRACT_ID not configured — sending polling-fallback"
    );
    broadcast("polling-fallback", {
      message: "Event stream unavailable — use 30-second polling",
      pollIntervalMs: 30_000,
    });
    return;
  }

  const streamUrl = `${horizonUrl}/contracts/${vaultContractId}/events`;
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId;
  }

  logger.info({ streamUrl, lastEventId }, "[eventsStream] connecting to Horizon");

  try {
    const response = await fetch(streamUrl, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Horizon stream returned ${response.status}`);
    }

    horizonStreamReady = true;
    reconnectDelay = RECONNECT_BASE_MS; // reset back-off on success
    broadcastComment("connected");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete last line

      let event = "message";
      let data = "";
      let id = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data += line.slice(5).trim();
        } else if (line.startsWith("id:")) {
          id = line.slice(3).trim();
        } else if (line === "") {
          // dispatch
          if (data) {
            try {
              const parsed = JSON.parse(data);
              if (id) lastEventId = id;
              broadcast(event, parsed, id || undefined);
              logger.debug({ event, id }, "[eventsStream] forwarded event");
            } catch {
              logger.warn({ raw: data }, "[eventsStream] could not parse event data");
            }
          }
          event = "message";
          data = "";
          id = "";
        }
      }
    }
  } catch (err) {
    horizonStreamReady = false;
    logger.error({ err, reconnectDelay }, "[eventsStream] stream error, will reconnect");
    broadcastComment(`reconnecting in ${reconnectDelay}ms`);
  }

  // Schedule reconnect with back-off
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    void connectHorizonStream();
  }, reconnectDelay);
}

// Start the Horizon stream in the background when the module loads.
void connectHorizonStream();

// ── SSE endpoint ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/stream
 *
 * Opens a Server-Sent Events connection.  The client can pass a
 * `Last-Event-ID` header to resume from a specific event.
 *
 * Response headers instruct every caching layer not to buffer this stream.
 */
eventsRouter.get("/stream", (req: Request, res: Response): void => {
  const clientId = String(++clientIdSeq);

  // Honour Last-Event-ID from reconnecting client
  const resumeId = req.headers["last-event-id"];
  if (resumeId && typeof resumeId === "string") {
    lastEventId = resumeId;
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable nginx buffering
  });
  res.flushHeaders();

  // Register client
  clients.set(clientId, { id: clientId, res });
  logger.info({ clientId, total: clients.size }, "[eventsStream] client connected");

  // Send immediate status so the client knows the stream is alive
  res.write(
    `event: status\ndata: ${JSON.stringify({
      connected: true,
      horizonStreamReady,
      clientId,
    })}\n\n`
  );

  // If Horizon stream is not available, send polling-fallback immediately
  if (!horizonStreamReady) {
    res.write(
      `event: polling-fallback\ndata: ${JSON.stringify({
        message: "Horizon stream unavailable — use 30-second polling",
        pollIntervalMs: 30_000,
      })}\n\n`
    );
  }

  // Clean up on client disconnect
  req.on("close", () => {
    clients.delete(clientId);
    logger.info({ clientId, total: clients.size }, "[eventsStream] client disconnected");
  });
});

/**
 * GET /api/v1/events/status
 *
 * Public health endpoint — returns connection counts and Horizon stream state.
 */
eventsRouter.get("/status", (_req: Request, res: Response): void => {
  res.json({
    horizonStreamReady,
    connectedClients: clients.size,
    lastEventId,
    timestamp: new Date().toISOString(),
  });
});
