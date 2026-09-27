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
