"use client";

/**
 * ThemeProvider — #241
 *
 * Theme system with:
 *  ✓ Auto-detect prefers-color-scheme on first load
 *  ✓ Persists to localStorage under key "aura-theme"
 *  ✓ SSR-safe: suppressHydrationWarning on <html> + inline script in layout.tsx
 *  ✓ Responds to OS preference changes in real-time
 *  ✓ Exports useTheme() hook for all consumers
 */

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  /** The explicitly chosen theme (may be "system") */
  theme: Theme;
  /** The currently displayed theme — always "light" or "dark" */
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Storage key for the user's theme preference.
 * The inline no-flash script in layout.tsx must use the same key.
 */
const STORAGE_KEY = "aura-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // ── Read persisted preference once on mount ──────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeState(stored);
      }
    } catch {
      // localStorage unavailable (private browsing, SSR guard) — stay at system
    }
  }, []);

  // ── Apply .dark class and react to OS changes ────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      const resolved =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
      setResolvedTheme(resolved);
    }

    apply();

    // Re-apply if the OS preference changes while the page is open
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore write errors
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
