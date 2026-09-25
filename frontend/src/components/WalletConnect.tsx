"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, Wallet, ExternalLink, RefreshCw } from "lucide-react";
import { useOnboarding } from "@/components/OnboardingChecklist";
import {
  WalletSelectionModal,
  type SupportedWalletId,
  type WalletInfo,
} from "./WalletSelectionModal";

export type WalletType = SupportedWalletId;

export interface WalletState {
  type: WalletType;
  address: string;
  network: string;
  connected: boolean;
}

export interface WalletConnectProps {
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const STORAGE_KEY = "aura_wallet_state";
const LAST_WALLET_KEY = "aura_last_wallet";

export function truncate(address: string): string {
  if (!address || address.length <= 10) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Supported wallet definitions with metadata and install instructions
 */
export const SUPPORTED_WALLETS_METADATA: Record<
  SupportedWalletId,
  {
    name: string;
    description: string;
    installUrl: string;
    installInstructions: string;
  }
> = {
  freighter: {
    name: "Freighter",
    description: "Official Stellar browser extension wallet by SDF",
    installUrl: "https://www.freighter.app/",
    installInstructions:
      "Install the Freighter extension from freighter.app, create or import your account, then click connect.",
  },
  lobstr: {
    name: "Lobstr",
    description: "Leading mobile & web wallet for the Stellar network",
    installUrl: "https://lobstr.co/",
    installInstructions:
      "Install the Lobstr Signer extension or mobile app from lobstr.co, log in, then click connect.",
  },
  xbull: {
    name: "xBull",
    description: "Privacy-focused powerful wallet for Stellar & Soroban",
    installUrl: "https://xbull.app/",
    installInstructions:
      "Install the xBull extension from xbull.app, unlock your wallet, then click connect.",
  },
};

/**
 * Detect which wallets are installed in the browser environment
 */
export function detectInstalledWallets(): Record<SupportedWalletId, boolean> {
  if (typeof window === "undefined") {
    return { freighter: false, lobstr: false, xbull: false };
  }

  const win = window as unknown as {
    freighterApi?: unknown;
    freighter?: unknown;
    lobstr?: unknown;
    lobstrSignerExtension?: unknown;
    xBullSDK?: unknown;
    xbull?: unknown;
  };

  return {
    freighter: Boolean(win.freighterApi || win.freighter),
    lobstr: Boolean(win.lobstr || win.lobstrSignerExtension),
    xbull: Boolean(win.xBullSDK || win.xbull),
  };
}

/**
 * Consistent wallet connection using Stellar Wallets Kit with graceful fallback
 */
export async function connectViaStellarWalletsKit(
  walletId: SupportedWalletId
): Promise<{ address: string; network: string; usedFallback?: boolean }> {
  let kitModule: any = null;

  try {
    // Dynamic import to maintain safe SSR and kit availability resilience
    kitModule = await import("@creit-tech/stellar-wallets-kit");
  } catch {
    try {
      kitModule = await import("@creit.tech/stellar-wallets-kit");
    } catch {
      kitModule = null;
    }
  }

  // If Stellar Wallets Kit is available, attempt to connect through it
  if (kitModule && kitModule.StellarWalletsKit) {
    try {
      const { StellarWalletsKit } = kitModule;

      // Kit wallet ID mapping
      const kitIdMap: Record<SupportedWalletId, string> = {
        freighter: "freighter",
        lobstr: "lobstr",
        xbull: "xbull",
      };

      if (typeof StellarWalletsKit.setWallet === "function") {
        StellarWalletsKit.setWallet(kitIdMap[walletId]);
      }

      if (typeof StellarWalletsKit.getAddress === "function") {
        const res = await StellarWalletsKit.getAddress();
        const address = typeof res === "string" ? res : res?.address;
        if (address) {
          return { address, network: "TESTNET", usedFallback: false };
        }
      }
    } catch (kitErr) {
      console.warn("StellarWalletsKit error, falling back to direct extension:", kitErr);
    }
  }

  // Graceful fallback: Direct browser extension API connection
  if (typeof window === "undefined") {
    throw new Error("Window object is not available.");
  }

  const win = window as any;

  if (walletId === "freighter") {
    const api = win.freighterApi || win.freighter;
    if (!api) {
      throw new Error(
        "Freighter is not installed. Please install Freighter from https://www.freighter.app/"
      );
    }
    let address: string | undefined;
    if (api.requestAccess) {
      const access = await api.requestAccess();
      address = typeof access === "string" ? access : access?.address;
    }
    if (!address && api.getPublicKey) {
      address = await api.getPublicKey();
    }
    if (!address) {
      throw new Error("Freighter connection was cancelled or returned no public key.");
    }
    return { address, network: "TESTNET", usedFallback: true };
  }

  if (walletId === "lobstr") {
    const lobstr = win.lobstr || win.lobstrSignerExtension;
    if (!lobstr) {
      throw new Error(
        "Lobstr is not installed. Please install Lobstr from https://lobstr.co/"
      );
    }
    let address: string | undefined;
    if (lobstr.getPublicKey) {
      address = await lobstr.getPublicKey();
    } else if (lobstr.isConnected && lobstr.requestAccess) {
      const res = await lobstr.requestAccess();
      address = typeof res === "string" ? res : res?.address;
    }
    if (!address) {
      throw new Error("Lobstr connection returned no public key.");
    }
    return { address, network: "TESTNET", usedFallback: true };
  }

  if (walletId === "xbull") {
    const xbull = win.xBullSDK || win.xbull;
    if (!xbull) {
      throw new Error(
        "xBull is not installed. Please install xBull from https://xbull.app/"
      );
    }
    let address: string | undefined;
    if (xbull.getPublicKey) {
      address = await xbull.getPublicKey();
    } else if (xbull.connect) {
      const res = await xbull.connect();
      address = typeof res === "string" ? res : res?.address;
    }
    if (!address) {
      throw new Error("xBull connection returned no public key.");
    }
    return { address, network: "TESTNET", usedFallback: true };
  }

  throw new Error(`Unsupported wallet type: ${walletId}`);
}

export default function WalletConnect({
  onConnected,
  onDisconnected,
}: WalletConnectProps) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<SupportedWalletId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [installedMap, setInstalledMap] = useState<Record<SupportedWalletId, boolean>>({
    freighter: false,
    lobstr: false,
    xbull: false,
  });
  const [isKitFallback, setIsKitFallback] = useState(false);

  const { markComplete } = useOnboarding();

  // Refresh installed wallets status
  const refreshInstalledWallets = useCallback(() => {
    setInstalledMap(detectInstalledWallets());
  }, []);

  // Hydration-safe initial load of wallet state and installed detection
  useEffect(() => {
    refreshInstalledWallets();

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.connected && parsed?.address) {
            setWallet(parsed);
          }
        }
      } catch {
        // ignore corrupt local storage
      }
    }
  }, [refreshInstalledWallets]);

  // Handle wallet connection selection
  const handleSelectWallet = async (walletId: SupportedWalletId) => {
    setLoading(true);
    setConnectingId(walletId);
    setError(null);

    try {
      const { address, network, usedFallback } =
        await connectViaStellarWalletsKit(walletId);

      if (usedFallback) {
        setIsKitFallback(true);
      }

      const nextState: WalletState = {
        type: walletId,
        address,
        network: network.toUpperCase(),
        connected: true,
      };

      setWallet(nextState);

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        localStorage.setItem(LAST_WALLET_KEY, walletId);
      }

      markComplete?.("connect_wallet");
      setIsModalOpen(false);
      onConnected?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to connect to ${SUPPORTED_WALLETS_METADATA[walletId].name}`;
      setError(msg);
    } finally {
      setLoading(false);
      setConnectingId(null);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LAST_WALLET_KEY);
    }
    onDisconnected?.();
  };

  // Prepare wallet list for modal
  const walletList: WalletInfo[] = (["freighter", "lobstr", "xbull"] as SupportedWalletId[]).map(
    (id) => ({
      id,
      name: SUPPORTED_WALLETS_METADATA[id].name,
      description: SUPPORTED_WALLETS_METADATA[id].description,
      installUrl: SUPPORTED_WALLETS_METADATA[id].installUrl,
      installInstructions: SUPPORTED_WALLETS_METADATA[id].installInstructions,
      isInstalled: installedMap[id] ?? false,
    })
  );

  // If connected, render connected state
  if (wallet) {
    const meta = SUPPORTED_WALLETS_METADATA[wallet.type];
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              {meta ? meta.name.charAt(0) : "W"}
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Connected ({meta?.name || wallet.type})
              </p>
              <p
                data-testid="wallet-address"
                className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {truncate(wallet.address)}
              </p>
            </div>
          </div>
          <span
            data-testid="network-badge"
            className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            {wallet.network || "TESTNET"}
          </span>
        </div>

        <button
          data-testid="disconnect-wallet-btn"
          type="button"
          onClick={disconnectWallet}
          className="mt-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Disconnected state: trigger modal button
  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Connect Wallet
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Connect with Freighter, Lobstr, or xBull via Stellar Wallets Kit.
          </p>
        </div>

        <button
          data-testid="connect-wallet-btn"
          type="button"
          onClick={() => {
            refreshInstalledWallets();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Wallet size={16} />
          Connect Wallet
        </button>

        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>

      <WalletSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        wallets={walletList}
        onSelectWallet={handleSelectWallet}
        isConnecting={loading}
        connectingWalletId={connectingId}
        errorMessage={error}
        kitFallbackActive={isKitFallback}
      />
    </>
  );
}
