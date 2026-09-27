import type { Metadata } from "next";
import { Suspense } from "react";

import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
// Issue #284: PWA service worker registration
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import WalletConnect from "@/components/WalletConnect";
import ProgressBar from "@/components/ProgressBar";
import { OnboardingTour } from "@/components/OnboardingTour";
import { HeaderWidgets } from "@/components/HeaderWidgets";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
            <a href="/" className="text-sm font-semibold tracking-tight">
              Aura Vault
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
                  className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Settings
                </a>
              </nav>

              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>

          {children}
          {/* Issue #284: PWA install prompt */}
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
