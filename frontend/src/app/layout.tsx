import type { Metadata } from "next";

import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Vault Protocol",
  description: "Aura Vault Protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
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
          <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
            <a href="/" className="text-sm font-semibold tracking-tight">
              Aura Vault
            </a>

            <div className="flex items-center gap-4">
              <nav className="flex gap-4 text-sm">
                <a
                  href="/faq"
                  className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  FAQ
                </a>

                <a
                  href="/settings"
                  className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Settings
                </a>
              </nav>

              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
