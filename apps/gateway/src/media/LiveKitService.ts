import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

export class LiveKitService {
  private roomService: RoomServiceClient | null = null;
  private enabled = false;

  constructor() {
    if (config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET) {
      this.roomService = new RoomServiceClient(
        config.LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://"),
        config.LIVEKIT_API_KEY,
        config.LIVEKIT_API_SECRET
      );
      this.enabled = true;
      logger.info("LiveKit service enabled");
    } else {
      logger.warn("LiveKit credentials tidak lengkap — mode media akan terbatas");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async createToken(identity: string, username: string): Promise<string | null> {
    if (!this.enabled || !config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
      return null;
    }

    const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
      identity,
      name: username,
      ttl: config.SESSION_TTL_SECONDS,
    });

    at.addGrant({
      roomJoin: true,
      room: "survivalsculk-voice",
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  getLiveKitUrl(): string {
    return config.LIVEKIT_URL || "";
  }

  async removeParticipant(identity: string): Promise<void> {
    if (!this.roomService) return;
    try {
      await this.roomService.removeParticipant("survivalsculk-voice", identity);
    } catch (err) {
      logger.debug({ err, identity }, "removeParticipant failed (biasanya normal)");
    }
  }
}

export const liveKitService = new LiveKitService();
