"use client";
interface ShareBalanceDisplayProps {
  address?: string;
  shares?: string;
  sharePrice?: string;
  sharePriceUpdatedAt?: number;
  variant?: string;
  className?: string;
}
export function ShareBalanceDisplay({ className = "" }: ShareBalanceDisplayProps) {
  return <span className={className} />;
}
