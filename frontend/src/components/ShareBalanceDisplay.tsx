"use client";

interface ShareBalanceDisplayProps {
  shares: string;
  sharePrice: string;
  sharePriceUpdatedAt?: number;
  variant?: "compact" | "full";
  className?: string;
}

export function ShareBalanceDisplay({
  shares,
  sharePrice,
  sharePriceUpdatedAt,
  variant = "full",
  className = "",
}: ShareBalanceDisplayProps) {
  const sharesNum = parseFloat(shares);
  const priceNum = parseFloat(sharePrice);
  const usdValue = !isNaN(sharesNum) && !isNaN(priceNum)
    ? (sharesNum * priceNum).toLocaleString(undefined, { maximumFractionDigits: 4 })
    : "—";

  const formattedShares = !isNaN(sharesNum)
    ? sharesNum.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : shares;

  if (variant === "compact") {
    return (
      <span className={`font-mono tabular-nums ${className}`}>
        {formattedShares}
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="font-mono tabular-nums text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {formattedShares} shares
      </span>
      <span className="font-mono tabular-nums text-xs text-zinc-500">
        ≈ {usdValue}
        {sharePriceUpdatedAt && (
          <span className="ml-1 text-zinc-400">
            @ {parseFloat(sharePrice).toFixed(4)}/share
          </span>
        )}
      </span>
    </div>
  );
}
