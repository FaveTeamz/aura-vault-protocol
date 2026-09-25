import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import NavHeader from "@/components/NavHeader";
import { NotificationProvider, NotificationCenter } from "@/components/notifications";
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
            {/* Unified responsive navigation header — #242
                Desktop (≥768px): logo + nav links + wallet button
                Mobile  (<768px): logo + hamburger → slide-in drawer      */}
            <NavHeader />

            {children}
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
