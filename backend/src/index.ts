import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  generateTokens,
  validateAccessToken,
  refreshAccessToken,
  logout,
  getUserSessions,
  revokeAllSessions,
} from "./auth.js";
import { getPreferences, updatePreferences } from "./preferences.js";

const app = express();
app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth requests, try again later" },
});

// Auth middleware
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  const payload = validateAccessToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  (req as any).user = payload;
  next();
}

// POST /api/auth/login — wallet-based login
app.post("/api/auth/login", authLimiter, (req, res) => {
  const { walletAddress, deviceId } = req.body;
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress required" });
    return;
  }
  const tokens = generateTokens(walletAddress, deviceId);
  res.json(tokens);
});

// POST /api/auth/refresh
app.post("/api/auth/refresh", authLimiter, (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }
  const tokens = refreshAccessToken(refreshToken);
  if (!tokens) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }
  res.json(tokens);
});

// POST /api/auth/logout
app.post("/api/auth/logout", authenticate, (req, res) => {
  const token = req.headers.authorization!.slice(7);
  const { refreshToken } = req.body;
  logout(token, refreshToken);
  res.json({ success: true });
});

// GET /api/auth/sessions
app.get("/api/auth/sessions", authenticate, (req, res) => {
  const user = (req as any).user;
  res.json({ sessions: getUserSessions(user.sub) });
});

// POST /api/auth/revoke-all
app.post("/api/auth/revoke-all", authenticate, (req, res) => {
  const user = (req as any).user;
  revokeAllSessions(user.sub);
  res.json({ success: true });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /api/users/preferences
app.get("/api/users/preferences", authenticate, getPreferences);

// PUT /api/users/preferences
app.put("/api/users/preferences", authenticate, updatePreferences);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Aura Vault backend running on port ${PORT}`);
});

export default app;
