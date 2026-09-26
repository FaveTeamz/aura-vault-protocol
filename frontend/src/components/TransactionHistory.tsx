"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

export type TxType = "deposit" | "withdraw" | "harvest" | "all";
export type TxStatus = "confirmed" | "pending" | "failed" | "all";

export interface Transaction {
  hash: string;
  date: string; // ISO-8601
  type: Exclude<TxType, "all">;
  amount: string; // decimal string
  status: Exclude<TxStatus, "all">;
}

export interface TransactionHistoryProps {
  transactions: Transaction[];
  explorerBase?: string; // e.g. "https://stellar.expert/explorer/testnet/tx"
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

type SortField = "date" | "amount" | "status";
type SortDir = "asc" | "desc";

const STATUS_BADGE: Record<Exclude<TxStatus, "all">, string> = {
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  failed:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const TYPE_BADGE: Record<Exclude<TxType, "all">, string> = {
  deposit:  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  withdraw: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  harvest:  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

const DEBOUNCE_MS = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortHash(hash: string) {
  return hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash;
}

function parseAmount(s: string): number {
  return parseFloat(s) || 0;
}

/** Read a query param from a URLSearchParams, falling back to a default. */
function qp(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback;
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransactionHistory({
  transactions,
  explorerBase = "https://stellar.expert/explorer/testnet/tx",
}: TransactionHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Initialize state from URL ────────────────────────────────────────────
  const [typeFilter,   setTypeFilter]   = useState<TxType>(  (qp(searchParams, "type",   "all") as TxType));
  const [statusFilter, setStatusFilter] = useState<TxStatus>((qp(searchParams, "status", "all") as TxStatus));
  const [dateFrom,     setDateFrom]     = useState(qp(searchParams, "from",   ""));
  const [dateTo,       setDateTo]       = useState(qp(searchParams, "to",     ""));
  const [searchRaw,    setSearchRaw]    = useState(qp(searchParams, "q",      ""));
  const [minAmount,    setMinAmount]    = useState(qp(searchParams, "minAmt", ""));
  const [maxAmount,    setMaxAmount]    = useState(qp(searchParams, "maxAmt", ""));

  // Debounced values (300 ms) used for actual filtering
  const search    = useDebounce(searchRaw, DEBOUNCE_MS);
  const minAmt    = useDebounce(minAmount,  DEBOUNCE_MS);
  const maxAmt    = useDebounce(maxAmount,  DEBOUNCE_MS);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  // Pagination
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);
  const [page,     setPage]     = useState(1);

  // ── Sync filter state → URL query params ─────────────────────────────────
  const syncUrl = useCallback(
    (overrides: Record<string, string> = {}) => {
      const state = {
        q:      searchRaw,
        type:   typeFilter,
        status: statusFilter,
        from:   dateFrom,
        to:     dateTo,
        minAmt: minAmount,
        maxAmt: maxAmount,
        ...overrides,
      };
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(state)) {
        if (v && v !== "all") params.set(k, v);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchRaw, typeFilter, statusFilter, dateFrom, dateTo, minAmount, maxAmount, router, pathname]
  );

  // Debounced values that trigger URL sync
  const debouncedSearch    = useDebounce(searchRaw, DEBOUNCE_MS);
  const debouncedMinAmount = useDebounce(minAmount,  DEBOUNCE_MS);
  const debouncedMaxAmount = useDebounce(maxAmount,  DEBOUNCE_MS);
  const prevDebounced = useRef({ debouncedSearch, debouncedMinAmount, debouncedMaxAmount });

  useEffect(() => {
    const prev = prevDebounced.current;
    if (
      prev.debouncedSearch    !== debouncedSearch ||
      prev.debouncedMinAmount !== debouncedMinAmount ||
      prev.debouncedMaxAmount !== debouncedMaxAmount
    ) {
      prevDebounced.current = { debouncedSearch, debouncedMinAmount, debouncedMaxAmount };
      syncUrl({ q: debouncedSearch, minAmt: debouncedMinAmount, maxAmt: debouncedMaxAmount });
    }
  }, [debouncedSearch, debouncedMinAmount, debouncedMaxAmount, syncUrl]);

  // ── Filtering ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const query  = search.trim().toLowerCase();
    const minVal = parseAmount(minAmt);
    const maxVal = parseAmount(maxAmt);
    const hasMin = minAmt.trim() !== "" && !isNaN(minVal);
    const hasMax = maxAmt.trim() !== "" && !isNaN(maxVal);

    return transactions.filter((tx) => {
      if (typeFilter   !== "all" && tx.type   !== typeFilter)   return false;
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo   && tx.date > dateTo + "T23:59:59Z") return false;
      if (query    && !tx.hash.toLowerCase().includes(query)) return false;
      const amt = parseAmount(tx.amount);
      if (hasMin && amt < minVal) return false;
      if (hasMax && amt > maxVal) return false;
      return true;
    });
  }, [transactions, typeFilter, statusFilter, dateFrom, dateTo, search, minAmt, maxAmt]);

  // ── Sorting ─────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date")   cmp = a.date.localeCompare(b.date);
      if (sortField === "amount") cmp = parseAmount(a.amount) - parseAmount(b.amount);
      if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetPage = useCallback(() => setPage(1), []);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    resetPage();
  }

  // ── Check whether any filter is active ──────────────────────────────────
  const hasActiveFilters =
    searchRaw || typeFilter !== "all" || statusFilter !== "all" ||
    dateFrom  || dateTo     || minAmount || maxAmount;

  // ── Clear all filters ────────────────────────────────────────────────────
  function clearFilters() {
    setSearchRaw("");
    setTypeFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setMinAmount("");
    setMaxAmount("");
    resetPage();
    router.replace(pathname, { scroll: false });
  }

  // ── Export CSV ───────────────────────────────────────────────────────────
  function exportCsv() {
    const header = "date,type,amount,status,hash";
    const rows   = sorted.map(
      (tx) => `${tx.date},${tx.type},${tx.amount},${tx.status},${tx.hash}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Column header helper ─────────────────────────────────────────────────
  function ColHeader({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    const arrow  = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th
        scope="col"
        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        onClick={() => toggleSort(field)}
        onKeyDown={(e) => e.key === "Enter" && toggleSort(field)}
        tabIndex={0}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}{arrow}
      </th>
    );
  }

  return (
    <section
      aria-label="Transaction History"
      className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"
    >
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">

        {/* Search by partial tx hash — debounced 300 ms */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-search" className="text-xs text-zinc-500 dark:text-zinc-400">
            Search hash
          </label>
          <input
            id="tx-search"
            type="search"
            placeholder="0xabc…"
            value={searchRaw}
            onChange={(e) => { setSearchRaw(e.target.value); resetPage(); }}
            className="h-9 w-52 rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Type filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-type" className="text-xs text-zinc-500 dark:text-zinc-400">
            Type
          </label>
          <select
            id="tx-type"
            value={typeFilter}
            onChange={(e) => {
              const v = e.target.value as TxType;
              setTypeFilter(v);
              resetPage();
              syncUrl({ type: v });
            }}
            className="h-9 rounded-lg border border-zinc-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="all">All</option>
            <option value="deposit">Deposit</option>
            <option value="withdraw">Withdraw</option>
            <option value="harvest">Harvest</option>
          </select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-status" className="text-xs text-zinc-500 dark:text-zinc-400">
            Status
          </label>
          <select
            id="tx-status"
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value as TxStatus;
              setStatusFilter(v);
              resetPage();
              syncUrl({ status: v });
            }}
            className="h-9 rounded-lg border border-zinc-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Date range — From */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-date-from" className="text-xs text-zinc-500 dark:text-zinc-400">
            From
          </label>
          <input
            id="tx-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              resetPage();
              syncUrl({ from: e.target.value });
            }}
            className="h-9 rounded-lg border border-zinc-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Date range — To */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-date-to" className="text-xs text-zinc-500 dark:text-zinc-400">
            To
          </label>
          <input
            id="tx-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              resetPage();
              syncUrl({ to: e.target.value });
            }}
            className="h-9 rounded-lg border border-zinc-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Min amount — debounced 300 ms */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-min-amount" className="text-xs text-zinc-500 dark:text-zinc-400">
            Min amount
          </label>
          <input
            id="tx-min-amount"
            type="number"
            min="0"
            placeholder="0"
            value={minAmount}
            onChange={(e) => { setMinAmount(e.target.value); resetPage(); }}
            className="h-9 w-28 rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Max amount — debounced 300 ms */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tx-max-amount" className="text-xs text-zinc-500 dark:text-zinc-400">
            Max amount
          </label>
          <input
            id="tx-max-amount"
            type="number"
            min="0"
            placeholder="∞"
            value={maxAmount}
            onChange={(e) => { setMaxAmount(e.target.value); resetPage(); }}
            className="h-9 w-28 rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
        </div>

        {/* Clear all filters button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Clear all filters"
          >
            Clear filters
          </button>
        )}

        {/* Export — pushed to far right */}
        <div className="ml-auto">
          <button
            onClick={exportCsv}
            className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          Showing <strong>{sorted.length}</strong> of <strong>{transactions.length}</strong> transactions
        </p>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800" role="grid">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <ColHeader field="date" label="Date" />
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                Type
              </th>
              <ColHeader field="amount" label="Amount" />
              <ColHeader field="status" label="Status" />
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                Hash
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-zinc-400">
                  No transactions found.
                </td>
              </tr>
            ) : (
              pageRows.map((tx) => (
                <tr
                  key={tx.hash}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 focus-within:bg-zinc-50 dark:focus-within:bg-zinc-800/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-zinc-700 dark:text-zinc-300">
                    {new Date(tx.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[tx.type]}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-zinc-700 dark:text-zinc-300">
                    {tx.amount}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[tx.status]}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <a
                      href={`${explorerBase}/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      aria-label={`View transaction ${tx.hash} on block explorer`}
                    >
                      {shortHash(tx.hash)}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        {/* Result count */}
        <span>
          {sorted.length === 0
            ? "No results"
            : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}`}
        </span>

        {/* Page size picker */}
        <div className="flex items-center gap-2">
          <label htmlFor="tx-page-size" className="text-xs">Rows</label>
          <select
            id="tx-page-size"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value) as PageSizeOption); resetPage(); }}
            className="h-8 rounded border border-zinc-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Page navigation */}
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
            aria-label="First page"
          >«</button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
            aria-label="Previous page"
          >‹</button>
          <span className="px-2">{safePage} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
            aria-label="Next page"
          >›</button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
            aria-label="Last page"
          >»</button>
        </nav>
      </div>
    </section>
  );
}
