/**
 * Vault Stats Service — Issue #466
 *
 * Encapsulates the on-chain / data-layer read for vault statistics.
 * In production this would call the Soroban RPC; in tests it is mocked.
 */

export interface VaultStatsData {
  total_assets: number;
  total_shares: number;
  apy: number;             // 0–1, e.g. 0.085 = 8.5%
  last_harvest: string | null; // ISO-8601 or null if never harvested
  /** TVL cap in underlying token units. null when no cap is configured. */
  tvl_cap: number | null;
}

/**
 * Fetch live vault stats from the on-chain contract (or data layer).
 * This function is the single seam that tests mock.
 */
export async function getVaultStats(): Promise<VaultStatsData> {
  // Production implementation would call Soroban RPC here.
  // For now, return a realistic placeholder so the route compiles.
  return {
    total_assets: 0,
    total_shares: 0,
    apy: 0,
    last_harvest: null,
    tvl_cap: null,
  };
}
