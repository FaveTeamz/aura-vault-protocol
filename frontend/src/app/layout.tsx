import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";

import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
// Issue #284: PWA service worker registration
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import WalletConnect from "@/components/WalletConnect";
import ProgressBar from "@/components/ProgressBar";
import { OnboardingTour } from "@/components/OnboardingTour";
import { HeaderWidgets } from "@/components/HeaderWidgets";
import { ToastProvider } from "@/components/toast";
import NavHeader from "@/components/NavHeader";
import { NotificationProvider, NotificationCenter } from "@/components/notifications";
import {
  FreighterNetworkProvider,
  FreighterNetworkBanner,
} from "@/components/FreighterNetworkBanner";
import "./globals.css";
export const metadata: Metadata = {
  title: "Aura Vault Protocol",
  description:
    "Share-based yield vault on Stellar — deposit, compound, and withdraw with Freighter.",
  manifest: "/manifest.json",
  // Issue #284: PWA theme colour used by browsers on mobile
  themeColor: "#6366f1",
  appleWebApp: {
    capable: true,
    title: "Aura Vault",
    statusBarStyle: "black-translucent",
  },
};
// Root layout — minimal wrapper required by Next.js App Router.
// All locale-specific rendering is handled by app/[locale]/layout.tsx.
// Inline script runs before React hydration to prevent theme flash.
// Must use the same localStorage key as ThemeProvider: "aura-theme"
const noFlashScript = `(function(){try{var t=localStorage.getItem('aura-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}>) {
  return (
    /*
      suppressHydrationWarning is strictly necessary on <html> because ThemeProvider and LanguageSwitcher
      dynamically modify the root html element's class ("dark") and attributes ("lang", "dir") on the client
      based on localStorage and system color scheme preferences (prefers-color-scheme).
      Next.js and React specifically recommend suppressHydrationWarning for <html> in themes/i18n to prevent
      root-level attribute mismatch warnings while preserving full hydration validation for children.
    */
    <html
      lang="en"
      dir="ltr"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
        <ThemeProvider>
          {/* Slim progress bar for page transitions and API calls (#266) */}
          <Suspense fallback={null}>
            <ProgressBar />
          </Suspense>
          {/* Onboarding tour — auto-starts on first visit, restartable from Settings */}
          <OnboardingTour />
          <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
            <a href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Image
                src="/logo.svg"
                alt="Aura Vault Protocol logo"
                width={28}
                height={28}
                priority
                className="rounded-lg"
              />
              <span>Aura Vault</span>
            </a>
            {/* Live share price ticker + wallet balance */}
            <HeaderWidgets />
            <div className="flex items-center gap-4">
              <nav className="flex gap-4 text-sm">
                <a
                  href="/faq"
                  className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  FAQ
                </a>
                  href="/settings"
          <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <a href="/" className="text-sm font-semibold tracking-tight shrink-0">
            {/* Wallet connection — occupies the center/right of the header */}
            <div className="flex-1 max-w-sm">
              <WalletConnect />
            </div>
            <div className="flex items-center gap-4 shrink-0">
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  Settings
              </nav>
              <LanguageSwitcher />
              <ThemeToggle />
          </header>
          {children}
          {/* Issue #284: PWA install prompt */}
          <ServiceWorkerRegistration />
          <ToastProvider>
            <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <a href="/" className="text-sm font-semibold tracking-tight">Aura Vault</a>
              <div className="flex items-center gap-4">
                <nav className="flex gap-4 text-sm">
                  <a href="/faq" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">FAQ</a>
                  <a href="/settings" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Settings</a>
                </nav>
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </header>
          <NotificationProvider>
            {/* Unified responsive navigation header — #242
                Desktop (≥768px): logo + nav links + wallet button
                Mobile  (<768px): logo + hamburger → slide-in drawer      */}
            <NavHeader />
            {children}
          </ToastProvider>
            <FreighterNetworkProvider>
              {/* Network mismatch warning — shown at top of every page */}
              <FreighterNetworkBanner />
              {/* Desktop header — hidden on mobile; mobile header shown instead */}
              <header className="hidden sm:flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <a href="/" className="text-sm font-semibold tracking-tight">Aura Vault</a>
                <div className="flex items-center gap-4">
                  <nav className="flex gap-4 text-sm" aria-label="Main navigation">
                    <a href="/faq" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">FAQ</a>
                    <a href="/settings" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Settings</a>
                  </nav>
                  {/* Notification bell — after nav links, before LanguageSwitcher */}
                  <NotificationCenter />
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </header>
              {/* Mobile header with hamburger + notification bell — hidden on sm+ */}
              <div className="sm:hidden">
                <MobileNavHeader />
                {/* Notification bell in mobile area — floats in top-right corner */}
                <div className="absolute top-2 right-14 z-40">
                  <NotificationCenter fullScreenMobile />
              {children}
            </FreighterNetworkProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}) {
  return children;
}
