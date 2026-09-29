"use client";

interface AnimatedShareBalanceProps {
  value: string;
  className?: string;
  /** When true, formats value as a price (e.g. 1.0000) */
  priceMode?: boolean;
}
export function AnimatedShareBalance({
  value,
  className = "",
  priceMode = false,
}: AnimatedShareBalanceProps) {
  const display = priceMode
    ? parseFloat(value).toFixed(4)
    : value;
  return (
    <span className={`tabular-nums transition-all duration-300 ${className}`}>
      {display}
    </span>
  );
interface AnimatedShareBalanceProps { value: string; className?: string; priceMode?: boolean; }
export function AnimatedShareBalance({ value, className="" }: AnimatedShareBalanceProps) { return <span className={className}>{value}</span>; }
