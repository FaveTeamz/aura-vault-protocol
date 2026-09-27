"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { SUPPORTED_LANGS, RTL_LANGS } from "@/lib/i18n";
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? "en";
  useEffect(() => {
    const dir = RTL_LANGS.has(current) ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", current);
    document.documentElement.setAttribute("dir", dir);
  }, [current]);
  return (
    <div className="flex items-center gap-1" role="navigation" aria-label="Language switcher">
      {SUPPORTED_LANGS.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          title={label}
          aria-label={label}
          aria-pressed={current === code}
          className={`px-2 py-1 rounded-md text-sm transition-colors ${
            current === code
              ? "bg-zinc-100 dark:bg-zinc-800 font-medium"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          }`}
        >
          {flag}
        </button>
      ))}
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useTransition } from "react";
const FLAG: Record<string, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
};
export default function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };
    <div className="relative flex items-center">
      <label htmlFor="language-select" className="sr-only">
        {t("label")}
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        className="appearance-none cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 pl-2 pr-6 text-sm font-medium hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {FLAG[loc]} {t(loc as "en" | "es")}
          </option>
        ))}
      </select>
      {/* Custom chevron */}
      <span className="pointer-events-none absolute right-1.5 text-zinc-400 text-xs">▾</span>
    </div>
  );
}
