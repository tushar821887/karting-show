import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONSTANTS, PlayerInputState } from '@kart-battle/shared';
import { KartModel } from './kart-model';
import { ObstacleCollider } from '../scene/arena';
import { PhysicsWorld } from '../physics/physics-world';

export class KartController {
  public readonly position: THREE.Vector3 = new THREE.Vector3();
  public rotation: number = 0; // Yaw angle in radians
  public speed: number = 0;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isBoosting: boolean = false;
  public isDrifting: boolean = false;

  // Rapier RigidBody handle
  public rigidBody: RAPIER.RigidBody | null = null;

  // Boost cooldowns
  public boostAvailable: boolean = true;
  public boostRemainingMs: number = 0;
  public boostCooldownRemainingMs: number = 0;

  // Steering visual angle for front wheels
  public steeringVisualAngle: number = 0;

  constructor(
    public readonly model: KartModel,
    initialPosition?: THREE.Vector3,
    initialRotation?: number
  ) {
    if (initialPosition) {
      this.position.copy(initialPosition);
    }
    if (initialRotation !== undefined) {
      this.rotation = initialRotation;
    }
    this.updateModelTransform();
  }

  public attachRigidBody(body: RAPIER.RigidBody): void {
    this.rigidBody = body;
  }

  public activateBoost(): boolean {
    if (!this.boostAvailable) return false;

    this.boostAvailable = false;
    this.isBoosting = true;
    this.boostRemainingMs = GAME_CONSTANTS.BOOST_DURATION_MS;
    this.boostCooldownRemainingMs = GAME_CONSTANTS.BOOST_COOLDOWN_MS;
    return true;
  }

  public update(
    input: PlayerInputState,
    colliders: ObstacleCollider[],
    dt: number,
    physicsWorld?: PhysicsWorld
  ): void {
    // If eliminated, cannot move
    if (this.model.isEliminated) {
      this.speed = 0;
      this.isBoosting = false;
      if (this.rigidBody) {
        this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      return;
    }
    // 1. Boost timers
    if (this.isBoosting) {
      this.boostRemainingMs -= dt * 1000;
      if (this.boostRemainingMs <= 0) {
        this.isBoosting = false;
        this.boostRemainingMs = 0;
      }
    }

    if (!this.boostAvailable) {
      this.boostCooldownRemainingMs -= dt * 1000;
      if (this.boostCooldownRemainingMs <= 0) {
        this.boostAvailable = true;
        this.boostCooldownRemainingMs = 0;
      }
    }

    // Manual boost trigger from input
    if (input.boost && this.boostAvailable) {
      this.activateBoost();
    }

    // 2. Rapier.js Physics Simulation
    if (this.rigidBody && physicsWorld) {
      const { speed, yaw } = physicsWorld.applyKartInput(
        this.rigidBody,
        input,
        this.isBoosting,
        dt
      );

      this.speed = speed;
      this.rotation = yaw;

      const trans = this.rigidBody.translation();
      this.position.set(trans.x, trans.y - 0.4, trans.z);

      const linVel = this.rigidBody.linvel();
      this.velocity.set(linVel.x, linVel.y, linVel.z);

      // Visual steering angle for front wheels
      let targetSteerAngle = 0;
      if (input.left) targetSteerAngle -= 0.45;
      if (input.right) targetSteerAngle += 0.45;
      this.steeringVisualAngle +=
        (targetSteerAngle - this.steeringVisualAngle) * (1 - Math.exp(-12 * dt));

      this.updateModelTransform();
      this.model.update(this.speed, this.steeringVisualAngle, dt);
      return;
    }

    // 3. Fallback Kinematic Arcade Movement
    const maxSpeed = this.isBoosting
      ? GAME_CONSTANTS.KART_MAX_SPEED * GAME_CONSTANTS.BOOST_SPEED_MULTIPLIER
      : GAME_CONSTANTS.KART_MAX_SPEED;

    const reverseMaxSpeed = GAME_CONSTANTS.KART_REVERSE_MAX_SPEED;

    if (input.forward) {
      const accel = this.isBoosting
        ? GAME_CONSTANTS.KART_ACCELERATION * 1.5
        : GAME_CONSTANTS.KART_ACCELERATION;
      this.speed = Math.min(maxSpeed, this.speed + accel * dt);
    } else if (input.backward) {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - GAME_CONSTANTS.KART_BRAKING * dt);
      } else {
        this.speed = Math.max(
          -reverseMaxSpeed,
          this.speed - GAME_CONSTANTS.KART_ACCELERATION * 0.6 * dt
        );
      }
    } else {
      if (Math.abs(this.speed) > 0.05) {
        this.speed *= Math.pow(GAME_CONSTANTS.KART_FRICTION, dt * 60);
      } else {
        this.speed = 0;
      }
    }

    let targetSteerAngle = 0;
    if (input.left) targetSteerAngle -= 0.45;
    if (input.right) targetSteerAngle += 0.45;

    this.steeringVisualAngle +=
      (targetSteerAngle - this.steeringVisualAngle) * (1 - Math.exp(-12 * dt));

    const speedRatio = Math.min(1.0, Math.abs(this.speed) / (GAME_CONSTANTS.KART_MAX_SPEED * 0.4));
    const turnDirection = this.speed >= 0 ? 1 : -1;

    if (Math.abs(targetSteerAngle) > 0.01 && speedRatio > 0.05) {
      const turnAmount =
        targetSteerAngle * GAME_CONSTANTS.KART_TURN_SPEED * speedRatio * turnDirection * dt;
      this.rotation -= turnAmount;
    }

    const forwardX = Math.sin(this.rotation);
    const forwardZ = Math.cos(this.rotation);

    this.velocity.set(forwardX * this.speed, 0, forwardZ * this.speed);
    this.position.addScaledVector(this.velocity, dt);

    this.handleBoundaryCollisions();
    this.handleObstacleCollisions(colliders);

    this.updateModelTransform();
    this.model.update(this.speed, this.steeringVisualAngle, dt);
  }

  private handleBoundaryCollisions(): void {
    const arenaRadius = GAME_CONSTANTS.ARENA_RADIUS - 1.5;
    const currentDist = Math.sqrt(this.position.x ** 2 + this.position.z ** 2);

    if (currentDist > arenaRadius) {
      const angle = Math.atan2(this.position.z, this.position.x);
      this.position.x = Math.cos(angle) * arenaRadius;
      this.position.z = Math.sin(angle) * arenaRadius;
      this.speed = -this.speed * 0.35;
    }
  }

  private handleObstacleCollisions(colliders: ObstacleCollider[]): void {
    const kartRadius = 1.0;

    for (const obs of colliders) {
      if (obs.type === 'cylinder') {
        const obsRadius = obs.radius || 1.2;
        const totalRadius = kartRadius + obsRadius;

        const dx = this.position.x - obs.position.x;
        const dz = this.position.z - obs.position.z;
        const dist = Math.sqrt(dx ** 2 + dz ** 2);

        if (dist < totalRadius && dist > 0.001) {
          const overlap = totalRadius - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          this.position.x += nx * overlap;
          this.position.z += nz * overlap;
          this.speed *= 0.6;
        }
      } else if (obs.type === 'box' && obs.size) {
        const halfW = obs.size.x / 2 + kartRadius;
        const halfD = obs.size.z / 2 + kartRadius;

        const dx = this.position.x - obs.position.x;
        const dz = this.position.z - obs.position.z;

        if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
          const overlapX = halfW - Math.abs(dx);
          const overlapZ = halfD - Math.abs(dz);

          if (overlapX < overlapZ) {
            this.position.x += dx > 0 ? overlapX : -overlapX;
          } else {
            this.position.z += dz > 0 ? overlapZ : -overlapZ;
          }
          this.speed *= 0.6;
        }
      }
    }
  }

  private updateModelTransform(): void {
    this.model.mesh.position.copy(this.position);
    this.model.mesh.rotation.y = this.rotation;
  }

  public setPosition(pos: { x: number; y: number; z: number }, rotation: number): void {
    this.position.set(pos.x, pos.y, pos.z);
    this.rotation = rotation;
    if (this.rigidBody) {
      const halfYaw = rotation / 2;
      this.rigidBody.setTranslation({ x: pos.x, y: pos.y + 0.4, z: pos.z }, true);
      this.rigidBody.setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) }, true);
      this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.updateModelTransform();
  }
}
