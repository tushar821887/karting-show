import * as THREE from 'three';
import { Arena } from '../scene/arena';
import { CameraController } from '../scene/camera-controller';
import { InputManager } from '../controls/input-manager';
import { KartModel } from '../kart/kart-model';
import { KartController } from '../kart/kart-controller';
import { ParticleSystem } from '../effects/particle-system';
import { PhysicsWorld } from '../physics/physics-world';
import { InterpolationManager } from '../network/interpolation-manager';
import { ProjectileManager } from '../weapons/projectile-manager';
import { RoomPlayer, PlayerInputState, GameSnapshot, PlayerGameState } from '@kart-battle/shared';

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  localPlayer: {
    id: string;
    name: string;
    color: string;
    isHost?: boolean;
  };
  remotePlayers?: RoomPlayer[];
  onHudUpdate?: (hudState: {
    speed: number;
    health: number;
    isBoosting: boolean;
    boostAvailable: boolean;
    boostCooldownRemainingMs: number;
  }) => void;
  onFireWeapon?: () => void;
  onSendInput?: (input: PlayerInputState) => void;
}

export class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraController: CameraController;
  private inputManager: InputManager;
  private arena: Arena;
  private particles: ParticleSystem;
  public physicsWorld!: PhysicsWorld;
  private interpolationManager: InterpolationManager;
  private projectileManager: ProjectileManager;

  public localKart: KartController;
  public remoteKarts: Map<string, KartModel> = new Map();

  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private options: GameEngineOptions;

  // Input transmission throttler (~30Hz)
  private inputTimer: number = 0;
  private readonly inputInterval: number = 1 / 30; // 33.3ms

  public static async create(options: GameEngineOptions): Promise<GameEngine> {
    await PhysicsWorld.init();
    const engine = new GameEngine(options);
    return engine;
  }

  constructor(options: GameEngineOptions) {
    this.options = options;
    const width = options.canvas.clientWidth || window.innerWidth;
    const height = options.canvas.clientHeight || window.innerHeight;

    // 1. Three.js Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c16);
    this.scene.fog = new THREE.FogExp2(0x0a0c16, 0.015);

    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Arena
    this.arena = new Arena();
    this.scene.add(this.arena.group);

    // 3. Rapier Physics World
    this.physicsWorld = new PhysicsWorld();
    this.physicsWorld.createObstacles(this.arena.colliders);

    // 4. Interpolation Manager
    this.interpolationManager = new InterpolationManager();

    // 5. Projectiles Layer
    this.projectileManager = new ProjectileManager(this.scene);

    // 6. Particles
    this.particles = new ParticleSystem();
    this.scene.add(this.particles.points);

    // 6. Local Kart Model & RigidBody
    const initialPos = new THREE.Vector3(0, 0, 18);
    const initialRot = Math.PI; // Face arena center
    const localModel = new KartModel({
      name: options.localPlayer.name,
      color: options.localPlayer.color,
      isHost: options.localPlayer.isHost
    });
    this.scene.add(localModel.mesh);

    this.localKart = new KartController(localModel, initialPos, initialRot);
    const kartBody = this.physicsWorld.createKartRigidBody(
      options.localPlayer.id,
      initialPos,
      initialRot
    );
    this.localKart.attachRigidBody(kartBody);

    // 7. Remote Karts
    if (options.remotePlayers) {
      options.remotePlayers.forEach((rp, idx) => {
        if (rp.id === options.localPlayer.id) return;
        this.addRemotePlayer(rp, idx + 1);
      });
    }

    // 8. Camera
    this.cameraController = new CameraController(width, height);
    this.cameraController.reset(this.localKart.position, this.localKart.rotation);

    // 9. Inputs
    this.inputManager = new InputManager();
    this.inputManager.attach();
    this.inputManager.onFireTrigger = () => {
      this.options.onFireWeapon?.();
    };
    this.inputManager.onBoostTrigger = () => {
      this.localKart.activateBoost();
    };
  }

  public addRemotePlayer(player: RoomPlayer, index: number): void {
    if (this.remoteKarts.has(player.id)) return;

    const angle = (index / 8) * Math.PI * 2;
    const r = 18;
    const x = Math.sin(angle) * r;
    const z = Math.cos(angle) * r;

    const remoteModel = new KartModel({
      name: player.name,
      color: player.color,
      isHost: player.isHost
    });
    remoteModel.mesh.position.set(x, 0, z);
    remoteModel.mesh.rotation.y = angle + Math.PI;
    this.scene.add(remoteModel.mesh);

    this.remoteKarts.set(player.id, remoteModel);
  }

  public spawnRemotePlayerFromState(player: PlayerGameState): void {
    if (this.remoteKarts.has(player.id) || player.id === this.options.localPlayer.id) return;

    const remoteModel = new KartModel({
      name: player.name,
      color: player.color,
      isHost: false
    });
    remoteModel.mesh.position.set(
      player.physics.position.x,
      player.physics.position.y,
      player.physics.position.z
    );
    remoteModel.mesh.rotation.y = player.physics.rotation;
    remoteModel.setHealth(player.health, player.maxHealth);
    this.scene.add(remoteModel.mesh);

    this.remoteKarts.set(player.id, remoteModel);
  }

  public removeRemotePlayer(playerId: string): void {
    const model = this.remoteKarts.get(playerId);
    if (model) {
      this.scene.remove(model.mesh);
      model.dispose();
      this.remoteKarts.delete(playerId);
    }
  }

  public applySnapshot(snapshot: GameSnapshot): void {
    this.interpolationManager.pushSnapshot(snapshot);

    // Sync visual rockets & explosions
    this.projectileManager.syncProjectiles(snapshot.projectiles);
    if (snapshot.explosions) {
      snapshot.explosions.forEach((exp) => this.projectileManager.triggerExplosion(exp));
    }

    // Server Reconciliation for Local Player
    const serverSelf = snapshot.players.find((p) => p.id === this.options.localPlayer.id);
    if (serverSelf) {
      if (serverSelf.isEliminated) {
        this.localKart.model.setEliminated(true);
      }

      if (!serverSelf.isEliminated) {
        const serverPos = new THREE.Vector3(
          serverSelf.physics.position.x,
          serverSelf.physics.position.y,
          serverSelf.physics.position.z
        );

        const error = this.localKart.position.distanceTo(serverPos);

        // Smooth reconciliation if minor drift (< 3.0 units)
        if (error > 0.25 && error < 3.0) {
          this.localKart.position.lerp(serverPos, 0.2);
          if (this.localKart.rigidBody) {
            this.localKart.rigidBody.setTranslation(
              { x: this.localKart.position.x, y: this.localKart.position.y + 0.4, z: this.localKart.position.z },
              true
            );
          }
        } else if (error >= 3.0) {
          // Hard snap if major desync/teleport
          this.localKart.setPosition(serverPos, serverSelf.physics.rotation);
        }
      }

      // Sync Health
      this.localKart.model.setHealth(serverSelf.health, serverSelf.maxHealth);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // 1. Sample inputs and send to server at ~30Hz
    const inputSnapshot = this.inputManager.getSnapshot();

    this.inputTimer += dt;
    if (this.inputTimer >= this.inputInterval) {
      this.inputTimer = 0;
      this.options.onSendInput?.(inputSnapshot);
    }

    // 2. Client-side prediction for local kart
    this.localKart.update(inputSnapshot, this.arena.colliders, dt, this.physicsWorld);
    this.physicsWorld.step(dt);

    // 3. Snapshot interpolation for remote karts
    this.interpolationManager.updateRemoteKarts(this.remoteKarts, dt, (p) => {
      this.spawnRemotePlayerFromState(p);
    });

    // 4. Update exhaust and nitro flame particles
    if (Math.abs(this.localKart.speed) > 2 || this.localKart.isBoosting) {
      const forwardX = Math.sin(this.localKart.rotation);
      const forwardZ = Math.cos(this.localKart.rotation);
      const pipePos = new THREE.Vector3(
        this.localKart.position.x - forwardX * 1.4,
        this.localKart.position.y + 0.4,
        this.localKart.position.z - forwardZ * 1.4
      );
      this.particles.emitFlame(pipePos, this.localKart.rotation, this.localKart.isBoosting);
    }

    // 5. Update arena animations
    this.arena.update(dt);

    // 6. Update projectiles and explosions
    this.projectileManager.update(dt);

    // 7. Update particles
    this.particles.update(dt);

    // 8. Update Camera
    this.cameraController.update(
      this.localKart.position,
      this.localKart.rotation,
      this.localKart.isBoosting,
      dt
    );

    // 8. Telemetry callback for HUD
    this.options.onHudUpdate?.({
      speed: Math.round(Math.abs(this.localKart.speed * 3.6)),
      health: 100,
      isBoosting: this.localKart.isBoosting,
      boostAvailable: this.localKart.boostAvailable,
      boostCooldownRemainingMs: this.localKart.boostCooldownRemainingMs
    });
  }

  private render(): void {
    this.renderer.render(this.scene, this.cameraController.camera);
  }

  public resize(width: number, height: number): void {
    this.cameraController.resize(width, height);
    this.renderer.setSize(width, height);
  }

  public destroy(): void {
    this.stop();
    this.inputManager.detach();

    this.arena.dispose();
    this.particles.dispose();
    this.projectileManager.dispose();
    this.localKart.model.dispose();

    this.remoteKarts.forEach((model) => model.dispose());
    this.remoteKarts.clear();

    this.physicsWorld.destroy();
    this.renderer.dispose();
  }
}
