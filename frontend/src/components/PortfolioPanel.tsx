"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Download, ChevronLeft, ChevronRight, RefreshCw, Wallet } from "lucide-react";
import { useWalletStore } from "@/lib/walletStore";
import CopyButton from "./CopyButton";

// ── Types ──────────────────────────────────────────────────────────────────

interface PortfolioData {
  shareBalance: string;    // raw integer string
  totalAssets: string;     // vault-wide total assets
  totalShares: string;     // vault-wide total shares
}

interface TxEntry {
  id: string;
  type: "deposit" | "withdraw" | "harvest";
  amount: string;
  shares: string;
  timestamp: string;       // ISO string
  txHash: string;
}

const TX_PAGE_SIZE = 10;

// ── Fetchers ───────────────────────────────────────────────────────────────

async function fetchPortfolio(address: string): Promise<PortfolioData> {
  const [balanceRes, assetsRes] = await Promise.all([
    fetch(`/api/vault/balance_of?address=${encodeURIComponent(address)}`),
    fetch("/api/vault/total_assets"),
  ]);

  const balance = balanceRes.ok ? await balanceRes.json() : {};
  const assets = assetsRes.ok ? await assetsRes.json() : {};

  // total_shares may come from either endpoint
  const totalShares =
    balance.totalShares ?? assets.totalShares ?? balance.balance ?? "1";

  return {
    shareBalance: balance.balance ?? "0",
    totalAssets: assets.total ?? assets.totalAssets ?? "0",
    totalShares,
  };
}

async function fetchHistory(address: string): Promise<TxEntry[]> {
  const res = await fetch(
    `/api/vault/history?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.transactions ?? []);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatAmount(raw: string): string {
  try {
    const n = BigInt(raw);
    const whole = n / 10_000_000n;
    const frac = (n % 10_000_000n).toString().padStart(7, "0").slice(0, 2);
    return `${whole}.${frac}`;
  } catch {
    return raw;
  }
}

/** Calculate redemption value: shares × (totalAssets / totalShares) */
function calcRedemptionValue(
  shareBalance: string,
  totalAssets: string,
  totalShares: string
): string {
  try {
    const shares = BigInt(shareBalance);
    const assets = BigInt(totalAssets);
    const supply = BigInt(totalShares);
    if (supply === 0n || shares === 0n) return "0.00";
    const value = (shares * assets) / supply;
    return formatAmount(value.toString());
  } catch {
    return "0.00";
  }
}

function exportTxCsv(txs: TxEntry[], address: string): void {
  const header = "id,type,amount,shares,timestamp,txHash";
  const rows = txs.map(
    (t) => `${t.id},${t.type},${t.amount},${t.shares},${t.timestamp},${t.txHash}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aura-history-${address.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PortfolioPanel() {
  const { address, connected } = useWalletStore();
  const [txPage, setTxPage] = useState(0);

  // Don't render if wallet isn't connected
  if (!connected || !address) {
    return null;
  }

  return <PortfolioPanelInner address={address} txPage={txPage} setTxPage={setTxPage} />;
}

interface InnerProps {
  address: string;
  txPage: number;
  setTxPage: (page: number) => void;
}

function PortfolioPanelInner({ address, txPage, setTxPage }: InnerProps) {
  const portfolioKey = `portfolio-${address}`;
  const historyKey = `history-${address}`;

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    mutate: mutatePortfolio,
  } = useSWR<PortfolioData>(portfolioKey, () => fetchPortfolio(address), {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });

  const {
    data: history = [],
    isLoading: historyLoading,
  } = useSWR<TxEntry[]>(historyKey, () => fetchHistory(address), {
    revalidateOnFocus: false,
  });

  const refresh = useCallback(() => {
    mutatePortfolio();
  }, [mutatePortfolio]);

  const totalPages = Math.ceil(history.length / TX_PAGE_SIZE);
  const pageTxs = history.slice(
    txPage * TX_PAGE_SIZE,
    (txPage + 1) * TX_PAGE_SIZE
  );

  const redemptionValue = portfolio
    ? calcRedemptionValue(
        portfolio.shareBalance,
        portfolio.totalAssets,
        portfolio.totalShares
      )
    : null;

  const hasPosition = portfolio ? BigInt(portfolio.shareBalance || "0") > 0n : false;

  // ── Portfolio error ──────────────────────────────────────────────────────
  if (portfolioError) {
    return (
      <section
        aria-label="Your Portfolio"
        className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5 text-center"
        data-cy="portfolio-error"
      >
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">
          Failed to load portfolio data.
        </p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          aria-label="Retry loading portfolio"
        >
          <RefreshCw size={12} aria-hidden="true" /> Retry
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Your Portfolio"
      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-5"
      data-cy="portfolio-panel"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Wallet size={16} aria-hidden="true" />
          Your Portfolio
        </h2>
        <button
          onClick={refresh}
          disabled={portfolioLoading}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
          aria-label="Refresh portfolio"
          data-cy="portfolio-refresh-btn"
        >
          <RefreshCw size={12} className={portfolioLoading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* ── Position stats ──────────────────────────────────────────────── */}
      {portfolioLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4">
              <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse mb-2" />
              <div className="h-6 w-28 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
            </div>
          ))}
        </div>
      ) : !hasPosition ? (
        /* ── Empty state ────────────────────────────────────────────────── */
        <div
          className="flex flex-col items-center gap-3 py-8 text-center"
          data-cy="portfolio-empty"
        >
          <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-4">
            <Wallet size={24} className="text-zinc-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            No vault position yet
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-xs">
            Deposit into the vault to start earning yield. Your share balance
            and redemption value will appear here.
          </p>
        </div>
      ) : (
        /* ── Position cards ─────────────────────────────────────────────── */
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4">
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Share Balance
            </dt>
            <dd
              data-cy="share-balance"
              className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-50"
            >
              {formatAmount(portfolio!.shareBalance)}
            </dd>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4">
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Current Value
            </dt>
            <dd
              data-cy="redemption-value"
              className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-50"
            >
              {redemptionValue}
            </dd>
            <p className="text-xs text-zinc-400 mt-0.5">shares × (assets/supply)</p>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4">
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Vault Total Assets
            </dt>
            <dd
              data-cy="total-assets-portfolio"
              className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-50"
            >
              {formatAmount(portfolio!.totalAssets)}
            </dd>
          </div>
        </dl>
      )}

      {/* ── Transaction history ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Transaction History
          </h3>
          {history.length > 0 && (
            <button
              onClick={() => exportTxCsv(history, address)}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="Export transaction history as CSV"
              data-cy="export-csv-btn"
            >
              <Download size={12} aria-hidden="true" />
              Export CSV
            </button>
          )}
        </div>

        {historyLoading ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm" aria-label="Transaction history loading">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  {["Type", "Amount", "Shares", "Date", "Tx Hash"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : history.length === 0 ? (
          <p
            className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6"
            data-cy="history-empty"
          >
            No transactions found for this address.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table
                className="w-full text-sm"
                aria-label="Transaction history"
                data-cy="history-table"
              >
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    {["Type", "Amount", "Shares", "Date", "Tx Hash"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pageTxs.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                            tx.type === "deposit"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : tx.type === "withdraw"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          ].join(" ")}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                        {formatAmount(tx.amount)}
                      </td>
                      <td className="px-3 py-3 font-mono text-zinc-700 dark:text-zinc-300">
                        {formatAmount(tx.shares)}
                      </td>
                      <td className="px-3 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <span
                            className="font-mono text-xs text-zinc-500 dark:text-zinc-400"
                            title={tx.txHash}
                          >
                            {truncateHash(tx.txHash)}
                          </span>
                          <CopyButton
                            text={tx.txHash}
                            label="Copy transaction hash"
                            data-cy="copy-tx-hash"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between mt-3 text-sm"
                aria-label="Transaction history pagination"
              >
                <p className="text-xs text-zinc-500">
                  Page {txPage + 1} of {totalPages} ({history.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxPage(Math.max(0, txPage - 1))}
                    disabled={txPage === 0}
                    className="inline-flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                    aria-label="Previous page"
                    data-cy="pagination-prev"
                  >
                    <ChevronLeft size={12} aria-hidden="true" /> Prev
                  </button>
                  <button
                    onClick={() => setTxPage(Math.min(totalPages - 1, txPage + 1))}
                    disabled={txPage >= totalPages - 1}
                    className="inline-flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                    aria-label="Next page"
                    data-cy="pagination-next"
                  >
                    Next <ChevronRight size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
