import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONSTANTS, PlayerInputState } from '@kart-battle/shared';
import { ObstacleCollider } from '../scene/arena';

export class PhysicsWorld {
  private static isInitialized = false;
  public world!: RAPIER.World;
  private kartBodies: Map<string, RAPIER.RigidBody> = new Map();
  private eventQueue!: RAPIER.EventQueue;

  public static async init(): Promise<void> {
    if (!PhysicsWorld.isInitialized) {
      await RAPIER.init();
      PhysicsWorld.isInitialized = true;
      console.log('[PhysicsWorld] Rapier3D WASM initialized successfully');
    }
  }

  constructor() {
    const gravity = { x: 0.0, y: -25.0, z: 0.0 }; // Strong arcade gravity
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);

    this.createFloor();
    this.createBoundaryWalls(GAME_CONSTANTS.ARENA_RADIUS);
  }

  private createFloor(): void {
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const floorBody = this.world.createRigidBody(floorBodyDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(60.0, 0.5, 60.0)
      .setFriction(0.6)
      .setRestitution(0.1);
    this.world.createCollider(floorColliderDesc, floorBody);
  }

  public createBoundaryWalls(radius: number): void {
    const segments = 48;
    const height = 4.0;
    const thickness = 1.0;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;

      // Chord width of each segment
      const chord = 2 * radius * Math.sin(Math.PI / segments) * 1.05;

      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, height / 2, z)
        .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });

      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(chord / 2, height / 2, thickness / 2)
        .setRestitution(0.4) // Arcade bounce off boundary
        .setFriction(0.3);

      this.world.createCollider(colliderDesc, body);
    }
  }

  public createObstacles(colliders: ObstacleCollider[]): void {
    for (const obs of colliders) {
      if (obs.type === 'box' && obs.size) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
          obs.position.x,
          obs.position.y,
          obs.position.z
        );
        const body = this.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(
          obs.size.x / 2,
          obs.size.y / 2,
          obs.size.z / 2
        )
          .setRestitution(0.3)
          .setFriction(0.5);

        this.world.createCollider(colDesc, body);
      } else if (obs.type === 'cylinder' && obs.radius) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
          obs.position.x,
          obs.position.y,
          obs.position.z
        );
        const body = this.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cylinder(2.0, obs.radius)
          .setRestitution(0.3)
          .setFriction(0.5);

        this.world.createCollider(colDesc, body);
      }
    }
  }

  public createKartRigidBody(
    id: string,
    initialPos: { x: number; y: number; z: number },
    initialYaw: number = 0
  ): RAPIER.RigidBody {
    // Dynamic body with locked X and Z rotations to keep kart upright
    const halfYaw = initialYaw / 2;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(initialPos.x, initialPos.y + 0.4, initialPos.z)
      .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
      .setLinearDamping(0.6)
      .setAngularDamping(3.0)
      .enabledRotations(false, true, false); // Lock pitch & roll, allow yaw

    const body = this.world.createRigidBody(bodyDesc);

    // Kart collider (capsule or cuboid)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.85, 0.35, 1.3)
      .setFriction(0.5)
      .setRestitution(0.2)
      .setDensity(1.5);

    this.world.createCollider(colliderDesc, body);
    this.kartBodies.set(id, body);
    return body;
  }

  public removeKartRigidBody(id: string): void {
    const body = this.kartBodies.get(id);
    if (body) {
      this.world.removeRigidBody(body);
      this.kartBodies.delete(id);
    }
  }

  public applyKartInput(
    body: RAPIER.RigidBody,
    input: PlayerInputState,
    isBoosting: boolean,
    dt: number
  ): { speed: number; yaw: number } {
    const rot = body.rotation();
    // Calculate yaw angle from quaternion where x=0, z=0
    const yaw = 2 * Math.atan2(rot.y, rot.w);

    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);

    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const linVel = body.linvel();
    // Forward velocity scalar
    const forwardSpeed = linVel.x * forwardX + linVel.z * forwardZ;
    // Lateral (drift/sideways) velocity scalar
    const lateralSpeed = linVel.x * rightX + linVel.z * rightZ;

    // 1. Propulsion Force
    const accelForce = isBoosting ? 1800 : 1100;
    const brakeForce = 1500;
    const maxSpeed = isBoosting
      ? GAME_CONSTANTS.KART_MAX_SPEED * GAME_CONSTANTS.BOOST_SPEED_MULTIPLIER
      : GAME_CONSTANTS.KART_MAX_SPEED;

    if (input.forward && forwardSpeed < maxSpeed) {
      body.applyImpulse({ x: forwardX * accelForce * dt, y: 0, z: forwardZ * accelForce * dt }, true);
    } else if (input.backward) {
      if (forwardSpeed > 0.5) {
        // Braking
        body.applyImpulse({ x: -forwardX * brakeForce * dt, y: 0, z: -forwardZ * brakeForce * dt }, true);
      } else if (forwardSpeed > -GAME_CONSTANTS.KART_REVERSE_MAX_SPEED) {
        // Reverse
        body.applyImpulse({ x: -forwardX * (accelForce * 0.6) * dt, y: 0, z: -forwardZ * (accelForce * 0.6) * dt }, true);
      }
    }

    // 2. Lateral Tire Grip (counteract sideways drift, allowing slight slide)
    const lateralGripFactor = input.drift ? 0.82 : 0.94;
    const lateralImpulse = -lateralSpeed * lateralGripFactor * body.mass();
    body.applyImpulse({ x: rightX * lateralImpulse, y: 0, z: rightZ * lateralImpulse }, true);

    // 3. Steering Torque (proportional to forward movement)
    let steerInput = 0;
    if (input.left) steerInput += 1;
    if (input.right) steerInput -= 1;

    if (steerInput !== 0) {
      const speedFactor = Math.min(1.0, Math.abs(forwardSpeed) / (GAME_CONSTANTS.KART_MAX_SPEED * 0.35));
      const turnSign = forwardSpeed >= 0 ? 1 : -1;
      const torque = steerInput * turnSign * speedFactor * 32.0;

      body.setAngvel({ x: 0, y: torque, z: 0 }, true);
    } else {
      // Dampen angular velocity when not steering
      const currentAngVel = body.angvel();
      body.setAngvel({ x: 0, y: currentAngVel.y * 0.85, z: 0 }, true);
    }

    // Keep kart grounded if slightly airborne
    const pos = body.translation();
    if (pos.y < 0.25) {
      body.setTranslation({ x: pos.x, y: 0.35, z: pos.z }, true);
      body.setLinvel({ x: linVel.x, y: 0, z: linVel.z }, true);
    }

    return {
      speed: forwardSpeed,
      yaw
    };
  }

  public step(dt: number): void {
    // Fixed sub-stepping for deterministic physics
    this.world.timestep = Math.min(0.033, dt);
    this.world.step(this.eventQueue);
  }

  public destroy(): void {
    this.kartBodies.clear();
    this.world.free();
  }
}
