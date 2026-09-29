/**
 * Webhook Router — Issue #291
 *
 * Endpoints:
 *   POST   /api/webhooks             — register a webhook endpoint
 *   GET    /api/webhooks             — list all registered webhooks
 *   GET    /api/webhooks/:id         — get a single webhook
 *   PATCH  /api/webhooks/:id         — update url / secret / event_types
 *   DELETE /api/webhooks/:id         — delete a webhook
 *   GET    /api/webhooks/:id/deliveries — delivery log
 *   POST   /api/webhooks/verify      — verify HMAC signature (utility)
 *
 * All state is persisted in PostgreSQL via webhookService.ts.
 * Events are signed with X-Aura-Signature (HMAC-SHA256).
 */

import crypto from "crypto";
import { Router, Request, Response } from "express";
import {
  createWebhook,
  getWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  getDeliveries,
  signPayload,
  dispatchWebhookEvent,
  type VaultEventType,
} from "./services/webhookService.js";
import { successResponse, errorResponse } from "./dto/index.js";
import { logger } from "./logger.js";

export { signPayload, dispatchWebhookEvent };
// ── Types ────────────────────────────────────────────────────────────────────
export type EventType =
  | "deposit"
  | "withdraw"
  | "harvest"
  | "pause"
  | "unpause"
  | "vault.paused"
  | "vault.unpaused"
  | "upgrade"
  | "suspicious";
export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: EventType[];        // empty = subscribe to all
  createdAt: string;
}
export interface WebhookEvent {
  type: EventType;
  payload: Record<string, unknown>;
export interface DeliveryRecord {
  endpointId: string;
  eventId: string;
  status: "pending" | "success" | "failed";
  attempts: number;
  nextRetryAt: string | null;
  lastStatusCode: number | null;
  updatedAt: string;
// ── In-memory stores ─────────────────────────────────────────────────────────
const endpoints = new Map<string, WebhookEndpoint>();
const events    = new Map<string, WebhookEvent>();
const deliveries = new Map<string, DeliveryRecord>();
// Per-endpoint rate limiter: max 100 dispatches per 60 s
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT  = 100;
const RATE_WINDOW = 60_000;
// ── Helpers ──────────────────────────────────────────────────────────────────
export function sign(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
function isRateLimited(endpointId: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(endpointId);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW };
    rateBuckets.set(endpointId, bucket);
  }
  if (bucket.count >= RATE_LIMIT) return true;
  bucket.count++;
  return false;
// ── Delivery with exponential backoff (retries for 24 h) ─────────────────────
const MAX_RETRY_MS = 24 * 60 * 60 * 1000;
// Delays: 10 s, 30 s, 1 m, 5 m, 15 m, 1 h, 3 h, 6 h → covers 24 h window
const BACKOFF_MS = [10_000, 30_000, 60_000, 300_000, 900_000, 3_600_000, 10_800_000, 21_600_000];
async function attemptDelivery(delivery: DeliveryRecord, endpoint: WebhookEndpoint, event: WebhookEvent): Promise<void> {
  if (isRateLimited(endpoint.id)) {
    // Re-queue after current rate-limit window resets
    const bucket = rateBuckets.get(endpoint.id)!;
    delivery.nextRetryAt = new Date(bucket.resetAt).toISOString();
    delivery.updatedAt   = new Date().toISOString();
    scheduleRetry(delivery, endpoint, event, bucket.resetAt - Date.now());
    return;
  const body = JSON.stringify({ id: event.id, type: event.type, payload: event.payload, createdAt: event.createdAt });
  delivery.attempts++;
  delivery.updatedAt = new Date().toISOString();
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aura-Signature": sign(endpoint.secret, body),
        "X-Aura-Event": event.type,
        "X-Aura-Delivery": delivery.id,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    delivery.lastStatusCode = res.status;
    if (res.ok) {
      delivery.status      = "success";
      delivery.nextRetryAt = null;
    } else {
      scheduleNextRetry(delivery, endpoint, event);
    }
  } catch {
    delivery.lastStatusCode = null;
    scheduleNextRetry(delivery, endpoint, event);
function scheduleNextRetry(delivery: DeliveryRecord, endpoint: WebhookEndpoint, event: WebhookEvent): void {
  const isPauseEvent = event.type === "vault.paused" || event.type === "vault.unpaused";
  if (isPauseEvent && delivery.attempts >= 4) {
    delivery.status = "failed";
    delivery.nextRetryAt = null;
  const delay = isPauseEvent
    ? 1_000 * 2 ** (delivery.attempts - 1)
    : BACKOFF_MS[Math.min(delivery.attempts - 1, BACKOFF_MS.length - 1)];
  const createdAt = new Date(delivery.createdAt).getTime();
  if (Date.now() + delay - createdAt > MAX_RETRY_MS) {
    delivery.status      = "failed";
  scheduleRetry(delivery, endpoint, event, delay);
function scheduleRetry(delivery: DeliveryRecord, endpoint: WebhookEndpoint, event: WebhookEvent, delayMs: number): void {
  delivery.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
  setTimeout(() => attemptDelivery(delivery, endpoint, event), delayMs);
// ── Public dispatch API ───────────────────────────────────────────────────────
export function dispatchEvent(type: EventType, payload: Record<string, unknown>): WebhookEvent {
  const event: WebhookEvent = { id: uuidv4(), type, payload, createdAt: new Date().toISOString() };
  events.set(event.id, event);
  for (const endpoint of endpoints.values()) {
    if (endpoint.events.length > 0 && !endpoint.events.includes(type)) continue;
    const delivery: DeliveryRecord = {
      id:             uuidv4(),
      endpointId:     endpoint.id,
      eventId:        event.id,
      status:         "pending",
      attempts:       0,
      nextRetryAt:    null,
      lastStatusCode: null,
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
    };
    deliveries.set(delivery.id, delivery);
    // fire-and-forget
    attemptDelivery(delivery, endpoint, event);
  return event;
// ── REST router ───────────────────────────────────────────────────────────────

export const webhookRouter = Router();

// ── POST /api/webhooks — register endpoint ────────────────────────────────────

webhookRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { url, secret, events: eventTypes = [] } = req.body as {
    url?: string;
    secret?: string;
    events?: VaultEventType[];
  };

  if (!url || !secret) {
    res.status(400).json(errorResponse("MISSING_FIELDS", "url and secret are required"));
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json(errorResponse("INVALID_URL", "url must be a valid HTTP/HTTPS URL"));
    return;
  }

  try {
    const webhook = await createWebhook({ url, secret, eventTypes });
    res.status(201).json(successResponse(webhook));
  } catch (err) {
    logger.error({ err }, "[webhooks] Failed to register webhook");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to register webhook"));
  }
});

// ── GET /api/webhooks — list endpoints ───────────────────────────────────────

webhookRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const webhooks = await listWebhooks();
    res.json(successResponse(webhooks));
  } catch (err) {
    logger.error({ err }, "[webhooks] Failed to list webhooks");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to list webhooks"));
  }
});

// ── GET /api/webhooks/:id — get single endpoint ───────────────────────────────

webhookRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const webhook = await getWebhook(id);
    if (!webhook) {
      res.status(404).json(errorResponse("NOT_FOUND", "Webhook not found"));
      return;
    }
    res.json(successResponse(webhook));
  } catch (err) {
    logger.error({ err, id }, "[webhooks] Failed to get webhook");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to get webhook"));
  }
});

// ── PATCH /api/webhooks/:id — update endpoint ─────────────────────────────────

webhookRouter.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { url, secret, events: eventTypes } = req.body as {
    url?: string;
    secret?: string;
    events?: VaultEventType[];
  };

  if (url) {
    try {
      new URL(url);
    } catch {
      res.status(400).json(errorResponse("INVALID_URL", "url must be a valid HTTP/HTTPS URL"));
      return;
    }
  }

  try {
    const webhook = await updateWebhook(id, { url, secret, eventTypes });
    if (!webhook) {
      res.status(404).json(errorResponse("NOT_FOUND", "Webhook not found"));
      return;
    }
    res.json(successResponse(webhook));
  } catch (err) {
    logger.error({ err, id }, "[webhooks] Failed to update webhook");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to update webhook"));
  }
});

// ── DELETE /api/webhooks/:id — delete endpoint ───────────────────────────────

webhookRouter.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const deleted = await deleteWebhook(id);
    if (!deleted) {
      res.status(404).json(errorResponse("NOT_FOUND", "Webhook not found"));
      return;
    }
    res.status(204).send();
  } catch (err) {
    logger.error({ err, id }, "[webhooks] Failed to delete webhook");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to delete webhook"));
  }
});

// ── GET /api/webhooks/:id/deliveries — delivery log ───────────────────────────

webhookRouter.get("/:id/deliveries", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const webhook = await getWebhook(id);
    if (!webhook) {
      res.status(404).json(errorResponse("NOT_FOUND", "Webhook not found"));
      return;
    }
    const deliveries = await getDeliveries(id);
    res.json(successResponse(deliveries));
  } catch (err) {
    logger.error({ err, id }, "[webhooks] Failed to get deliveries");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to get delivery log"));
  }
});

// ── POST /api/webhooks/verify — signature verification utility ─────────────────

webhookRouter.post("/verify", (req: Request, res: Response): void => {
  const { secret, body, signature } = req.body as {
    secret?: string;
    body?: string;
    signature?: string;
  };
  if (!secret || !body || !signature) {
    res.status(400).json(errorResponse("MISSING_FIELDS", "secret, body, and signature are required"));
    return;
  }
  const expected = signPayload(secret, body);
  const valid = crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
  res.json(successResponse({ valid }));
});
