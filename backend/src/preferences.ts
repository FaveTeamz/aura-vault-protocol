import type { Request, Response } from "express";

export type TimeRange = "7d" | "30d" | "90d" | "all";

interface UserPreferences {
  default_history_range: TimeRange;
}

const VALID_RANGES: TimeRange[] = ["7d", "30d", "90d", "all"];

// In-memory store keyed by wallet address — replace with DB in production
const store = new Map<string, UserPreferences>();

export function getPreferences(req: Request, res: Response): void {
  const userId = (req as any).user?.sub as string;
  const prefs = store.get(userId) ?? {
    default_history_range: "30d" as TimeRange,
  };
  res.json(prefs);
}

export function updatePreferences(req: Request, res: Response): void {
  const userId = (req as any).user?.sub as string;
  const { default_history_range } = req.body as Partial<UserPreferences>;

  if (
    default_history_range !== undefined &&
    !VALID_RANGES.includes(default_history_range)
  ) {
    res.status(400).json({
      error: `default_history_range must be one of: ${VALID_RANGES.join(", ")}`,
    });
    return;
  }

  const current = store.get(userId) ?? {
    default_history_range: "30d" as TimeRange,
  };
  const updated: UserPreferences = {
    ...current,
    ...(default_history_range !== undefined ? { default_history_range } : {}),
  };
  store.set(userId, updated);
  res.json(updated);
}
