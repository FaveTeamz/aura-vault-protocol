"use client";

import { SortableDashboardGrid } from "@/components/dashboard/SortableDashboardGrid";
import PerformanceCharts from "@/components/PerformanceCharts";
import ApyCalculator from "@/components/ApyCalculator";

/**
 * /dashboard — main vault overview page.
 *
 * Issue #498: uses SortableDashboardGrid which supports:
 *  - Drag-and-drop widget reordering (@dnd-kit/sortable)
 *  - Keyboard reordering (arrow keys on grip handle)
 *  - Widget visibility controlled from /settings
 *  - Layout persisted to localStorage
 *  - Smooth 60fps drag animation via CSS transform + DragOverlay
 *
 * Issue #261: APY Calculator added below PerformanceCharts.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <SortableDashboardGrid />
      <PerformanceCharts />

      {/* APY Calculator — issue #261 */}
      <div className="mx-auto w-full max-w-4xl px-4 pb-8">
        <ApyCalculator />
      </div>
    </div>
  );
}
