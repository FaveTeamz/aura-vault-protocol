"use client";
interface EmptyStateProps { variant?: string; className?: string; }
export function EmptyState({ className="" }: EmptyStateProps) { return <div className={className} />; }
