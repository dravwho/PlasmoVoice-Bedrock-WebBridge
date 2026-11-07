import { PlayerState, Platform, Vec3 } from "../../../../packages/protocol/src/messages.js";
import { logger } from "../config/logger.js";

/**
 * In-memory store untuk semua player yang terhubung (Java + Bedrock).
 * Sumber kebenaran posisi & dimension hanya dari Fabric connector.
 */
export class PlayerManager {
  private players = new Map<string, PlayerState>();

  upsert(player: PlayerState): void {
    this.players.set(player.uuid, { ...player, lastUpdate: Date.now() });
    logger.debug({ uuid: player.uuid, username: player.username, platform: player.platform }, "Player upsert");
  }

  remove(uuid: string): PlayerState | undefined {
    const existing = this.players.get(uuid);
    if (existing) {
      this.players.delete(uuid);
      logger.debug({ uuid, username: existing.username }, "Player removed");
    }
    return existing;
  }

  get(uuid: string): PlayerState | undefined {
    return this.players.get(uuid);
  }

  getAll(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getByPlatform(platform: Platform): PlayerState[] {
    return this.getAll().filter((p) => p.platform === platform);
  }

  updatePosition(uuid: string, position: Vec3, dimension: string, world: string): void {
    const p = this.players.get(uuid);
    if (!p) return;
    p.position = position;
    p.dimension = dimension;
    p.world = world;
    p.lastUpdate = Date.now();
  }

  setConnected(uuid: string, connected: boolean): void {
    const p = this.players.get(uuid);
    if (p) {
      p.connected = connected;
      p.lastUpdate = Date.now();
    }
  }

  setMuted(uuid: string, muted: boolean): void {
    const p = this.players.get(uuid);
    if (p) {
      p.muted = muted;
    }
  }

  cleanupStale(maxAgeMs = 120_000): number {
    const now = Date.now();
    let removed = 0;
    for (const [uuid, p] of this.players) {
      if (now - p.lastUpdate > maxAgeMs) {
        this.players.delete(uuid);
        removed++;
        logger.warn({ uuid, username: p.username }, "Stale player cleaned up");
      }
    }
    return removed;
  }
}

export const playerManager = new PlayerManager();
