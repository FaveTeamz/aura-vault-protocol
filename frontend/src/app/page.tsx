import type { Metadata } from "next";
import VaultDashboard from "@/components/VaultDashboard";

export const metadata: Metadata = {
  title: "Aura Vault",
  description: "Aura Vault Protocol dashboard",
};
export default function Home() {
  return <VaultDashboard />;
import { useWalletStore } from "@/lib/walletStore";
import "@/lib/i18n";
import PortfolioPanel from "@/components/PortfolioPanel";
import VaultActions from "@/components/VaultActions";
import CopyButton from "@/components/CopyButton";
import { truncateAddress } from "@/components/WalletConnect";
  const { address, connected } = useWalletStore();
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col w-full max-w-5xl mx-auto gap-6 py-8 px-4 sm:px-6">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Aura Vault
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Share-based yield vault on Stellar / Soroban
          </p>
          {/* Connected address with copy button */}
          {connected && address && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Connected:
              </span>
              <span
                className="font-mono text-xs text-zinc-600 dark:text-zinc-400"
                title={address}
                data-cy="header-address"
              >
                {truncateAddress(address)}
              <CopyButton
                text={address}
                label="Copy address"
                data-cy="copy-wallet-address"
              />
            </div>
          )}
        </div>
        {/* ── Vault Dashboard (live stats, always visible) ─────────────── */}
        <VaultDashboard />
        {/* ── Connect prompt when not connected ───────────────────────── */}
        {!connected && (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Connect your Freighter wallet to deposit, withdraw, and view your portfolio.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Click &ldquo;Connect Wallet&rdquo; in the header to get started.
          </div>
        )}
        {/* ── Vault actions + Portfolio (only when connected) ─────────── */}
        {connected && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Deposit / Withdraw */}
            <div className="lg:col-span-1">
              <VaultActions />
            {/* Portfolio — takes remaining 2 columns on desktop */}
            <div className="lg:col-span-2">
              <PortfolioPanel />
      </main>
    </div>
  );
}
