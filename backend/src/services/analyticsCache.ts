import {
  cacheHashDel,
  cacheHashFieldDel,
  cacheHashGet,
  cacheHashGetAll,
  cacheHashSet,
  cacheHashSetMany,
  cacheSortedSetGet,
  cacheSortedSetSet,
  cacheDel,
  NS,
  type SortedCacheEntry,
} from "../cache.js";
import { getReadPool } from "../db.js";
import { logger } from "../logger.js";

const LEADERBOARD_KEY = "current";
const LEADERBOARD_TTL_SECONDS = 60;
const ANALYTICS_TTL_SECONDS = 300;

export interface LeaderboardEntry {
  userId: string;
  shareBalance: string;
}

async function refreshLeaderboard(): Promise<LeaderboardEntry[]> {
  const { rows } = await getReadPool().query<{
    user_id: string;
    share_balance: string;
  }>(
    `SELECT user_id::text AS user_id, SUM(amount)::text AS share_balance
       FROM vault_positions
      WHERE deleted_at IS NULL
      GROUP BY user_id
      ORDER BY SUM(amount) DESC
      LIMIT 100`
  );
  const entries: LeaderboardEntry[] = rows.map((row) => ({
    userId: row.user_id,
    shareBalance: row.share_balance,
  }));
  const sorted: SortedCacheEntry[] = entries.map((entry) => ({
    member: JSON.stringify([entry.userId, entry.shareBalance]),
    score: Number(entry.shareBalance),
  }));
  await cacheSortedSetSet(
    NS.ANALYTICS_LEADERBOARD,
    LEADERBOARD_KEY,
    sorted,
    LEADERBOARD_TTL_SECONDS
  );
  return entries;
}

export async function getCachedLeaderboard(): Promise<LeaderboardEntry[]> {
  const cached = await cacheSortedSetGet(
    NS.ANALYTICS_LEADERBOARD,
    LEADERBOARD_KEY
  );
  if (cached !== null) {
    return cached.map(({ member }) => {
      const [userId, shareBalance] = JSON.parse(member) as [string, string];
      return { userId, shareBalance };
    });
  }
  return refreshLeaderboard();
}

export async function getCachedApyHistory<T>(
  contractId: string,
  period: string,
  load: () => Promise<T[]>
): Promise<T[]> {
  const cached = await cacheHashGetAll<T>(NS.ANALYTICS_APY, contractId);
  const prefix = `${period}:`;
  if (cached !== null) {
    const matching = Object.entries(cached)
      .filter(([field]) => field.startsWith(prefix))
      .filter(([field]) => !field.endsWith(":__empty__"))
      .map(([, value]) => value);
    if (matching.length > 0 || cached[`${prefix}__empty__`] !== undefined) {
      return matching;
    }
  }

  const history = await load();
  const fields: Record<string, T | null> = {};
  for (const [index, point] of history.entries()) {
    const value = point as unknown as Record<string, unknown>;
    const timestamp =
      value.snapshot_at ?? value.snapshotAt ?? value.timestamp ?? value.date;
    fields[`${prefix}${timestamp ?? index}`] = point;
  }
  if (history.length === 0) fields[`${prefix}__empty__`] = null;
  await cacheHashSetMany(
    NS.ANALYTICS_APY,
    contractId,
    fields,
    ANALYTICS_TTL_SECONDS
  );
  return history;
}

export interface UserVolume {
  walletAddress: string;
  depositVolume: string;
  completedDeposits: number;
}

export async function getCachedUserVolume(
  walletAddress: string
): Promise<UserVolume> {
  const cacheKey = "wallets";
  const cached = await cacheHashGet<UserVolume>(
    NS.ANALYTICS_USER_VOLUME,
    cacheKey,
    walletAddress
  );
  if (cached !== null) return cached;

  const { rows } = await getReadPool().query<{
    deposit_volume: string;
    completed_deposits: string;
  }>(
    `SELECT COALESCE(SUM(amount::numeric), 0)::text AS deposit_volume,
            COUNT(*)::text AS completed_deposits
       FROM transaction_jobs
      WHERE wallet_address = $1
        AND tx_type = 'deposit'
        AND status = 'completed'
        AND amount ~ '^[0-9]+(\\.[0-9]+)?$'`,
    [walletAddress]
  );
  const result: UserVolume = {
    walletAddress,
    depositVolume: rows[0]?.deposit_volume ?? "0",
    completedDeposits: Number(rows[0]?.completed_deposits ?? 0),
  };
  await cacheHashSet(
    NS.ANALYTICS_USER_VOLUME,
    cacheKey,
    walletAddress,
    result,
    ANALYTICS_TTL_SECONDS
  );
  return result;
}

export async function invalidateAnalyticsCaches(
  walletAddress?: string,
  contractId?: string
): Promise<void> {
  const invalidations: Promise<void>[] = [
    cacheDel(NS.ANALYTICS_LEADERBOARD, LEADERBOARD_KEY),
  ];
  if (contractId) {
    invalidations.push(cacheHashDel(NS.ANALYTICS_APY, contractId));
  }
  if (walletAddress) {
    invalidations.push(
      cacheHashFieldDel(NS.ANALYTICS_USER_VOLUME, "wallets", walletAddress)
    );
  }
  await Promise.all(invalidations);
}

let leaderboardWarmup: ReturnType<typeof setInterval> | null = null;

export function startAnalyticsCacheWarmer(): void {
  if (leaderboardWarmup !== null) return;
  const warm = () => {
    void refreshLeaderboard().catch((err) => {
      logger.warn({ err }, "Leaderboard cache warm-up failed");
    });
  };
  warm();
  leaderboardWarmup = setInterval(warm, LEADERBOARD_TTL_SECONDS * 1000);
}

export function stopAnalyticsCacheWarmer(): void {
  if (leaderboardWarmup !== null) {
    clearInterval(leaderboardWarmup);
    leaderboardWarmup = null;
  }
}