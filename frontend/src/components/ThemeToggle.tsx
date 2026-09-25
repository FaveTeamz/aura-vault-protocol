"use client";

/**
 * ThemeToggle — #241
 *
 * A single icon button that cycles through light → dark → system themes.
 * Placed in the header (NavHeader on desktop, MobileNavHeader on mobile).
 *
 * Acceptance criteria:
 *  ✓ Auto-detect prefers-color-scheme on first load  (ThemeProvider)
 *  ✓ Toggle button in the header with sun/moon icon
 *  ✓ CSS variables used for all colors — no hardcoded hex in components
 *  ✓ Transition animation (200ms) on theme switch    (globals.css body rule)
 *  ✓ Persisted to localStorage under key "aura-theme"
 *  ✓ SSR-safe: no flash of wrong theme on Next.js hydration
 *      (inline <script> in layout.tsx fires before paint)
 *
 * Behavior:
 *   - When resolvedTheme === "light"  → clicking switches to "dark"
 *   - When resolvedTheme === "dark"   → clicking switches to "system"
 *   - When theme === "system"         → clicking switches to "light"
 *
 * This keeps a single button rather than the 3-button segment, so the
 * header stays compact. The aria-label updates to reflect the *next* action.
 */

import { useTheme } from "./ThemeProvider";
import type { MouseEvent } from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────

/** Filled sun — used when the current theme shows light mode */
function SunIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="4"  />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="4"  y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
    </svg>
  );
}

/** Crescent moon — used when the current theme shows dark mode */
function MoonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Monitor icon — used when the theme follows system preference */
function SystemIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Theme = "light" | "dark" | "system";

const NEXT_THEME: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const ARIA_LABEL: Record<Theme, string> = {
  light: "Switch to dark mode",
  dark: "Switch to system preference",
  system: "Switch to light mode",
};

/**
 * ThemeToggle
 *
 * Single-button theme toggle. Cycles: light → dark → system → light …
 *
 * data-cy="theme-toggle-btn"  — used by Playwright / Cypress tests
 * data-theme={theme}          — exposes current theme to tests
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setTheme(NEXT_THEME[theme]);
  }

  // Show the icon for the *current* resolved appearance so it's
  // immediately meaningful (sun = currently light, moon = currently dark)
  const icon =
    theme === "system" ? (
      <SystemIcon />
    ) : resolvedTheme === "dark" ? (
      <MoonIcon />
    ) : (
      <SunIcon />
    );

  return (
    <button
      data-cy="theme-toggle-btn"
      data-theme={theme}
      type="button"
      onClick={handleClick}
      aria-label={ARIA_LABEL[theme]}
      title={ARIA_LABEL[theme]}
      className={[
        "flex items-center justify-center rounded-lg p-2",
        "text-zinc-600 dark:text-zinc-400",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100",
        "transition-colors duration-200",
      ].join(" ")}
      style={{ minWidth: "36px", minHeight: "36px" }}
    >
      {icon}
    </button>
  );
}
