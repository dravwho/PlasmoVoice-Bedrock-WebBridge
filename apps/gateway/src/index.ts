import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { setupWebSocket, startProximityTicker } from "./websocket/handler.js";
import { authService } from "./auth/AuthService.js";
import { playerManager } from "./players/PlayerManager.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: config.MINECRAFT_SERVER_NAME,
    players: playerManager.getAll().length,
    uptime: process.uptime(),
  });
});

app.post("/api/internal/linking-code", (req, res) => {
  const secret = req.headers["x-connector-secret"];
  if (typeof secret !== "string" || !authService.verifyConnectorSecret(secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { uuid, username, platform } = req.body;
  if (!uuid || !username || !platform) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  const code = authService.createLinkingCode({ uuid, username, platform });
  res.json({ code: code.code, expiresAt: code.expiresAt });
});

app.get("/api/info", (_req, res) => {
  res.json({
    serverName: config.MINECRAFT_SERVER_NAME,
    publicUrl: config.PUBLIC_URL,
    proximity: {
      enabled: config.PROXIMITY_ENABLED,
      maxDistance: config.PROXIMITY_MAX_DISTANCE,
    },
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: config.WEBSOCKET_PATH });

setupWebSocket(wss);
startProximityTicker(1000);

server.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      publicUrl: config.PUBLIC_URL,
      wsPath: config.WEBSOCKET_PATH,
    },
    "Voice Gateway started"
  );
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  server.close();
  process.exit(0);
});
