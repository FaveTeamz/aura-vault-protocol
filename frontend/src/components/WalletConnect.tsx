"use client";

import { useCallback, useEffect } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
} from "@stellar/freighter-api";
import { useWalletStore } from "@/lib/walletStore";

/**
 * Truncates a Stellar public key: first 4 chars + "..." + last 4 chars.
 * Example: GABC...WXYZ
 */
export function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

export default function WalletConnect() {
  const { address, network, connected, loading, error, setConnected, setDisconnected, setLoading, setError } =
    useWalletStore();

  // On mount: if the store says we were connected, verify Freighter still has access
  useEffect(() => {
    if (connected && address) {
      verifySession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifySession() {
    try {
      const connResult = await isConnected();
      if (!connResult.isConnected) {
        setDisconnected();
        return;
      }
      const addrResult = await getAddress();
      if (addrResult.error || !addrResult.address) {
        setDisconnected();
      }
    } catch {
      setDisconnected();
    }
  }

  const connect = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Check if Freighter extension is installed
      const connResult = await isConnected();
      if (!connResult.isConnected) {
        setError(
          "Freighter wallet not found. Please install the extension."
        );
        return;
      }

      // 2. Request access (triggers the Freighter popup)
      const accessResult = await requestAccess();
      if (accessResult.error) {
        // Handle user declining gracefully
        if (
          typeof accessResult.error === "string" &&
          accessResult.error.includes("User declined")
        ) {
          setError("Connection declined. Please approve the request in Freighter.");
        } else {
          setError(
            typeof accessResult.error === "string"
              ? accessResult.error
              : "Failed to connect wallet"
          );
        }
        return;
      }

      // 3. Get the public key and network
      const addrResult = await getAddress();
      if (addrResult.error || !addrResult.address) {
        setError("Could not retrieve address from Freighter.");
        return;
      }

      // @stellar/freighter-api v6 returns network from requestAccess
      const networkName =
        (accessResult as any).network?.toUpperCase() ??
        (accessResult as any).networkPassphrase?.includes("Test")
          ? "TESTNET"
          : "MAINNET";

      setConnected(addrResult.address, networkName ?? "TESTNET");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setConnected, setError, setLoading]);

  const disconnect = useCallback(() => {
    setDisconnected();
  }, [setDisconnected]);

  // ── Freighter not installed ──────────────────────────────────────────────
  if (error?.includes("not found")) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        >
          <p className="font-semibold mb-1">Freighter Wallet Not Detected</p>
          <p className="mb-2">
            Install the Freighter browser extension to connect your Stellar
            wallet.
          </p>
          <a
            href="https://www.freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
            aria-label="Install Freighter wallet extension (opens in new tab)"
          >
            Install Freighter →
          </a>
        </div>
        <button
          onClick={() => setError(null)}
          className="self-start text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Connected state ──────────────────────────────────────────────────────
  if (connected && address) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <span
            aria-label="Connected"
            className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800"
          />

          {/* Network badge */}
          <span
            data-cy="network-badge"
            className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          >
            {network ?? "TESTNET"}
          </span>

          {/* Truncated address */}
          <span
            data-cy="wallet-address"
            className="font-mono text-sm text-zinc-700 dark:text-zinc-300"
            title={address}
          >
            {truncateAddress(address)}
          </span>

          {/* Disconnect */}
          <button
            data-cy="disconnect-wallet-btn"
            onClick={disconnect}
            className="ml-auto rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // ── Disconnected state ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-3">
        <button
          data-cy="connect-wallet-btn"
          onClick={connect}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300 transition-colors"
          aria-label="Connect Freighter wallet"
        >
          {loading && <Spinner />}
          {loading ? "Connecting…" : "Connect Wallet"}
        </button>
      </div>

      {error && !error.includes("not found") && (
        <p
          className="text-sm text-red-600 dark:text-red-400"
          role="alert"
          data-cy="wallet-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
