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
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  mounted: false,
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
  const [mounted, setMounted] = useState<boolean>(false);

  // Read persisted preference once on mount to guarantee SSR/client hydration match
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("aura_theme") as Theme | null;
  // ── Read persisted preference once on mount ──────────────────────────────
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeState(stored);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);
  // Apply class to <html> whenever theme or OS preference changes (client-only)
      // localStorage unavailable (private browsing, SSR guard) — stay at system
  // ── Apply .dark class and react to OS changes ────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root) return;

    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const apply = () => {
      const isDark =
        theme === "system" ? Boolean(mq?.matches) : theme === "dark";
      const resolved = isDark ? "dark" : "light";
      root.classList.toggle("dark", isDark);
    function apply() {
      const resolved =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
      setResolvedTheme(resolved);
    }

    apply();
    if (mq && typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    // Re-apply if the OS preference changes while the page is open
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("aura_theme", t);
      } catch {
        // Ignore storage errors
      localStorage.setItem(STORAGE_KEY, t);
      // ignore write errors
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
