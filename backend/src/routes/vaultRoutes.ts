/**
 * Vault Stats Route — Issue #287 + Issue #466 + Issue #310 (multi-tenant)
 *
 * GET /api/v1/vault/stats?vaultId=<id>
 *
 * Returns vault statistics with Redis caching.
 *  - 30-second TTL (configurable via VAULT_STATS_CACHE_TTL_SECS env var)
 *  - Cache-Control headers set on all responses
 *  - Cache invalidated on harvest events
 *  - Falls back to direct DB query on cache miss
 *  - Response shape: { totalAssets, sharePrice, depositorCount, apy7d, apy30d, lastHarvest }
 */

import { Router, Request, Response } from "express";
import { cacheDel } from "../cache.js";
import { getVaultStats as getLegacyVaultStats } from "../services/vaultStatsService.js";
import {
  getVaultStats,
  invalidateVaultStats,
  VAULT_STATS_CACHE_NS,
  VAULT_STATS_CACHE_TTL_SECS,
} from "../services/vaultStatsServiceV2.js";
import { getDbMetrics, getSlowQueryLog, dbMetricsPrometheusText } from "../services/dbMonitor.js";
import { successResponse, errorResponse } from "../dto/index.js";
import { resolveVault } from "../services/vaultRegistryService.js";
import { logger } from "../logger.js";

export const VAULT_STATS_CACHE_KEY = "current";

export const vaultRouter = Router();

/**
 * GET /api/v1/vault/decimals?vaultId=<id>
 * Returns the share decimals precision (e.g. 7 for Stellar standard).
 */
vaultRouter.get("/decimals", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultIdParam = req.query.vaultId as string | undefined;
    const vault = await resolveVault(vaultIdParam).catch(() => null);
    res.json(successResponse({
      decimals: 7,
      symbol: vault?.symbol ?? "AVS",
      name: vault?.name ?? "Aura Vault Share",
      ...(vault?.id && { vault_id: vault.id }),
      ...(vault?.contract_id && { contract_id: vault.contract_id }),
    }));
  } catch (err) {
    console.error("[vault/decimals]", err);
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to retrieve vault decimals"));
  }
});


/**
 * GET /api/v1/vault/stats?vaultId=<id>
 * Serves vault stats from Redis cache (30s TTL) or DB fallback.
 * Sets Cache-Control headers on every response.
 */
vaultRouter.get("/stats", async (req: Request, res: Response): Promise<void> => {
  const fetchedAt = new Date().toISOString();

  let vaultContractId: string | undefined;
  let vaultId: number | undefined;

  try {
    const vaultIdParam = req.query.vaultId as string | undefined;
    const vault = await resolveVault(vaultIdParam);
    if (vaultIdParam && !vault) {
      res.status(404).json(errorResponse("NOT_FOUND", "Vault not found"));
      return;
    }
    vaultContractId = vault?.contract_id;
    vaultId = vault?.id;
  } catch {
    // DB unavailable — continue without vault scoping
  }

  try {
    const { stats, cached, cacheAgeSecs } = await getVaultStats(vaultContractId);

    // Set Cache-Control so CDN and browsers can cache for up to 30 seconds
    res.set(
      "Cache-Control",
      `public, max-age=${VAULT_STATS_CACHE_TTL_SECS}, s-maxage=${VAULT_STATS_CACHE_TTL_SECS}`,
    );

    res.json(
      successResponse({
        ...stats,
        cached,
        cache_age_secs: cacheAgeSecs,
        fetched_at: fetchedAt,
        ...(vaultId && { vault_id: vaultId }),
        ...(vaultContractId && { contract_id: vaultContractId }),
      }),
    );
  } catch (err) {
    logger.error({ err }, "[vault/stats] Failed to retrieve vault stats");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to retrieve vault stats"));
  }
});

/**
 * POST /api/v1/vault/stats/invalidate?vaultId=<id>
 * Purges the vault-stats cache for a specific vault (or default if omitted).
 */
vaultRouter.post("/stats/invalidate", async (req: Request, res: Response): Promise<void> => {
  try {
    const vaultIdParam = req.query.vaultId as string | undefined;
    let contractId: string | undefined;

    if (vaultIdParam) {
      const vault = await resolveVault(vaultIdParam).catch(() => null);
      contractId = vault?.contract_id;
    }

    await invalidateVaultStats(contractId);
    res.json(successResponse({ invalidated: true }));
  } catch (err) {
    logger.error({ err }, "[vault/stats/invalidate] Cache invalidation failed");
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Cache invalidation failed"));
  }
});

/** Programmatic cache invalidation — used by harvest event handlers. */
export async function invalidateVaultStatsCache(contractId?: string): Promise<void> {
  await invalidateVaultStats(contractId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Keeper Harvest Endpoints (permissionless — no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/vault/harvest/estimated
 *
 * Returns an estimated yield amount since the last harvest, derived from
 * the current vault APY and total_assets. This value is suggested to
 * keepers as a default when triggering a harvest.
 *
 * Response:
 *   { estimatedYield: string, lastHarvestAt: string | null, totalAssets: number }
 */
vaultRouter.get("/harvest/estimated", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getVaultStats();

    const lastHarvestAt = stats.last_harvest ? new Date(stats.last_harvest) : null;
    const nowMs = Date.now();
    const elapsedMs = lastHarvestAt ? nowMs - lastHarvestAt.getTime() : 0;

    // Yield estimate: totalAssets * APY * (elapsedTime / 1 year)
    // APY is stored as a decimal (e.g. 0.085 = 8.5%)
    const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
    const estimatedYield =
      stats.total_assets > 0 && elapsedMs > 0
        ? stats.total_assets * stats.apy * (elapsedMs / YEAR_MS)
        : 0;

    res.json(
      successResponse({
        estimatedYield: estimatedYield.toFixed(7),
        lastHarvestAt: stats.last_harvest,
        totalAssets: stats.total_assets,
        totalShares: stats.total_shares,
        elapsedMs,
      })
    );
  } catch (err) {
    logger.error("[vault/harvest/estimated]", err);
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to estimate yield"));
  }
});

/**
 * POST /api/v1/vault/harvest/keeper
 *
 * Permissionless keeper harvest endpoint. Any caller can trigger a harvest
 * by providing a yield amount. No authentication is required — this is by
 * design to enable trust-minimised keeper bots and dashboard users.
 *
 * Body: { yieldAmount: string }  (positive decimal, up to 7 decimal places)
 *
 * Returns the updated share price after the harvest is recorded.
 */
const keeperHarvestLimiter = (() => {
  // Simple in-memory rate limit: max 5 calls per IP per minute
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (bucket && now < bucket.resetAt) {
      if (bucket.count >= 5) {
        res.status(429).json(errorResponse("RATE_LIMITED", "Too many harvest requests. Please wait before trying again."));
        return;
      }
      bucket.count += 1;
    } else {
      buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    }
    next();
  };
})();

vaultRouter.post(
  "/harvest/keeper",
  keeperHarvestLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const raw = req.body?.yieldAmount;

    // Validate yieldAmount: positive decimal string, up to 7 decimal places
    if (typeof raw !== "string" || !/^[0-9]+(\.[0-9]{1,7})?$/.test(raw) || parseFloat(raw) <= 0) {
      res.status(400).json(
        errorResponse("INVALID_YIELD_AMOUNT", "yieldAmount must be a positive number with up to 7 decimal places")
      );
      return;
    }

    const yieldAmount = parseFloat(raw);

    try {
      // Check that the vault has shares before attempting harvest.
      // The on-chain contract returns ZeroShares (error code 8) when total_shares == 0.
      const stats = await getVaultStats();
      if (stats.total_shares === 0) {
        res.status(422).json(
          errorResponse(
            "ZERO_SHARES",
            "Cannot harvest: vault has no depositors (total_shares = 0). Deposit into the vault first."
          )
        );
        return;
      }

      // In production, this would build and submit a Soroban transaction using
      // the server-side keeper keypair. Here we simulate the share price update
      // that a successful harvest produces:
      //   newSharePrice = (totalAssets + yieldAmount) / totalShares
      const newTotalAssets = stats.total_assets + yieldAmount;
      const newSharePrice = newTotalAssets / stats.total_shares;

      // Invalidate the stats cache so the next GET /stats reflects the harvest
      await invalidateVaultStatsCache();

      logger.info("[vault/harvest/keeper] Harvest triggered", {
        yieldAmount,
        totalSharesBefore: stats.total_shares,
        newSharePrice: newSharePrice.toFixed(7),
      });

      res.status(200).json(
        successResponse({
          operation: "harvest",
          yieldAmount: raw,
          newSharePrice: newSharePrice.toFixed(7),
          harvestedAt: new Date().toISOString(),
          totalShares: stats.total_shares,
        })
      );
    } catch (err) {
      logger.error("[vault/harvest/keeper]", err);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Harvest failed. Please try again."));
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Issue #324 — DB Query Performance Monitoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/vault/metrics/db
 * Returns histogram metrics and p99 estimate for each query type.
 */
vaultRouter.get("/metrics/db", async (_req: Request, res: Response): Promise<void> => {
  try {
    const metrics = await getDbMetrics();
    res.json(successResponse({ metrics, generated_at: new Date().toISOString() }));
  } catch (err) {
    logger.error("[vault/metrics/db]", err);
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to retrieve DB metrics"));
  }
});

/**
 * GET /api/v1/vault/metrics/db/slow-log
 * Returns the slow query log (most recent first).
 */
vaultRouter.get("/metrics/db/slow-log", async (_req: Request, res: Response): Promise<void> => {
  try {
    const log = await getSlowQueryLog();
    res.json(successResponse({ slow_queries: log, count: log.length, generated_at: new Date().toISOString() }));
  } catch (err) {
    logger.error("[vault/metrics/db/slow-log]", err);
    res.status(500).json(errorResponse("INTERNAL_ERROR", "Failed to retrieve slow query log"));
  }
});

/**
 * GET /api/v1/vault/metrics/db/prometheus
 * Returns Prometheus text exposition for db_query_duration_seconds histogram.
 */
vaultRouter.get("/metrics/db/prometheus", async (_req: Request, res: Response): Promise<void> => {
  try {
    const text = await dbMetricsPrometheusText();
    res.set("Content-Type", "text/plain; version=0.0.4").send(text);
  } catch (err) {
    logger.error("[vault/metrics/db/prometheus]", err);
    res.status(500).send("# error generating metrics\n");
  }
});
