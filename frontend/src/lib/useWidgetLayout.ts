/**
 * useWidgetLayout — persists dashboard widget order and visibility to localStorage.
 *
 * Consumers:
 *   SortableDashboardGrid  — reads + updates widget order
 *   /settings              — may toggle visibility per widget
 *
 * Widget IDs:
 *   "hero"          — TVL / share price hero card
 *   "apy"           — 7-day APY
 *   "depositors"    — depositor count
 *   "last-harvest"  — last harvest timestamp + amount
 *   "user-position" — user's vault position (wallet-gated)
 *   "referral"      — referral count + deposited volume (new)
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WidgetId =
  | "hero"
  | "apy"
  | "depositors"
  | "last-harvest"
  | "user-position"
  | "referral";

export interface WidgetDescriptor {
  id: WidgetId;
  label: string;
  /** Whether the widget is shown on the dashboard */
  visible: boolean;
}

export interface UseWidgetLayoutReturn {
  widgets: WidgetDescriptor[];
  /** Overwrite the full widget list (used by drag-and-drop reorder) */
  setOrder: (next: WidgetDescriptor[]) => void;
  /** Toggle a widget's visibility */
  setVisible: (id: WidgetId, visible: boolean) => void;
}

// ---------------------------------------------------------------------------
// Default layout
// ---------------------------------------------------------------------------

const DEFAULT_WIDGETS: WidgetDescriptor[] = [
  { id: "hero", label: "Vault Overview", visible: true },
  { id: "apy", label: "7-Day APY", visible: true },
  { id: "depositors", label: "Depositor Count", visible: true },
  { id: "last-harvest", label: "Last Harvest", visible: true },
  { id: "user-position", label: "My Position", visible: true },
  { id: "referral", label: "Referrals", visible: true },
];

const STORAGE_KEY = "aura_widget_layout";

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function loadLayout(): WidgetDescriptor[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WIDGETS;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS;

    // Merge stored layout with defaults so newly added widgets always appear
    const storedMap = new Map(
      (parsed as WidgetDescriptor[]).map((w) => [w.id, w])
    );

    // Start from default order, apply stored visibility + order
    const merged = DEFAULT_WIDGETS.map((def) => ({
      ...def,
      ...(storedMap.has(def.id)
        ? { visible: storedMap.get(def.id)!.visible }
        : {}),
    }));

    // Reorder according to stored order (only for IDs that exist in defaults)
    const storedOrder = (parsed as WidgetDescriptor[])
      .map((w) => w.id)
      .filter((id) => merged.some((m) => m.id === id));
    const remaining = merged.filter((w) => !storedOrder.includes(w.id));

    const reordered: WidgetDescriptor[] = [];
    for (const id of storedOrder) {
      const found = merged.find((m) => m.id === id);
      if (found) reordered.push(found);
    }

    return [...reordered, ...remaining];
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveLayout(widgets: WidgetDescriptor[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // ignore — localStorage quota exceeded or unavailable
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWidgetLayout(): UseWidgetLayoutReturn {
  const [widgets, setWidgets] = useState<WidgetDescriptor[]>(DEFAULT_WIDGETS);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setWidgets(loadLayout());
  }, []);

  const setOrder = useCallback((next: WidgetDescriptor[]) => {
    setWidgets(next);
    saveLayout(next);
  }, []);

  const setVisible = useCallback((id: WidgetId, visible: boolean) => {
    setWidgets((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, visible } : w));
      saveLayout(next);
      return next;
    });
  }, []);

  return { widgets, setOrder, setVisible };
}
