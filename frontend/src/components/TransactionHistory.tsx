"use client";

import { useState, useEffect, useCallback } from "react";

export type TimeRange = "7d" | "30d" | "90d" | "all";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All Time" },
];

const DEFAULT_RANGE: TimeRange = "30d";
const PREF_KEY = "aura_default_history_range";

/** Load preference from localStorage. Falls back to 30d. */
function loadRangePref(): TimeRange {
  if (typeof window === "undefined") return DEFAULT_RANGE;
  const stored = localStorage.getItem(PREF_KEY) as TimeRange | null;
  return stored && RANGES.some((r) => r.value === stored)
    ? stored
    : DEFAULT_RANGE;
}

/**
 * Persist preference locally and fire-and-forget to
 * PUT /api/users/preferences when an auth token is present.
 */
function saveRangePref(range: TimeRange) {
  localStorage.setItem(PREF_KEY, range);
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("aura_access_token")
      : null;
  if (token) {
    fetch("/api/users/preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ default_history_range: range }),
    }).catch(() => {
      /* best-effort */
    });
  }
}

// ---------------------------------------------------------------------------
// Mock transaction data
// ---------------------------------------------------------------------------
interface Transaction {
  id: string;
  type: "deposit" | "withdraw" | "harvest";
  amount: number;
  symbol: string;
  timestamp: number;
}

const MOCK_TXS: Transaction[] = [
  {
    id: "tx-1",
    type: "deposit",
    amount: 1000,
    symbol: "USDC",
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx-2",
    type: "harvest",
    amount: 12,
    symbol: "USDC",
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx-3",
    type: "withdraw",
    amount: 200,
    symbol: "USDC",
    timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx-4",
    type: "deposit",
    amount: 500,
    symbol: "USDC",
    timestamp: Date.now() - 45 * 24 * 60 * 60 * 1000,
  },
  {
    id: "tx-5",
    type: "harvest",
    amount: 30,
    symbol: "USDC",
    timestamp: Date.now() - 95 * 24 * 60 * 60 * 1000,
  },
];

function filterByRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return txs.filter((tx) => tx.timestamp >= cutoff);
}

const typeStyles: Record<Transaction["type"], string> = {
  deposit:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  withdraw:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  harvest:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TransactionHistory() {
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [mounted, setMounted] = useState(false);

  // Load persisted preference after mount to avoid SSR mismatch
  useEffect(() => {
    setRange(loadRangePref());
    setMounted(true);
  }, []);

  const handleRangeChange = useCallback((next: TimeRange) => {
    setRange(next);
    saveRangePref(next);
  }, []);

  const visible = filterByRange(MOCK_TXS, range);

  if (!mounted) return null;

  return (
    <section
      aria-labelledby="tx-history-heading"
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
    >
      {/* Header with range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 id="tx-history-heading" className="text-base font-semibold">
          Transaction History
        </h2>
        <div className="flex gap-1" role="group" aria-label="Time range filter">
          {RANGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleRangeChange(value)}
              aria-pressed={range === value}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                range === value
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-400">
          No transactions in this time range.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visible.map((tx) => (
            <li key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                  typeStyles[tx.type]
                }`}
              >
                {tx.type}
              </span>
              <span className="flex-1 text-sm font-medium">
                {tx.amount.toLocaleString()} {tx.symbol}
              </span>
              <time
                dateTime={new Date(tx.timestamp).toISOString()}
                className="text-xs text-zinc-400"
              >
                {new Date(tx.timestamp).toLocaleDateString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
