import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "crypto";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { LinkingCode, PlayerIdentity, Platform } from "../../../../packages/protocol/src/messages.js";

interface SessionPayload {
  uuid: string;
  username: string;
  platform: Platform;
  type: "browser" | "connector";
}

/**
 * Auth service:
 * - Connector Fabric diautentikasi dengan shared secret.
 * - Browser Bedrock diautentikasi lewat one-time code yang dihasilkan di Minecraft.
 */
export class AuthService {
  private linkingCodes = new Map<string, LinkingCode>();

  /** Verifikasi secret dari Fabric connector */
  verifyConnectorSecret(secret: string): boolean {
    const expected = Buffer.from(config.MINECRAFT_CONNECTOR_SECRET);
    const received = Buffer.from(secret);
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }

  /**
   * Buat kode one-time singkat (6 digit) untuk linking browser ↔ Minecraft player.
   * Dipanggil dari Fabric bridge ketika player menjalankan perintah /voice link
   */
  createLinkingCode(identity: PlayerIdentity): LinkingCode {
    for (const [code, data] of this.linkingCodes) {
      if (data.uuid === identity.uuid) {
        this.linkingCodes.delete(code);
      }
    }

    const code = this.generateShortCode();
    const entry: LinkingCode = {
      code,
      uuid: identity.uuid,
      username: identity.username,
      platform: identity.platform,
      expiresAt: Date.now() + config.TOKEN_TTL_SECONDS * 1000,
    };
    this.linkingCodes.set(code, entry);

    setTimeout(() => {
      this.linkingCodes.delete(code);
    }, config.TOKEN_TTL_SECONDS * 1000 + 1000);

    logger.info({ uuid: identity.uuid, username: identity.username, code }, "Linking code created");
    return entry;
  }

  /** Tukar kode menjadi session token */
  exchangeCode(code: string): { identity: PlayerIdentity; sessionToken: string } | null {
    const entry = this.linkingCodes.get(code);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.linkingCodes.delete(code);
      return null;
    }

    this.linkingCodes.delete(code);

    const identity: PlayerIdentity = {
      uuid: entry.uuid,
      username: entry.username,
      platform: entry.platform,
    };

    const sessionToken = this.signSession(identity, "browser");
    return { identity, sessionToken };
  }

  signSession(identity: PlayerIdentity, type: "browser" | "connector"): string {
    const payload: SessionPayload = {
      uuid: identity.uuid,
      username: identity.username,
      platform: identity.platform,
      type,
    };
    return jwt.sign(payload, config.SESSION_SECRET, {
      expiresIn: config.SESSION_TTL_SECONDS,
    });
  }

  verifySession(token: string): SessionPayload | null {
    try {
      const payload = jwt.verify(token, config.SESSION_SECRET) as SessionPayload;
      return payload;
    } catch {
      return null;
    }
  }

  private generateShortCode(): string {
    const num = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
    return num.toString().padStart(6, "0");
  }

  cleanupExpiredCodes(): number {
    const now = Date.now();
    let removed = 0;
    for (const [code, entry] of this.linkingCodes) {
      if (now > entry.expiresAt) {
        this.linkingCodes.delete(code);
        removed++;
      }
    }
    return removed;
  }
}

export const authService = new AuthService();
