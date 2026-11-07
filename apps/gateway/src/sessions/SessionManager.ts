import { WebSocket } from "ws";
import { PlayerIdentity, Platform } from "../../../../packages/protocol/src/messages.js";
import { logger } from "../config/logger.js";

export type ClientType = "fabric_connector" | "browser";

export interface ClientSession {
  id: string;
  type: ClientType;
  ws: WebSocket;
  identity?: PlayerIdentity;
  connectedAt: number;
  lastPing: number;
  livekitIdentity?: string;
}

export class SessionManager {
  private sessions = new Map<string, ClientSession>();
  private byUuid = new Map<string, string>();
  private fabricConnector: ClientSession | null = null;

  add(session: ClientSession): void {
    this.sessions.set(session.id, session);
    if (session.identity) {
      this.byUuid.set(session.identity.uuid, session.id);
    }
    if (session.type === "fabric_connector") {
      this.fabricConnector = session;
    }
    logger.debug({ id: session.id, type: session.type }, "Session added");
  }

  remove(sessionId: string): ClientSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    this.sessions.delete(sessionId);
    if (session.identity) {
      this.byUuid.delete(session.identity.uuid);
    }
    if (this.fabricConnector?.id === sessionId) {
      this.fabricConnector = null;
      logger.warn("Fabric connector disconnected");
    }
    logger.debug({ id: sessionId, type: session.type }, "Session removed");
    return session;
  }

  get(sessionId: string): ClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  getByUuid(uuid: string): ClientSession | undefined {
    const id = this.byUuid.get(uuid);
    return id ? this.sessions.get(id) : undefined;
  }

  getFabricConnector(): ClientSession | null {
    return this.fabricConnector;
  }

  getBrowserSessions(): ClientSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.type === "browser");
  }

  bindIdentity(sessionId: string, identity: PlayerIdentity): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.identity = identity;
    this.byUuid.set(identity.uuid, sessionId);
  }

  send(sessionId: string, data: unknown): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return false;
    try {
      session.ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      logger.error({ err, sessionId }, "Failed to send message");
      return false;
    }
  }

  sendToFabric(data: unknown): boolean {
    if (!this.fabricConnector) return false;
    return this.send(this.fabricConnector.id, data);
  }

  broadcastToBrowsers(data: unknown, exceptUuid?: string): void {
    for (const session of this.getBrowserSessions()) {
      if (exceptUuid && session.identity?.uuid === exceptUuid) continue;
      this.send(session.id, data);
    }
  }
}

export const sessionManager = new SessionManager();
