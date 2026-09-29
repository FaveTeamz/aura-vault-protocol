import { Router } from "express";
import { getCachedLeaderboard } from "../services/analyticsCache.js";
import { logger } from "../logger.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (_req, res): Promise<void> => {
  try {
    const entries = await getCachedLeaderboard();
    res.json({
      leaderboard: entries.map(({ userId, shareBalance }) => ({
        userId: `${userId.slice(0, 8)}...`,
        shareBalance,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to retrieve leaderboard");
    res.status(500).json({ error: "Failed to retrieve leaderboard" });
  }
});