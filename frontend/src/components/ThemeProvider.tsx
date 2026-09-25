"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
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
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeState(stored);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // Apply class to <html> whenever theme or OS preference changes (client-only)
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
      setResolvedTheme(resolved);
    };

    apply();
    if (mq && typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("aura_theme", t);
      } catch {
        // Ignore storage errors
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
