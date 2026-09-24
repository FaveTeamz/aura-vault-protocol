export function useAnimatedNumber(value: number, _opts?: { decimals?: number }): string {
  return value.toFixed(_opts?.decimals ?? 2);
}
