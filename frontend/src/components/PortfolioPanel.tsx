"use client";

import { PortfolioExportButton } from "@/components/PortfolioExportButton";
import type { ExportTransaction, PortfolioPosition } from "@/lib/portfolioExport";

// ── Demo / mock data ──────────────────────────────────────────────────────────
// Replace with real data from your Soroban RPC / backend API calls.

const DEMO_ADDRESS = "GAURA1234567890EXAMPLEADDRESSXYZ";

const DEMO_POSITION: PortfolioPosition = {
  shares: "998.50",
  underlyingBalance: "1 053.20",
  pricePerShare: "1.0548",
  apy: "8.5",
  yieldEarned: "53.20",
};

const DEMO_TRANSACTIONS: ExportTransaction[] = [
  {
    date: "2024-03-15T10:22:00Z",
    type: "deposit",
    amount: "500.00",
    shares: "500.00",
    txHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
    priceAtTime: "1.0000",
  },
  {
    date: "2024-03-20T14:05:30Z",
    type: "deposit",
    amount: "500.00",
    shares: "498.50",
    txHash: "bcd234efa567bcd234efa567bcd234efa567bcd234efa567bcd234efa567bcd2",
    priceAtTime: "1.0030",
  },
  {
    date: "2024-04-01T08:00:00Z",
    type: "harvest",
    amount: "53.20",
    shares: "0.00",
    txHash: "cde345fgb678cde345fgb678cde345fgb678cde345fgb678cde345fgb678cde3",
    priceAtTime: "1.0548",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * `PortfolioPanel`
 *
 * Displays the user's current vault position summary and provides a CSV / JSON
 * export button for tax-reporting purposes.
 *
 * All file generation is client-side — no server round-trip — per Issue #260.
 */
export default function PortfolioPanel() {
  return (
    <section
      aria-labelledby="portfolio-heading"
      className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div>
        <h2
          id="portfolio-heading"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Portfolio
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your current Aura Vault position and full transaction history.
        </p>
      </div>

      {/* Position stats */}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Shares",            value: DEMO_POSITION.shares },
          { label: "Underlying balance",value: DEMO_POSITION.underlyingBalance },
          { label: "Price / share",     value: DEMO_POSITION.pricePerShare },
          { label: "APY",               value: `${DEMO_POSITION.apy}%` },
          { label: "Yield earned",      value: DEMO_POSITION.yieldEarned },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {label}
            </dt>
            <dd className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Transaction count */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {DEMO_TRANSACTIONS.length} transaction{DEMO_TRANSACTIONS.length !== 1 ? "s" : ""} available for export.
      </p>

      {/* Export */}
      <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Download for tax reporting
        </p>
        <PortfolioExportButton
          walletAddress={DEMO_ADDRESS}
          network="mainnet"
          position={DEMO_POSITION}
          transactions={DEMO_TRANSACTIONS}
        />
      </div>
    </section>
  );
}
