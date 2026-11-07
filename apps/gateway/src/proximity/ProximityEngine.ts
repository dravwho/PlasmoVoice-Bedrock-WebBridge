import { PlayerState, Vec3 } from "../../../../packages/protocol/src/messages.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface NearbyResult {
  uuid: string;
  username: string;
  platform: PlayerState["platform"];
  distance: number;
}

export class ProximityEngine {
  private maxDistance: number;
  private sameDimensionOnly: boolean;

  constructor() {
    this.maxDistance = config.PROXIMITY_MAX_DISTANCE;
    this.sameDimensionOnly = config.PROXIMITY_SAME_DIMENSION_ONLY;
  }

  updateConfig(maxDistance?: number, sameDimensionOnly?: boolean): void {
    if (maxDistance !== undefined) this.maxDistance = maxDistance;
    if (sameDimensionOnly !== undefined) this.sameDimensionOnly = sameDimensionOnly;
  }

  getNearby(listener: PlayerState, allPlayers: PlayerState[]): NearbyResult[] {
    if (!config.PROXIMITY_ENABLED) {
      return allPlayers
        .filter((p) => p.uuid !== listener.uuid && p.connected)
        .map((p) => ({
          uuid: p.uuid,
          username: p.username,
          platform: p.platform,
          distance: 0,
        }));
    }

    const result: NearbyResult[] = [];

    for (const other of allPlayers) {
      if (other.uuid === listener.uuid) continue;
      if (!other.connected) continue;

      if (this.sameDimensionOnly && other.dimension !== listener.dimension) {
        continue;
      }

      if (other.world !== listener.world) continue;

      const dist = distance(listener.position, other.position);
      if (dist <= this.maxDistance) {
        result.push({
          uuid: other.uuid,
          username: other.username,
          platform: other.platform,
          distance: dist,
        });
      }
    }

    return result;
  }

  canHear(a: PlayerState, b: PlayerState): boolean {
    if (!a.connected || !b.connected) return false;
    if (a.uuid === b.uuid) return false;
    if (this.sameDimensionOnly && a.dimension !== b.dimension) return false;
    if (a.world !== b.world) return false;
    if (!config.PROXIMITY_ENABLED) return true;
    return distance(a.position, b.position) <= this.maxDistance;
  }

  volumeFactor(dist: number): number {
    if (!config.PROXIMITY_FALLOFF) return 1;
    const min = config.PROXIMITY_MIN_DISTANCE;
    const max = this.maxDistance;
    if (dist <= min) return 1;
    if (dist >= max) return 0;
    return 1 - (dist - min) / (max - min);
  }
}

export const proximityEngine = new ProximityEngine();
