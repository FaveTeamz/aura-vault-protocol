"use client";
interface AnimatedShareBalanceProps { value: string; className?: string; priceMode?: boolean; }
export function AnimatedShareBalance({ value, className="" }: AnimatedShareBalanceProps) { return <span className={className}>{value}</span>; }
