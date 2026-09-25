"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "./ThemeProvider";
import "@/lib/i18n";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme, mounted } = useTheme();

  // Guard active theme styling during SSR / hydration to prevent Prop did not match warning
  const activeTheme = mounted ? theme : "system";

  return (
    <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 bg-white dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          activeTheme === "light"
            ? "bg-zinc-100 dark:bg-zinc-800"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
        aria-label={t("theme.light")}
      >
        <Sun size={14} />
        {t("theme.light")}
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          activeTheme === "dark"
            ? "bg-zinc-100 dark:bg-zinc-800"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
        aria-label={t("theme.dark")}
      >
        <Moon size={14} />
        {t("theme.dark")}
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          activeTheme === "system"
            ? "bg-zinc-100 dark:bg-zinc-800"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
        aria-label={t("theme.auto")}
      >
        {t("theme.auto")}
      </button>
    </div>
  );
}
