import { Router, Request, Response } from 'express';
import { getDatabaseStatus } from '../config/database';
import { roomService } from '../modules/rooms/room.service';
import { gameService } from '../modules/game/game.service';
import { GAME_CONSTANTS } from '@kart-battle/shared';
import { SocketServer } from '../sockets/socket.server';

export function createHealthRouter(socketServer: SocketServer): Router {
  const router = Router();
  const startTime = Date.now();

  router.get('/health', (_req: Request, res: Response) => {
    const memory = process.memoryUsage();
    const dbStatus = getDatabaseStatus();
    const stats = roomService.getStats();

    res.json({
      status: 'ok',
      service: 'Kart Battle Arena Server',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      database: dbStatus,
      multiplayer: {
        activeRooms: stats.totalRooms,
        activePlayersInRooms: stats.activePlayers,
        connectedSockets: socketServer.getConnectedClientCount(),
        activeMatches: gameService.getActiveMatchCount()
      },
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024)
      }
    });
  });

  router.get('/info', (_req: Request, res: Response) => {
    res.json({
      gameName: 'Kart Battle Arena',
      version: '1.0.0',
      description: 'Browser-based 3D multiplayer kart battle game',
      constants: {
        tickRate: GAME_CONSTANTS.SERVER_TICK_RATE,
        maxPlayersPerRoom: GAME_CONSTANTS.MAX_PLAYERS_PER_ROOM,
        minPlayersPerRoom: GAME_CONSTANTS.MIN_PLAYERS_PER_ROOM,
        startingHealth: GAME_CONSTANTS.STARTING_HEALTH,
        rocketDamage: GAME_CONSTANTS.ROCKET_DAMAGE,
        rocketCooldownMs: GAME_CONSTANTS.ROCKET_COOLDOWN_MS,
        boostDurationMs: GAME_CONSTANTS.BOOST_DURATION_MS,
        boostCooldownMs: GAME_CONSTANTS.BOOST_COOLDOWN_MS
      }
    });
  });

  return router;
}
