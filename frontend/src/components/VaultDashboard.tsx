"use client";

import useSWR from "swr";
import { RefreshCw, TrendingUp, Users, DollarSign, Percent, AlertCircle } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface VaultStats {
  totalAssets: string;       // raw integer string (stroops or token units)
  totalShares: string;       // raw integer string
  totalDepositors: number;
  apy7d: number;             // basis points, e.g. 850 = 8.50%
  sharePriceBps: number;     // price per share × 10000
}

// ── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchVaultStats(): Promise<VaultStats> {
  const [assetsRes, statsRes] = await Promise.all([
    fetch("/api/vault/total_assets"),
    fetch("/api/vault/stats"),
  ]);

  const assets = assetsRes.ok ? await assetsRes.json() : {};
  const stats = statsRes.ok ? await statsRes.json() : {};

  const totalAssets = assets.total ?? stats.totalAssets ?? "0";
  const totalShares = stats.totalShares ?? "1";
  const totalDepositors = stats.totalDepositors ?? stats.depositors ?? 0;
  const apy7d = stats.apy7d ?? stats.apy ?? 0;

  // Share price = totalAssets / totalShares × 10000 (bps for display)
  let sharePriceBps = 10000;
  try {
    const a = BigInt(totalAssets);
    const s = BigInt(totalShares);
    if (s > 0n) sharePriceBps = Number((a * 10000n) / s);
  } catch {
    /* ignore BigInt parse failures */
  }

  return { totalAssets, totalShares, totalDepositors, apy7d, sharePriceBps };
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-3"
      aria-busy="true"
      aria-label="Loading stat"
    >
      <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
      <div className="h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
      <div className="h-3 w-16 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  tooltip?: string;
}

function StatCard({ label, value, icon, sub, tooltip }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      </div>

      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50">
          {value}
        </p>
        {tooltip && (
          <span className="group relative mb-0.5 cursor-default text-zinc-400 hover:text-zinc-600">
            <span aria-hidden="true" className="text-xs">ⓘ</span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-zinc-800 dark:bg-zinc-200 px-3 py-2 text-xs text-white dark:text-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
            >
              {tooltip}
            </span>
          </span>
        )}
      </div>

      {sub && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
      )}
    </div>
  );
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatAssets(raw: string): string {
  try {
    const n = BigInt(raw);
    // Assume 7 decimal places (Stellar native)
    const whole = n / 10_000_000n;
    const frac = n % 10_000_000n;
    if (whole >= 1_000_000n) {
      return `${(Number(whole) / 1_000_000).toFixed(2)}M`;
    }
    if (whole >= 1_000n) {
      return `${(Number(whole) / 1_000).toFixed(2)}K`;
    }
    const fracStr = frac.toString().padStart(7, "0").slice(0, 2);
    return `${whole}.${fracStr}`;
  } catch {
    return raw === "0" ? "0.00" : raw;
  }
}

function formatApy(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatSharePrice(bps: number): string {
  return (bps / 10000).toFixed(4);
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function VaultDashboard() {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<VaultStats>("vault-stats", fetchVaultStats, {
    refreshInterval: 30_000,  // auto-refresh every 30 seconds
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <section
        aria-label="Vault Dashboard"
        className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 flex flex-col items-center gap-4 text-center"
        data-cy="vault-dashboard-error"
      >
        <AlertCircle className="text-red-500" size={32} aria-hidden="true" />
        <div>
          <p className="font-semibold text-red-700 dark:text-red-400">
            Failed to load vault data
          </p>
          <p className="text-sm text-red-600 dark:text-red-500 mt-1">
            {error?.message ?? "Unknown error"}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          aria-label="Retry loading vault data"
          data-cy="retry-btn"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      </section>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section
        aria-label="Vault Dashboard loading"
        aria-busy="true"
        className="w-full"
        data-cy="vault-dashboard-skeleton"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-36 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────
  const stats = data!;

  return (
    <section
      aria-label="Vault Dashboard"
      className="w-full"
      data-cy="vault-dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Vault Overview
        </h2>
        <button
          onClick={() => mutate()}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          aria-label="Refresh vault stats"
          data-cy="refresh-stats-btn"
        >
          <RefreshCw size={12} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Stat cards — stacks vertically on mobile, 4-column on large screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Assets"
          value={formatAssets(stats.totalAssets)}
          icon={<DollarSign size={16} />}
          sub="Underlying tokens in vault"
          data-cy="stat-total-assets"
        />

        <StatCard
          label="Share Price"
          value={formatSharePrice(stats.sharePriceBps)}
          icon={<TrendingUp size={16} />}
          sub="Assets per share"
          data-cy="stat-share-price"
        />

        <StatCard
          label="7-Day APY"
          value={formatApy(stats.apy7d)}
          icon={<Percent size={16} />}
          sub="Annualised from last 7 days"
          tooltip="APY is estimated by comparing vault asset growth over the last 7 days, then annualising: ((assets_now / assets_7d_ago) ^ (365/7) − 1) × 100. Past performance is not a guarantee of future returns."
          data-cy="stat-apy"
        />

        <StatCard
          label="Total Depositors"
          value={stats.totalDepositors.toLocaleString()}
          icon={<Users size={16} />}
          sub="Unique depositor addresses"
          data-cy="stat-depositors"
        />
      </div>

      {/* Auto-refresh notice */}
      <p className="mt-3 text-right text-xs text-zinc-400 dark:text-zinc-600">
        Auto-refreshes every 30 s
      </p>
    </section>
  );
}
