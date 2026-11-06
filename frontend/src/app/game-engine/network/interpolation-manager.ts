import * as THREE from 'three';
import { GameSnapshot, PlayerGameState } from '@kart-battle/shared';
import { KartModel } from '../kart/kart-model';

export class InterpolationManager {
  private snapshots: GameSnapshot[] = [];
  private readonly maxSnapshots = 30;
  private readonly interpolationDelayMs = 100; // ~3 server ticks buffer for smooth playback

  public pushSnapshot(snapshot: GameSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  public updateRemoteKarts(
    remoteKarts: Map<string, KartModel>,
    dt: number,
    onSpawnRemote?: (player: PlayerGameState) => void
  ): void {
    if (this.snapshots.length < 2) return;

    const renderTime = Date.now() - this.interpolationDelayMs;

    // Find the two surrounding snapshots s0 and s1
    let s0: GameSnapshot | null = null;
    let s1: GameSnapshot | null = null;

    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].timestamp <= renderTime) {
        s0 = this.snapshots[i];
        s1 = this.snapshots[i + 1] || s0;
        break;
      }
    }

    if (!s0 || !s1 || s0 === s1) {
      // Extrapolate from the latest snapshot if network lagged
      const latest = this.snapshots[this.snapshots.length - 1];
      if (latest) {
        latest.players.forEach((p) => {
          const model = remoteKarts.get(p.id);
          if (model) {
            model.mesh.position.set(p.physics.position.x, p.physics.position.y, p.physics.position.z);
            model.mesh.rotation.y = p.physics.rotation;
            model.setHealth(p.health, p.maxHealth);
            model.update(p.physics.speed, 0, dt);
          } else {
            onSpawnRemote?.(p);
          }
        });
      }
      return;
    }

    // Interpolation factor between s0 and s1
    const totalTime = s1.timestamp - s0.timestamp;
    const factor = totalTime > 0 ? (renderTime - s0.timestamp) / totalTime : 0;
    const t = Math.max(0, Math.min(1, factor));

    // Map s0 players by ID
    const s0PlayerMap = new Map(s0.players.map((p) => [p.id, p]));

    s1.players.forEach((p1) => {
      const p0 = s0PlayerMap.get(p1.id) || p1;
      let model = remoteKarts.get(p1.id);

      if (!model) {
        onSpawnRemote?.(p1);
        return;
      }

      // Linear interpolation of position
      const x = p0.physics.position.x + (p1.physics.position.x - p0.physics.position.x) * t;
      const y = p0.physics.position.y + (p1.physics.position.y - p0.physics.position.y) * t;
      const z = p0.physics.position.z + (p1.physics.position.z - p0.physics.position.z) * t;

      model.mesh.position.set(x, y, z);

      // Shortest-path angular interpolation for yaw
      const rotDiff = Math.atan2(
        Math.sin(p1.physics.rotation - p0.physics.rotation),
        Math.cos(p1.physics.rotation - p0.physics.rotation)
      );
      model.mesh.rotation.y = p0.physics.rotation + rotDiff * t;

      // Update Health
      model.setHealth(p1.health, p1.maxHealth);

      // Animate wheels
      const speed = p0.physics.speed + (p1.physics.speed - p0.physics.speed) * t;
      model.update(speed, 0, dt);
    });
  }

  public getAuthoritativePlayerState(playerId: string): PlayerGameState | null {
    if (this.snapshots.length === 0) return null;
    const latest = this.snapshots[this.snapshots.length - 1];
    return latest.players.find((p) => p.id === playerId) || null;
  }

  public clear(): void {
    this.snapshots = [];
  }
}
