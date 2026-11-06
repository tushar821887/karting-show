import { Vector3D } from './player.interface';

export interface RocketState {
  id: string;
  ownerId: string;
  position: Vector3D;
  velocity: Vector3D;
  rotation: number;
  distanceTraveled: number;
  maxDistance: number;
  createdAt: number;
  active: boolean;
}

export interface WeaponFirePayload {
  timestamp: number;
}

export interface ExplosionEvent {
  id: string;
  position: Vector3D;
  radius: number;
  attackerId: string;
  affectedPlayerIds: string[];
  timestamp: number;
}
