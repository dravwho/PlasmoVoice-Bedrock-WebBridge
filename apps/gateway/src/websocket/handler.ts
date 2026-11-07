import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import {
  BrowserToGatewayMessage,
  FabricToGatewayMessage,
  GatewayToBrowserMessage,
  GatewayToFabricMessage,
  PlayerState,
} from "../../../../packages/protocol/src/messages.js";
import { authService } from "../auth/AuthService.js";
import { sessionManager, ClientSession } from "../sessions/SessionManager.js";
import { playerManager } from "../players/PlayerManager.js";
import { proximityEngine } from "../proximity/ProximityEngine.js";
import { liveKitService } from "../media/LiveKitService.js";
import { logger } from "../config/logger.js";

function parseMessage<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const sessionId = randomUUID();
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const role = url.searchParams.get("role");

    logger.info({ sessionId, role, ip: req.socket.remoteAddress }, "New WebSocket connection");

    const session: ClientSession = {
      id: sessionId,
      type: role === "connector" ? "fabric_connector" : "browser",
      ws,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };
    sessionManager.add(session);

    ws.on("message", async (raw) => {
      const text = raw.toString();
      if (session.type === "fabric_connector") {
        await handleFabricMessage(session, text);
      } else {
        await handleBrowserMessage(session, text);
      }
    });

    ws.on("close", () => {
      const removed = sessionManager.remove(sessionId);
      if (removed?.identity) {
        playerManager.setConnected(removed.identity.uuid, false);
        sessionManager.broadcastToBrowsers({
          type: "player_left_nearby",
          uuid: removed.identity.uuid,
        });
        liveKitService.removeParticipant(removed.identity.uuid).catch(() => {});
      }
      logger.info({ sessionId }, "WebSocket closed");
    });

    ws.on("error", (err) => {
      logger.error({ err, sessionId }, "WebSocket error");
    });

    setTimeout(() => {
      if (!session.identity && session.type === "browser" && ws.readyState === WebSocket.OPEN) {
        send(ws, { type: "error", code: "AUTH_TIMEOUT", message: "Autentikasi timeout" } satisfies GatewayToBrowserMessage);
        ws.close();
      }
    }, 15_000);
  });
}

async function handleFabricMessage(session: ClientSession, raw: string): Promise<void> {
  const msg = parseMessage<FabricToGatewayMessage>(raw);
  if (!msg) return;

  switch (msg.type) {
    case "connector_auth": {
      if (!authService.verifyConnectorSecret(msg.secret)) {
        send(session.ws, { type: "connector_auth_fail", reason: "Invalid secret" } satisfies GatewayToFabricMessage);
        session.ws.close();
        return;
      }
      const existing = sessionManager.getFabricConnector();
      if (existing && existing.id !== session.id) {
        existing.ws.close();
      }
      sessionManager.add(session);
      send(session.ws, { type: "connector_auth_ok" } satisfies GatewayToFabricMessage);
      logger.info({ serverName: msg.serverName }, "Fabric connector authenticated");
      break;
    }

    case "player_join": {
      const state: PlayerState = {
        ...msg.player,
        dimension: msg.dimension,
        world: msg.world,
        position: msg.position,
        connected: true,
        lastUpdate: Date.now(),
      };
      playerManager.upsert(state);
      break;
    }

    case "player_leave": {
      playerManager.remove(msg.uuid);
      sessionManager.broadcastToBrowsers({
        type: "player_left_nearby",
        uuid: msg.uuid,
      });
      break;
    }

    case "player_move":
    case "player_dimension_change": {
      playerManager.updatePosition(msg.uuid, msg.position, msg.dimension, msg.world);
      break;
    }

    case "java_audio_frame": {
      logger.debug({ uuid: msg.uuid, seq: msg.sequence }, "Java audio frame received");
      break;
    }

    case "ping": {
      send(session.ws, { type: "pong", ts: msg.ts } satisfies GatewayToFabricMessage);
      session.lastPing = Date.now();
      break;
    }
  }
}

async function handleBrowserMessage(session: ClientSession, raw: string): Promise<void> {
  const msg = parseMessage<BrowserToGatewayMessage>(raw);
  if (!msg) return;

  switch (msg.type) {
    case "auth_request": {
      const result = authService.exchangeCode(msg.code);
      if (!result) {
        send(session.ws, {
          type: "auth_fail",
          reason: "Kode tidak valid atau sudah kadaluarsa",
        } satisfies GatewayToBrowserMessage);
        return;
      }

      sessionManager.bindIdentity(session.id, result.identity);

      let player = playerManager.get(result.identity.uuid);
      if (!player) {
        player = {
          ...result.identity,
          dimension: "minecraft:overworld",
          world: "world",
          position: { x: 0, y: 64, z: 0 },
          connected: true,
          lastUpdate: Date.now(),
        };
        playerManager.upsert(player);
      } else {
        playerManager.setConnected(result.identity.uuid, true);
      }

      const livekitToken = await liveKitService.createToken(result.identity.uuid, result.identity.username);

      send(session.ws, {
        type: "auth_ok",
        player: result.identity,
        sessionToken: result.sessionToken,
        livekitToken: livekitToken || "",
        livekitUrl: liveKitService.getLiveKitUrl(),
      } satisfies GatewayToBrowserMessage);

      logger.info(
        { uuid: result.identity.uuid, username: result.identity.username },
        "Browser client authenticated"
      );
      break;
    }

    case "auth_token": {
      const payload = authService.verifySession(msg.token);
      if (!payload || payload.type !== "browser") {
        send(session.ws, {
          type: "auth_fail",
          reason: "Token tidak valid",
        } satisfies GatewayToBrowserMessage);
        return;
      }
      sessionManager.bindIdentity(session.id, {
        uuid: payload.uuid,
        username: payload.username,
        platform: payload.platform,
      });
      playerManager.setConnected(payload.uuid, true);
      const livekitToken = await liveKitService.createToken(payload.uuid, payload.username);
      send(session.ws, {
        type: "auth_ok",
        player: {
          uuid: payload.uuid,
          username: payload.username,
          platform: payload.platform,
        },
        sessionToken: msg.token,
        livekitToken: livekitToken || "",
        livekitUrl: liveKitService.getLiveKitUrl(),
      } satisfies GatewayToBrowserMessage);
      break;
    }

    case "join_voice": {
      if (!session.identity) {
        send(session.ws, { type: "error", code: "NOT_AUTH", message: "Belum autentikasi" });
        return;
      }
      send(session.ws, {
        type: "voice_status",
        status: "connected",
      } satisfies GatewayToBrowserMessage);
      pushNearbyToBrowser(session);
      break;
    }

    case "leave_voice": {
      if (session.identity) {
        playerManager.setConnected(session.identity.uuid, false);
      }
      break;
    }

    case "mute": {
      if (session.identity) {
        playerManager.setMuted(session.identity.uuid, msg.muted);
      }
      break;
    }

    case "ping": {
      send(session.ws, { type: "pong", ts: msg.ts });
      session.lastPing = Date.now();
      break;
    }
  }
}

function pushNearbyToBrowser(session: ClientSession): void {
  if (!session.identity) return;
  const me = playerManager.get(session.identity.uuid);
  if (!me) return;

  const nearby = proximityEngine.getNearby(me, playerManager.getAll());
  sessionManager.send(session.id, {
    type: "nearby_players",
    players: nearby,
  } satisfies GatewayToBrowserMessage);
}

export function startProximityTicker(intervalMs = 1000): NodeJS.Timeout {
  return setInterval(() => {
    const browsers = sessionManager.getBrowserSessions();
    for (const session of browsers) {
      if (session.identity) {
        pushNearbyToBrowser(session);
      }
    }
    playerManager.cleanupStale();
    authService.cleanupExpiredCodes();
  }, intervalMs);
}
