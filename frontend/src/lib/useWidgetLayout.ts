/**
 * useWidgetLayout — persists dashboard widget order and visibility to localStorage.
 *
 * Consumers:
 *   SortableDashboardGrid  — reads + updates widget order
 *   /settings              — may toggle visibility per widget
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
import { useState, useCallback } from "react";
export type WidgetId =
  | "hero"
  | "apy"
  | "depositors"
  | "last-harvest"
  | "user-position"
  | "referral";
  | "user-position";
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
// Default layout
const DEFAULT_WIDGETS: WidgetDescriptor[] = [
  { id: "hero", label: "Vault Overview", visible: true },
  { id: "apy", label: "7-Day APY", visible: true },
  { id: "depositors", label: "Depositor Count", visible: true },
  { id: "last-harvest", label: "Last Harvest", visible: true },
  { id: "user-position", label: "My Position", visible: true },
  { id: "referral", label: "Referrals", visible: true },
const DEFAULT_LAYOUT: WidgetDescriptor[] = [
  { id: "apy", label: "APY", visible: true },
  { id: "depositors", label: "Depositors", visible: true },
  { id: "user-position", label: "Your Position", visible: true },
];
const STORAGE_KEY = "aura_widget_layout";
// Serialisation helpers
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
function saveLayout(widgets: WidgetDescriptor[]): void {
  if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    // ignore — localStorage quota exceeded or unavailable
// Hook
export function useWidgetLayout(): UseWidgetLayoutReturn {
  const [widgets, setWidgets] = useState<WidgetDescriptor[]>(DEFAULT_WIDGETS);
  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setWidgets(loadLayout());
  }, []);
  const setOrder = useCallback((next: WidgetDescriptor[]) => {
    setWidgets(next);
    saveLayout(next);
  const setVisible = useCallback((id: WidgetId, visible: boolean) => {
    setWidgets((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, visible } : w));
      saveLayout(next);
      return next;
    });
  return { widgets, setOrder, setVisible };
    if (stored) {
      return JSON.parse(stored) as WidgetDescriptor[];
    // Ignore parse errors
  return DEFAULT_LAYOUT;
function saveLayout(layout: WidgetDescriptor[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    // Ignore storage errors
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
  /** Reorder by IDs only (convenience wrapper). */
  const reorder = useCallback((orderedIds: WidgetId[]) => {
      const map = new Map(prev.map((w) => [w.id, w]));
      const reordered = orderedIds
        .map((id) => map.get(id))
        .filter((w): w is WidgetDescriptor => w !== undefined);
      saveLayout(reordered);
      return reordered;
  /** Toggle a widget's visibility. */
  const toggle = useCallback((id: WidgetId) => {
      const updated = prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      saveLayout(updated);
      return updated;
  /** Reset to default layout. */
  const reset = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
    setWidgets(DEFAULT_LAYOUT);
  return {
    /** Full widget list (including hidden), in current order. */
    widgets,
    /** Alias for widgets — for consumers that prefer `layout`. */
    layout: widgets,
    setOrder,
    reorder,
    toggle,
    reset,
export type WidgetId = string;
export interface WidgetDescriptor { id: WidgetId; visible: boolean; label: string; }
export type Widget = WidgetDescriptor;
const DEFAULT_WIDGETS: WidgetDescriptor[] = [];
export function useWidgetLayout(defaults: WidgetDescriptor[] = DEFAULT_WIDGETS) {
    widgets: defaults,
    setWidgets: (_: WidgetDescriptor[]) => {},
    setOrder: (_items: WidgetDescriptor[]) => {},
  };
}
