/**
 * Shared protocol messages between Fabric Bridge ↔ Gateway ↔ Browser Client
 * Semua pesan menggunakan JSON over WebSocket.
 */

export type Platform = "java" | "bedrock";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerIdentity {
  uuid: string;
  username: string;
  platform: Platform;
  /** Hanya untuk Bedrock: XUID jika tersedia */
  xuid?: string;
}

export interface PlayerState extends PlayerIdentity {
  dimension: string;
  world: string;
  position: Vec3;
  connected: boolean;
  muted?: boolean;
  lastUpdate: number;
}

export type FabricToGatewayMessage =
  | { type: "connector_auth"; secret: string; serverName: string }
  | { type: "player_join"; player: PlayerIdentity; dimension: string; world: string; position: Vec3 }
  | { type: "player_leave"; uuid: string }
  | { type: "player_move"; uuid: string; position: Vec3; dimension: string; world: string }
  | { type: "player_dimension_change"; uuid: string; dimension: string; world: string; position: Vec3 }
  | { type: "java_audio_frame"; uuid: string; sequence: number; data: string; distance: number }
  | { type: "ping"; ts: number };

export type GatewayToFabricMessage =
  | { type: "connector_auth_ok" }
  | { type: "connector_auth_fail"; reason: string }
  | { type: "bedrock_audio_frame"; targetUuid: string; sourceUuid: string; sequence: number; data: string }
  | { type: "subscribe_java_to_bedrock"; javaUuid: string; bedrockUuids: string[] }
  | { type: "unsubscribe_java_from_bedrock"; javaUuid: string; bedrockUuids: string[] }
  | { type: "pong"; ts: number };

export type BrowserToGatewayMessage =
  | { type: "auth_request"; code: string }
  | { type: "auth_token"; token: string }
  | { type: "join_voice" }
  | { type: "leave_voice" }
  | { type: "mute"; muted: boolean }
  | { type: "ping"; ts: number };

export type GatewayToBrowserMessage =
  | { type: "auth_ok"; player: PlayerIdentity; sessionToken: string; livekitToken: string; livekitUrl: string }
  | { type: "auth_fail"; reason: string }
  | { type: "nearby_players"; players: Array<{ uuid: string; username: string; platform: Platform; distance: number }> }
  | { type: "player_joined_nearby"; player: { uuid: string; username: string; platform: Platform } }
  | { type: "player_left_nearby"; uuid: string }
  | { type: "voice_status"; status: "connecting" | "connected" | "disconnected" | "error"; message?: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; ts: number };

export interface LinkingCode {
  code: string;
  uuid: string;
  username: string;
  platform: Platform;
  expiresAt: number;
}
