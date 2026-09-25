import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import MobileNavHeader from "@/components/MobileNavHeader";
import { NotificationProvider, NotificationCenter } from "@/components/notifications";
import {
  FreighterNetworkProvider,
  FreighterNetworkBanner,
} from "@/components/FreighterNetworkBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura Vault Protocol",
  description: "Share-based yield vault on Stellar / Soroban",
};

// Inline script runs before React hydration to prevent theme flash.
const noFlashScript = `(function(){try{var t=localStorage.getItem('aura_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Must be first in <head> — blocks rendering until theme is set */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <ThemeProvider>
          <NotificationProvider>
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
                </div>
              </div>

              {children}
            </FreighterNetworkProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
