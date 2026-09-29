import { Suspense } from "react";
import type { Metadata } from "next";
import VaultDashboard from "@/components/VaultDashboard";
"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { useWalletStore } from "@/lib/walletStore";
import "@/lib/i18n";
import PortfolioPanel from "@/components/PortfolioPanel";
import VaultActions from "@/components/VaultActions";
import CopyButton from "@/components/CopyButton";
import { truncateAddress } from "@/components/WalletConnect";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import { Skeleton } from "@/components/Skeleton";

export const metadata: Metadata = {
  title: "Aura Vault",
  description: "Aura Vault Protocol dashboard",
};
export default function Home() {
  return <VaultDashboard />;
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
  const t = useTranslations("home");
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            {t("heading")}
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {t.rich("body", {
              templatesLink: (chunks) => (
                <a
                  href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                  className="font-medium text-zinc-950 dark:text-zinc-50"
                >
                  {chunks}
                </a>
              ),
              learningLink: (chunks) => (
                  href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            })}
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
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="faq"
          >
            {t("faqLink")}
          </a>
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            {t("deployNow")}
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            Documentation
      </div>
    </div>
/**
 * Home page — Issue #262: deep-link support for pre-filled deposit/withdraw.
 *
 * DeepLinkHandler uses useSearchParams() which requires a Suspense boundary
 * in Next.js App Router (the hook opts the subtree into dynamic rendering).
 * The fallback renders skeleton cards so the layout doesn't shift on load.
 */
    <Suspense fallback={<HomeSkeleton />}>
      <DeepLinkHandler />
    </Suspense>
  );
}
function HomeSkeleton() {
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      {/* Actions skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
    </main>
  );
}
