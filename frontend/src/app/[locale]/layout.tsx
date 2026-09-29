import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { NotificationProvider } from "@/components/notifications";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Reject unsupported locales
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <NotificationProvider>
            <header className="sticky top-0 z-40 border-b border-black/[.08] dark:border-white/[.1] bg-white/80 dark:bg-black/80 backdrop-blur-sm">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                <a
                  href={`/${locale}`}
                  className="text-sm font-semibold tracking-tight"
                >
                  Aura Vault
                </a>
                <div className="flex items-center gap-3">
                  <nav className="flex items-center gap-1">
                    <a
                      href={`/${locale}/faq`}
                      className="rounded-md px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      FAQ
                    </a>
                    <a
                      href={`/${locale}/settings`}
                      className="rounded-md px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      ⚙
                    </a>
                  </nav>
                  <LanguageSwitcher />
                </div>
              </div>
            </header>
            <main className="flex flex-col flex-1">{children}</main>
          </NotificationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
