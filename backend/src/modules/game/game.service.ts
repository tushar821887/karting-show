import { Server } from 'socket.io';
import {
  GameSnapshot,
  PlayerGameState,
  RocketState,
  ExplosionEvent,
  GAME_CONSTANTS,
  ServerToClientEvents,
  GameFinishedPayload,
  PlayerEliminatedPayload,
  RoomState,
  PlayerInputState
} from '@kart-battle/shared';
import { leaderboardService } from '../leaderboard/leaderboard.service';
import { weaponService } from '../weapons/weapon.service';
import { roomService } from '../rooms/room.service';
import { MatchModel } from '../../models/Match';

export class GameInstance {
  public matchId: string;
  public roomCode: string;
  public players: Map<string, PlayerGameState> = new Map();
  public projectiles: RocketState[] = [];
  public tick: number = 0;
  public startTime: number = 0;
  public isRunning: boolean = false;

  private playerInputs: Map<string, PlayerInputState> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private io: Server;

  // Obstacle definitions for server collision checking
  private obstacles = [
    // 4 Corner Bunkers (cuboids 4.5 x 4.5, half-extent 2.25 + 1.0 kart radius = 3.25)
    { x: 18, z: 18, halfW: 3.25, halfD: 3.25 },
    { x: -18, z: 18, halfW: 3.25, halfD: 3.25 },
    { x: 18, z: -18, halfW: 3.25, halfD: 3.25 },
    { x: -18, z: -18, halfW: 3.25, halfD: 3.25 },
    // 4 Inner Pillars (cylinders radius 1.2 + 1.0 = 2.2)
    { x: 6.36, z: 6.36, radius: 2.2 },
    { x: -6.36, z: 6.36, radius: 2.2 },
    { x: 6.36, z: -6.36, radius: 2.2 },
    { x: -6.36, z: -6.36, radius: 2.2 }
  ];

  constructor(room: RoomState, io: Server) {
    this.roomCode = room.code;
    this.matchId = `match_${Date.now()}_${room.code}`;
    this.io = io;

    // Spawn positions in circle around arena center
    const total = room.players.length;
    const radius = 22;

    room.players.forEach((p, idx) => {
      const angle = (idx / total) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const rotation = angle + Math.PI; // Face toward center

      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        kartIndex: p.kartIndex,
        health: GAME_CONSTANTS.STARTING_HEALTH,
        maxHealth: GAME_CONSTANTS.MAX_HEALTH,
        isEliminated: false,
        kills: 0,
        deaths: 0,
        score: 0,
        physics: {
          position: { x, y: 0, z },
          rotation,
          velocity: { x: 0, y: 0, z: 0 },
          speed: 0,
          angularVelocity: 0,
          isDrifting: false,
          isBoosting: false
        },
        boostAvailable: true,
        boostRemainingMs: 0,
        rocketCooldownRemainingMs: 0,
        lastProcessedInputSequence: 0
      });
    });
  }

  public queueInput(playerId: string, input: PlayerInputState): void {
    const player = this.players.get(playerId);
    if (!player || player.isEliminated) return;

    if (input.sequenceNumber > player.lastProcessedInputSequence) {
      player.lastProcessedInputSequence = input.sequenceNumber;
      this.playerInputs.set(playerId, input);
    }
  }

  public activateBoost(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.isEliminated || !player.boostAvailable) return false;

    player.boostAvailable = false;
    player.physics.isBoosting = true;
    player.boostRemainingMs = GAME_CONSTANTS.BOOST_DURATION_MS;
    return true;
  }

  public start(): void {
    this.isRunning = true;
    this.startTime = Date.now();
    this.tick = 0;

    this.timer = setInterval(() => {
      this.updateSimulation();
    }, GAME_CONSTANTS.SERVER_TICK_INTERVAL_MS);

    console.log(`[GameInstance] Started authoritative match ${this.matchId} for room ${this.roomCode}`);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log(`[GameInstance] Stopped match ${this.matchId} for room ${this.roomCode}`);
  }

  private updateSimulation(): void {
    if (!this.isRunning) return;

    this.tick++;
    const now = Date.now();
    const dt = GAME_CONSTANTS.SERVER_TICK_INTERVAL_MS / 1000;
    const recentExplosions: ExplosionEvent[] = [];

    // 1. Authoritative Player Physics Updates
    this.players.forEach((player, playerId) => {
      // Rocket cooldown countdown
      player.rocketCooldownRemainingMs = weaponService.getRemainingCooldown(playerId, now);

      if (player.isEliminated) return;

      const input = this.playerInputs.get(playerId);
      const physics = player.physics;

      // Handle Boost Duration
      if (physics.isBoosting) {
        player.boostRemainingMs -= dt * 1000;
        if (player.boostRemainingMs <= 0) {
          physics.isBoosting = false;
          player.boostRemainingMs = 0;
        }
      }

      // Check boost trigger in input
      if (input?.boost && player.boostAvailable) {
        this.activateBoost(playerId);
      }

      // Max Speed based on Boost
      const maxSpeed = physics.isBoosting
        ? GAME_CONSTANTS.KART_MAX_SPEED * GAME_CONSTANTS.BOOST_SPEED_MULTIPLIER
        : GAME_CONSTANTS.KART_MAX_SPEED;

      const reverseMaxSpeed = GAME_CONSTANTS.KART_REVERSE_MAX_SPEED;

      // Forward / Reverse Acceleration
      if (input?.forward) {
        const accel = physics.isBoosting
          ? GAME_CONSTANTS.KART_ACCELERATION * 1.5
          : GAME_CONSTANTS.KART_ACCELERATION;
        physics.speed = Math.min(maxSpeed, physics.speed + accel * dt);
      } else if (input?.backward) {
        if (physics.speed > 0) {
          physics.speed = Math.max(0, physics.speed - GAME_CONSTANTS.KART_BRAKING * dt);
        } else {
          physics.speed = Math.max(
            -reverseMaxSpeed,
            physics.speed - GAME_CONSTANTS.KART_ACCELERATION * 0.6 * dt
          );
        }
      } else {
        // Natural friction
        if (Math.abs(physics.speed) > 0.05) {
          physics.speed *= Math.pow(GAME_CONSTANTS.KART_FRICTION, dt * 60);
        } else {
          physics.speed = 0;
        }
      }

      // Steering
      let targetSteer = 0;
      if (input?.left) targetSteer -= 1;
      if (input?.right) targetSteer += 1;

      if (targetSteer !== 0) {
        const speedRatio = Math.min(1.0, Math.abs(physics.speed) / (GAME_CONSTANTS.KART_MAX_SPEED * 0.35));
        const turnDirection = physics.speed >= 0 ? 1 : -1;
        const turnAmount = targetSteer * GAME_CONSTANTS.KART_TURN_SPEED * speedRatio * turnDirection * dt;
        physics.rotation -= turnAmount;
      }

      // Forward Velocity Vector
      const forwardX = Math.sin(physics.rotation);
      const forwardZ = Math.cos(physics.rotation);

      physics.velocity.x = forwardX * physics.speed;
      physics.velocity.z = forwardZ * physics.speed;

      physics.position.x += physics.velocity.x * dt;
      physics.position.z += physics.velocity.z * dt;

      // Arena Boundary Clamping (Radius 45)
      const maxDist = GAME_CONSTANTS.ARENA_RADIUS - 1.5;
      const currentDist = Math.sqrt(physics.position.x ** 2 + physics.position.z ** 2);
      if (currentDist > maxDist) {
        const angle = Math.atan2(physics.position.z, physics.position.x);
        physics.position.x = Math.cos(angle) * maxDist;
        physics.position.z = Math.sin(angle) * maxDist;
        physics.speed = -physics.speed * 0.35; // Bounce back
      }

      // Obstacle Collisions
      for (const obs of this.obstacles) {
        if ('radius' in obs && obs.radius) {
          const dx = physics.position.x - obs.x;
          const dz = physics.position.z - obs.z;
          const dist = Math.sqrt(dx ** 2 + dz ** 2);
          if (dist < obs.radius && dist > 0.001) {
            const overlap = obs.radius - dist;
            physics.position.x += (dx / dist) * overlap;
            physics.position.z += (dz / dist) * overlap;
            physics.speed *= 0.7;
          }
        } else if ('halfW' in obs && obs.halfW && obs.halfD) {
          const dx = physics.position.x - obs.x;
          const dz = physics.position.z - obs.z;
          if (Math.abs(dx) < obs.halfW && Math.abs(dz) < obs.halfD) {
            const overlapX = obs.halfW - Math.abs(dx);
            const overlapZ = obs.halfD - Math.abs(dz);
            if (overlapX < overlapZ) {
              physics.position.x += dx > 0 ? overlapX : -overlapX;
            } else {
              physics.position.z += dz > 0 ? overlapZ : -overlapZ;
            }
            physics.speed *= 0.7;
          }
        }
      }
    });

    // 2. Kart-to-Kart Collisions
    const playerArray = Array.from(this.players.values()).filter((p) => !p.isEliminated);
    for (let i = 0; i < playerArray.length; i++) {
      for (let j = i + 1; j < playerArray.length; j++) {
        const p1 = playerArray[i];
        const p2 = playerArray[j];
        const dx = p1.physics.position.x - p2.physics.position.x;
        const dz = p1.physics.position.z - p2.physics.position.z;
        const dist = Math.sqrt(dx ** 2 + dz ** 2);
        const minDist = 2.0;

        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;

          p1.physics.position.x += nx * overlap;
          p1.physics.position.z += nz * overlap;
          p2.physics.position.x -= nx * overlap;
          p2.physics.position.z -= nz * overlap;

          const avgSpeed = (p1.physics.speed + p2.physics.speed) / 2;
          p1.physics.speed = avgSpeed * 0.8;
          p2.physics.speed = avgSpeed * 0.8;
        }
      }
    }

    // 3. Projectile Updates & Collision Detection
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const rocket = this.projectiles[i];
      rocket.position.x += rocket.velocity.x * dt;
      rocket.position.z += rocket.velocity.z * dt;
      const step = Math.sqrt(rocket.velocity.x ** 2 + rocket.velocity.z ** 2) * dt;
      rocket.distanceTraveled += step;

      let exploded = false;

      // 3A. Max Range Check
      if (rocket.distanceTraveled >= rocket.maxDistance) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // 3B. Wall Boundary Collision
      const distFromCenter = Math.sqrt(rocket.position.x ** 2 + rocket.position.z ** 2);
      if (distFromCenter >= GAME_CONSTANTS.ARENA_RADIUS - 0.5) {
        exploded = true;
        recentExplosions.push({
          id: `exp_wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          position: { ...rocket.position },
          radius: GAME_CONSTANTS.ROCKET_EXPLOSION_RADIUS,
          attackerId: rocket.ownerId,
          affectedPlayerIds: [],
          timestamp: now
        });
        this.projectiles.splice(i, 1);
        continue;
      }

      // 3C. Obstacle Collision
      for (const obs of this.obstacles) {
        if ('radius' in obs && obs.radius) {
          const dx = rocket.position.x - obs.x;
          const dz = rocket.position.z - obs.z;
          if (Math.sqrt(dx ** 2 + dz ** 2) < obs.radius) {
            exploded = true;
            break;
          }
        } else if ('halfW' in obs && obs.halfW && obs.halfD) {
          const dx = rocket.position.x - obs.x;
          const dz = rocket.position.z - obs.z;
          if (Math.abs(dx) < obs.halfW && Math.abs(dz) < obs.halfD) {
            exploded = true;
            break;
          }
        }
      }

      if (exploded) {
        recentExplosions.push({
          id: `exp_obs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          position: { ...rocket.position },
          radius: GAME_CONSTANTS.ROCKET_EXPLOSION_RADIUS,
          attackerId: rocket.ownerId,
          affectedPlayerIds: [],
          timestamp: now
        });
        this.projectiles.splice(i, 1);
        continue;
      }

      // 3D. Opponent Player Collision Detection
      for (const target of this.players.values()) {
        // Cannot hit oneself or already eliminated opponents
        if (target.id === rocket.ownerId || target.isEliminated) continue;

        const dx = target.physics.position.x - rocket.position.x;
        const dz = target.physics.position.z - rocket.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= GAME_CONSTANTS.ROCKET_HITBOX_RADIUS + 0.8) {
          // Direct Hit!
          target.health = Math.max(0, target.health - GAME_CONSTANTS.ROCKET_DAMAGE);

          const explosion: ExplosionEvent = {
            id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            position: { ...rocket.position },
            radius: GAME_CONSTANTS.ROCKET_EXPLOSION_RADIUS,
            attackerId: rocket.ownerId,
            affectedPlayerIds: [target.id],
            timestamp: now
          };
          recentExplosions.push(explosion);

          const attacker = this.players.get(rocket.ownerId);

          // Check for Elimination
          if (target.health <= 0) {
            target.isEliminated = true;
            target.deaths++;
            if (attacker) {
              attacker.kills++;
              attacker.score += 100;
            }

            const alivePlayers = Array.from(this.players.values()).filter((p) => !p.isEliminated);

            const elimPayload: PlayerEliminatedPayload = {
              eliminatedPlayerId: target.id,
              eliminatedPlayerName: target.name,
              attackerId: attacker?.id,
              attackerName: attacker?.name,
              remainingPlayers: alivePlayers.length
            };

            this.io.to(this.roomCode).emit(ServerToClientEvents.PLAYER_ELIMINATED, elimPayload);
            console.log(
              `[GameInstance] Player ${target.name} eliminated by ${attacker?.name || 'Rocket'}. Remaining alive: ${alivePlayers.length}`
            );

            // Broadcast real-time leaderboard update
            const currentLeaderboard = leaderboardService.calculateLeaderboard(Array.from(this.players.values()));
            this.io.to(this.roomCode).emit(ServerToClientEvents.LEADERBOARD_UPDATE, currentLeaderboard);

            // Victory check: only 1 or 0 players remain
            if (alivePlayers.length === 1) {
              this.finishMatch(alivePlayers[0].id, 'LAST_STANDING');
              return;
            } else if (alivePlayers.length === 0) {
              this.finishMatch(null, 'DRAW');
              return;
            }
          }

          this.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // 4. Construct Authoritative Snapshot
    const snapshot: GameSnapshot = {
      tick: this.tick,
      timestamp: now,
      players: Array.from(this.players.values()),
      projectiles: this.projectiles,
      explosions: recentExplosions.length > 0 ? recentExplosions : undefined
    };

    // 5. Broadcast to room
    this.io.to(this.roomCode).volatile.emit(ServerToClientEvents.GAME_SNAPSHOT, snapshot);
  }

  public async finishMatch(
    winnerId: string | null,
    reason: 'LAST_STANDING' | 'DRAW' | 'MATCH_TIMEOUT'
  ): Promise<void> {
    this.stop();

    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
    const playerList = Array.from(this.players.values());
    const leaderboard = leaderboardService.calculateLeaderboard(playerList);

    const winner = winnerId ? this.players.get(winnerId) : null;

    const payload: GameFinishedPayload = {
      winnerId,
      winnerName: winner ? winner.name : null,
      winnerColor: winner?.color,
      reason,
      durationSeconds,
      leaderboard,
      matchId: this.matchId
    };

    this.io.to(this.roomCode).emit(ServerToClientEvents.GAME_FINISHED, payload);

    // Reset room state for rematch / play again
    const room = roomService.getRoom(this.roomCode);
    if (room) {
      room.status = 'WAITING';
      room.players.forEach((p) => {
        p.isReady = false;
      });
      this.io.to(this.roomCode).emit(ServerToClientEvents.ROOM_STATE, room);
      console.log(`[GameInstance] Room ${this.roomCode} reset to WAITING state for rematch`);
    }

    // Persist to MongoDB
    try {
      await MatchModel.create({
        matchId: this.matchId,
        roomCode: this.roomCode,
        winnerId,
        duration: durationSeconds,
        status: 'COMPLETED',
        completedAt: new Date(),
        players: playerList.map((p, idx) => ({
          playerId: p.id,
          username: p.name,
          eliminations: p.kills,
          finalHealth: p.health,
          placement: leaderboard.find((l) => l.playerId === p.id)?.rank || idx + 1,
          survivedDuration: durationSeconds
        }))
      });
      console.log(`[GameInstance] Persisted match results for ${this.matchId}`);
    } catch (err) {
      console.warn(`[GameInstance] Could not persist match to MongoDB:`, err);
    }
  }
}

export class GameService {
  private static instance: GameService;
  private matches: Map<string, GameInstance> = new Map();

  private constructor() {}

  public static getInstance(): GameService {
    if (!GameService.instance) {
      GameService.instance = new GameService();
    }
    return GameService.instance;
  }

  public createMatch(room: RoomState, io: Server): GameInstance {
    const existing = this.matches.get(room.code);
    if (existing) {
      existing.stop();
    }

    const match = new GameInstance(room, io);
    this.matches.set(room.code, match);
    return match;
  }

  public getMatch(roomCode: string): GameInstance | undefined {
    return this.matches.get(roomCode);
  }

  public removeMatch(roomCode: string): void {
    const match = this.matches.get(roomCode);
    if (match) {
      match.stop();
      this.matches.delete(roomCode);
    }
  }

  public getActiveMatchCount(): number {
    return this.matches.size;
  }
}

export const gameService = GameService.getInstance();
