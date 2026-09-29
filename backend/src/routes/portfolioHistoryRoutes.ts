/**
 * Portfolio History Routes — Issue #290
 *
 * GET /api/portfolio/:address/history
 *
 * Returns a paginated list of vault events (deposit / withdraw / harvest)
 * for a given Stellar wallet address.
 *
 * Query parameters:
 *   page      — 1-based page number (default: 1)
 *   pageSize  — items per page, max 100 (default: 20)
 *   type      — filter by event type: deposit | withdraw | harvest
 *   dateFrom  — ISO-8601 lower bound (inclusive)
 *   dateTo    — ISO-8601 upper bound (inclusive)
 *
 * Response envelope follows the project standard (paginatedResponse).
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { paginatedResponse, errorResponse } from "../dto/index.js";
import {
  getPortfolioHistory,
  type VaultEventType,
} from "../services/portfolioHistoryService.js";
import { logger } from "../logger.js";

export const portfolioHistoryRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema for query parameters
// ─────────────────────────────────────────────────────────────────────────────

const historyQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  type: z
    .enum(["deposit", "withdraw", "harvest"])
    .optional(),
  dateFrom: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), {
      message: "dateFrom must be a valid ISO-8601 date",
    }),
  dateTo: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), {
      message: "dateTo must be a valid ISO-8601 date",
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Stellar address format validation (basic — 56-character G… address)
// ─────────────────────────────────────────────────────────────────────────────

function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portfolio/:address/history
// ─────────────────────────────────────────────────────────────────────────────

portfolioHistoryRouter.get(
  "/:address/history",
  async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params as { address: string };

    // Validate address format to prevent injection vectors
    if (!isValidStellarAddress(address)) {
      res
        .status(400)
        .json(
          errorResponse(
            "INVALID_ADDRESS",
            "address must be a valid Stellar public key (56-character G… address)",
          ),
        );
      return;
    }

    // Validate and parse query parameters via Zod
    const queryResult = historyQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const firstIssue = queryResult.error.issues[0];
      res.status(400).json(
        errorResponse(
          "VALIDATION_ERROR",
          `Invalid query parameter: ${firstIssue?.path.join(".") ?? "unknown"} — ${firstIssue?.message ?? "invalid"}`,
          queryResult.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        ),
      );
      return;
    }

    const { page, pageSize, type, dateFrom, dateTo } = queryResult.data;

    try {
      const result = await getPortfolioHistory(address, {
        page,
        pageSize,
        type: type as VaultEventType | undefined,
        dateFrom,
        dateTo,
      });

      res.json(
        paginatedResponse(result.items, result.page, result.pageSize, result.total),
      );
    } catch (err) {
      logger.error({ err, address }, "[portfolio/history] Failed to fetch history");
      res
        .status(500)
        .json(errorResponse("INTERNAL_ERROR", "Failed to retrieve portfolio history"));
    }
  },
);
