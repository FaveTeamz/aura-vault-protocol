import { useState, useEffect, useRef } from "react";

interface UseAnimatedNumberOptions {
  /** Number of decimal places to display */
  decimals?: number;
  /** Animation duration in milliseconds */
  duration?: number;
}
/**
 * Animates a number from its previous value to a new value using requestAnimationFrame.
 * Returns the formatted string representation of the current animated value.
 */
export function useAnimatedNumber(
  target: number,
  options: UseAnimatedNumberOptions = {}
): string {
  const { decimals = 2, duration = 600 } = options;
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    // Cancel any running animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    startTimeRef.current = null;
    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * eased;
      setCurrent(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = to;
        rafRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);
  return current.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
export function useAnimatedNumber(value: number, _opts?: { decimals?: number }): string {
  return value.toFixed(_opts?.decimals ?? 2);
}
