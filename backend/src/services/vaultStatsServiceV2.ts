/**
 * Vault Stats Service — Issue #287
 *
 * Exposes GET /api/v1/vault/stats returning:
 *   { totalAssets, sharePrice, depositorCount, apy7d, apy30d, lastHarvest }
 *
 * Caching strategy:
 *  - 30-second Redis TTL (VAULT_STATS_CACHE_TTL_SECS, default 30)
 *  - Cache key: vault:stats:v1[:<contractId>]
 *  - Cache invalidated programmatically on harvest events
 *  - Falls back to direct on-chain data on Redis miss or error
 *  - Cache-Control: public, max-age=30, s-maxage=30 set on cached responses
 *
 * APY calculation:
 *  - Derived from the apy_snapshots table (7-day and 30-day rolling windows)
 *  - Falls back to 0 if no snapshot data is available
 */

import { getReadPool } from "../db.js";
import { cacheGet, cacheSet, cacheDel } from "../cache.js";
import { logger } from "../logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const VAULT_STATS_CACHE_NS = "vault:stats:v1";
export const VAULT_STATS_CACHE_TTL_SECS =
  parseInt(process.env.VAULT_STATS_CACHE_TTL_SECS ?? "30", 10);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultStats {
  /** Total underlying tokens held by the vault (string to avoid JS float precision loss) */
  totalAssets: string;
  /** Current share price = totalAssets / totalShares (or "1" when vault is empty) */
  sharePrice: string;
  /** Number of unique addresses with a non-zero vault position */
  depositorCount: number;
  /** 7-day annualised percentage yield (0.085 = 8.5%) */
  apy7d: number;
  /** 30-day annualised percentage yield */
  apy30d: number;
  /** ISO-8601 timestamp of the most recent harvest, or null if never harvested */
  lastHarvest: string | null;
}

export interface VaultStatsCacheEntry {
  data: VaultStats;
  cached_at: number; // Unix epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Data layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch live vault stats directly from the database.
 * This is the fallback used on cache miss or Redis failure.
 */
export async function fetchLiveVaultStats(contractId?: string): Promise<VaultStats> {
  const pool = getReadPool();

  // Build the WHERE clause for multi-vault support
  const contractFilter = contractId ? "WHERE contract_id = $1" : "";
  const params: string[] = contractId ? [contractId] : [];

  // Aggregate total_assets, share_price, depositor_count, and last harvest
  // from vault_positions and contract_events tables
  const [statsResult, apyResult] = await Promise.all([
    pool.query<{
      total_assets: string;
      total_shares: string;
      depositor_count: string;
      last_harvest: string | null;
    }>(
      `SELECT
         COALESCE(SUM(vp.underlying_balance), 0)::TEXT AS total_assets,
         COALESCE(SUM(vp.shares), 0)::TEXT             AS total_shares,
         COUNT(DISTINCT vp.wallet_address)::TEXT        AS depositor_count,
         (
           SELECT MAX(ce.ledger_timestamp)
           FROM vault_events ce
           WHERE ce.event_type = 'harvest'
             ${contractId ? "AND ce.contract_id = $1" : ""}
         ) AS last_harvest
       FROM vault_positions vp
       ${contractFilter}`,
      params,
    ),
    // APY from rolling snapshots (7d and 30d)
    pool.query<{ apy7d: string; apy30d: string }>(
      `SELECT
         COALESCE(
           AVG(apy) FILTER (
             WHERE snapshot_time >= NOW() - INTERVAL '7 days'
             ${contractId ? `AND contract_id = $1` : ""}
           ), 0
         )::TEXT AS apy7d,
         COALESCE(
           AVG(apy) FILTER (
             WHERE snapshot_time >= NOW() - INTERVAL '30 days'
             ${contractId ? `AND contract_id = $1` : ""}
           ), 0
         )::TEXT AS apy30d
       FROM apy_snapshots
       ${contractId ? "WHERE contract_id = $1" : ""}`,
      params,
    ),
  ]);

  const row = statsResult.rows[0];
  const apyRow = apyResult.rows[0];

  const totalAssets = row?.total_assets ?? "0";
  const totalShares = row?.total_shares ?? "0";

  const sharePriceNum =
    BigInt(totalShares) > 0n
      ? Number(totalAssets) / Number(totalShares)
      : 1;

  return {
    totalAssets,
    sharePrice: sharePriceNum.toFixed(7),
    depositorCount: parseInt(row?.depositor_count ?? "0", 10),
    apy7d: parseFloat(apyRow?.apy7d ?? "0"),
    apy30d: parseFloat(apyRow?.apy30d ?? "0"),
    lastHarvest: row?.last_harvest
      ? new Date(row.last_harvest).toISOString()
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache-aware public API
// ─────────────────────────────────────────────────────────────────────────────

function cacheKey(contractId?: string): string {
  return contractId ? `current:${contractId}` : "current";
}

/**
 * Fetch vault stats — Redis cache hit path (< 1ms) or DB fallback.
 * Returns { stats, cached, cacheAgeSecs }.
 */
export async function getVaultStats(contractId?: string): Promise<{
  stats: VaultStats;
  cached: boolean;
  cacheAgeSecs: number | null;
}> {
  const key = cacheKey(contractId);

  // Cache hit path
  try {
    const entry = await cacheGet<VaultStatsCacheEntry>(VAULT_STATS_CACHE_NS, key);
    if (entry !== null) {
      const ageMs = Date.now() - entry.cached_at;
      return {
        stats: entry.data,
        cached: true,
        cacheAgeSecs: Math.floor(ageMs / 1000),
      };
    }
  } catch (redisErr) {
    // Redis unavailable — fall through to live fetch
    logger.warn({ redisErr }, "[vaultStats] Redis unavailable, fetching live data");
  }

  // Cache miss — fetch live and populate cache
  const stats = await fetchLiveVaultStats(contractId);
  const entry: VaultStatsCacheEntry = { data: stats, cached_at: Date.now() };

  try {
    await cacheSet(VAULT_STATS_CACHE_NS, key, entry, VAULT_STATS_CACHE_TTL_SECS);
  } catch {
    // Best-effort cache write — do not fail the request
  }

  return { stats, cached: false, cacheAgeSecs: null };
}

/**
 * Invalidate the vault stats cache.
 * Called by harvest event handlers to ensure the next request reflects
 * the new share price immediately.
 */
export async function invalidateVaultStats(contractId?: string): Promise<void> {
  await cacheDel(VAULT_STATS_CACHE_NS, cacheKey(contractId));
}
