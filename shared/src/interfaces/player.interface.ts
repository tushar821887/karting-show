export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion4D {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface PlayerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  fire: boolean;
  boost: boolean;
  sequenceNumber: number;
  timestamp: number;
}

export interface KartPhysicsState {
  position: Vector3D;
  rotation: number; // Yaw angle in radians
  velocity: Vector3D;
  speed: number;
  angularVelocity: number;
  isDrifting: boolean;
  isBoosting: boolean;
}

export interface PlayerGameState {
  id: string;
  name: string;
  color: string;
  kartIndex: number;
  health: number;
  maxHealth: number;
  isEliminated: boolean;
  kills: number;
  deaths: number;
  score: number;
  physics: KartPhysicsState;
  boostAvailable: boolean;
  boostRemainingMs: number;
  rocketCooldownRemainingMs: number;
  lastProcessedInputSequence: number;
}
