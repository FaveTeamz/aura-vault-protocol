"use client";

/**
 * VaultActions
 *
 * Deposit / Withdraw / Harvest action panel.
 *
 * Pause integration: all action buttons are disabled when the vault is paused.
 * The component accepts an optional `isPaused` prop so the parent can pass down
 * the shared pause state (avoiding duplicate polls). If the prop is omitted the
 * component falls back to its own `useVaultPause` call.
 */

import { useState, useEffect, useCallback } from "react";
import TransactionModal from "./TransactionModal";
import { useVaultPause } from "@/lib/useVaultPause";

type Tab = "deposit" | "withdraw";

export interface VaultActionsProps {
  /**
   * Optional: pass the vault pause state from a parent that already calls
   * `useVaultPause`, so the hook is not duplicated. When omitted the component
   * manages its own pause state.
   */
  isPaused?: boolean | undefined;
}

export default function VaultActions({ isPaused: isPausedProp }: VaultActionsProps = {}) {
  const [tab, setTab] = useState<Tab>("deposit");
  const [modal, setModal] = useState<Tab | null>(null);
  const [balance, setBalance] = useState("1000");

  // Use the passed-in value when available, otherwise poll independently.
  const { isPaused: isPausedLocal } = useVaultPause();
  const isPaused = isPausedProp !== undefined ? isPausedProp : isPausedLocal;

  const paused = isPaused === true;

  const fetchBalance = useCallback(async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/vault/balance_of?address=mock`);
      if (res.ok) {
        const d = await res.json() as { balance?: string };
        if (d?.balance) setBalance(d.balance);
      }
    } catch {
      // Ignore — keep the existing balance
    }
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  function handleModalClose() {
    setModal(null);
  }

  // ── Disabled-button helper ─────────────────────────────────────────────
  // When paused: cursor-not-allowed, reduced opacity, aria-disabled.

  const pausedClasses =
    "opacity-50 cursor-not-allowed pointer-events-none";

  const actionButtonBase =
    "w-full rounded-lg py-2.5 text-sm font-semibold transition-colors";

  const primaryButtonClasses = [
    actionButtonBase,
    "bg-zinc-900 text-white hover:bg-zinc-700",
    "dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300",
    paused ? pausedClasses : "",
  ]
    .join(" ")
    .trim();

  return (
    <section
      className="w-full rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
      aria-label="Vault actions"
    >
      {/* Tabs */}
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Action type">
        <button
          role="tab"
          aria-selected={tab === "deposit"}
          data-cy="deposit-tab"
          onClick={() => setTab("deposit")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === "deposit"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
              : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          }`}
        >
          Deposit
        </button>
        <button
          role="tab"
          aria-selected={tab === "withdraw"}
          data-cy="withdraw-tab"
          onClick={() => setTab("withdraw")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === "withdraw"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
              : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          }`}
        >
          Withdraw
        </button>
      </div>

      <p className="text-sm text-zinc-500 mb-4">
        Balance:{" "}
        <span
          data-cy="vault-balance"
          className="font-mono font-semibold text-zinc-800 dark:text-zinc-200"
        >
          {balance}
        </span>
      </p>

      {/* Pause notice — shown inside the panel in addition to the page-level banner */}
      {paused && (
        <p
          className="mb-3 text-xs font-medium text-red-600 dark:text-red-400"
          aria-live="polite"
        >
          Actions are disabled while the vault is paused.
        </p>
      )}

      {/* Deposit tab */}
      {tab === "deposit" && (
        <button
          data-cy="open-deposit-modal"
          type="button"
          disabled={paused}
          aria-disabled={paused}
          onClick={() => !paused && setModal("deposit")}
          className={primaryButtonClasses}
        >
          Deposit
        </button>
      )}

      {/* Withdraw tab */}
      {tab === "withdraw" && (
        <button
          data-cy="open-withdraw-modal"
          type="button"
          disabled={paused}
          aria-disabled={paused}
          onClick={() => !paused && setModal("withdraw")}
          className={primaryButtonClasses}
        >
          Withdraw
        </button>
      )}

      {/* Harvest — always visible in case the user switches tabs */}
      <button
        data-cy="open-harvest-modal"
        type="button"
        disabled={paused}
        aria-disabled={paused}
        onClick={() => !paused && setModal(null /* harvest handled separately */)}
        className={[
          actionButtonBase,
          "mt-2 border border-zinc-300 hover:bg-zinc-50",
          "dark:border-zinc-600 dark:hover:bg-zinc-800",
          paused ? pausedClasses : "",
        ]
          .join(" ")
          .trim()}
      >
        Harvest
      </button>

      {/* Modal */}
      {modal && !paused && (
        <TransactionModal
          type={modal}
          balance={balance}
          sharePrice="1.0"
          onClose={handleModalClose}
        />
      )}
    </section>
  );
}
