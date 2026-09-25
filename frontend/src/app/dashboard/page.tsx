"use client";

import dynamic from "next/dynamic";

/**
 * /dashboard — main vault overview page.
 *
 * Code-split routes with dynamic imports to enforce bundle size budgets.
 */
const DashboardGrid = dynamic(
  () => import("@/components/dashboard/DashboardGrid").then((mod) => mod.DashboardGrid),
  {
    loading: () => (
      <div className="h-96 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
    ),
    ssr: true,
  }
);

const PerformanceCharts = dynamic(
  () => import("@/components/PerformanceCharts"),
  {
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
    ),
    ssr: false, // Charts are client-side canvas visualization
  }
);

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardGrid />
      <PerformanceCharts />
    </div>
  );
}
