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
