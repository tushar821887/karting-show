import { RocketState, GAME_CONSTANTS, Vector3D } from '@kart-battle/shared';

export class WeaponService {
  private static instance: WeaponService;
  // Map of playerId -> lastRocketFiredTimestamp
  private lastFireTime: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): WeaponService {
    if (!WeaponService.instance) {
      WeaponService.instance = new WeaponService();
    }
    return WeaponService.instance;
  }

  public canFire(playerId: string, now: number = Date.now()): boolean {
    const last = this.lastFireTime.get(playerId) || 0;
    return now - last >= GAME_CONSTANTS.ROCKET_COOLDOWN_MS;
  }

  public getRemainingCooldown(playerId: string, now: number = Date.now()): number {
    const last = this.lastFireTime.get(playerId) || 0;
    const elapsed = now - last;
    return Math.max(0, GAME_CONSTANTS.ROCKET_COOLDOWN_MS - elapsed);
  }

  public createRocket(
    playerId: string,
    position: Vector3D,
    rotation: number,
    now: number = Date.now()
  ): RocketState | null {
    if (!this.canFire(playerId, now)) {
      return null;
    }

    this.lastFireTime.set(playerId, now);

    // Calculate velocity based on rotation yaw
    const forwardX = Math.sin(rotation);
    const forwardZ = Math.cos(rotation);

    const rocket: RocketState = {
      id: `rocket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ownerId: playerId,
      position: {
        x: position.x + forwardX * 2.2,
        y: position.y + 0.6,
        z: position.z + forwardZ * 2.2
      },
      velocity: {
        x: forwardX * GAME_CONSTANTS.ROCKET_SPEED,
        y: 0,
        z: forwardZ * GAME_CONSTANTS.ROCKET_SPEED
      },
      rotation,
      distanceTraveled: 0,
      maxDistance: GAME_CONSTANTS.ROCKET_MAX_RANGE,
      createdAt: now,
      active: true
    };

    return rocket;
  }

  public resetPlayer(playerId: string): void {
    this.lastFireTime.delete(playerId);
  }
}

export const weaponService = WeaponService.getInstance();
