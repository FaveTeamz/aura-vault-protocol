import { useState, useCallback } from "react";

export type WidgetId =
  | "hero"
  | "apy"
  | "depositors"
  | "last-harvest"
  | "user-position";

export interface WidgetDescriptor {
  id: WidgetId;
  label: string;
  visible: boolean;
}

const DEFAULT_LAYOUT: WidgetDescriptor[] = [
  { id: "hero", label: "Vault Overview", visible: true },
  { id: "apy", label: "APY", visible: true },
  { id: "depositors", label: "Depositors", visible: true },
  { id: "last-harvest", label: "Last Harvest", visible: true },
  { id: "user-position", label: "Your Position", visible: true },
];

const STORAGE_KEY = "aura_widget_layout";

function loadLayout(): WidgetDescriptor[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as WidgetDescriptor[];
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: WidgetDescriptor[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage errors
  }
}

export function useWidgetLayout() {
  const [widgets, setWidgets] = useState<WidgetDescriptor[]>(() => {
    if (typeof window === "undefined") return DEFAULT_LAYOUT;
    return loadLayout();
  });

  /** Replace the full ordered list (used by SortableDashboardGrid after drag). */
  const setOrder = useCallback((next: (WidgetDescriptor | undefined)[]) => {
    const filtered = next.filter((w): w is WidgetDescriptor => w !== undefined);
    setWidgets(filtered);
    saveLayout(filtered);
  }, []);

  /** Reorder by IDs only (convenience wrapper). */
  const reorder = useCallback((orderedIds: WidgetId[]) => {
    setWidgets((prev) => {
      const map = new Map(prev.map((w) => [w.id, w]));
      const reordered = orderedIds
        .map((id) => map.get(id))
        .filter((w): w is WidgetDescriptor => w !== undefined);
      saveLayout(reordered);
      return reordered;
    });
  }, []);

  /** Toggle a widget's visibility. */
  const toggle = useCallback((id: WidgetId) => {
    setWidgets((prev) => {
      const updated = prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      saveLayout(updated);
      return updated;
    });
  }, []);

  /** Reset to default layout. */
  const reset = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
    setWidgets(DEFAULT_LAYOUT);
  }, []);

  return {
    /** Full widget list (including hidden), in current order. */
    widgets,
    /** Alias for widgets — for consumers that prefer `layout`. */
    layout: widgets,
    setOrder,
    reorder,
    toggle,
    reset,
  };
}
