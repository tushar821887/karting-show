import { Socket, Server } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerInputSchema
} from '@kart-battle/shared';
import { roomService } from '../modules/rooms/room.service';
import { gameService } from '../modules/game/game.service';
import { weaponService } from '../modules/weapons/weapon.service';

export function registerGameHandlers(io: Server, socket: Socket): void {
  // PING / PONG (Latency measuring)
  socket.on(ClientToServerEvents.PLAYER_PING, (clientTimestamp: number) => {
    socket.emit(ServerToClientEvents.PLAYER_PONG, {
      clientTimestamp,
      serverTimestamp: Date.now()
    });
  });

  // PLAYER INPUT (Authoritative input queueing)
  socket.on(ClientToServerEvents.PLAYER_INPUT, (input: unknown) => {
    const parsed = PlayerInputSchema.safeParse(input);
    if (!parsed.success) return;

    const room = roomService.getRoomByPlayerId(socket.id);
    if (!room || room.status !== 'PLAYING') return;

    const match = gameService.getMatch(room.code);
    if (!match || !match.isRunning) return;

    match.queueInput(socket.id, parsed.data);
  });

  // WEAPON FIRE
  socket.on(ClientToServerEvents.WEAPON_FIRE, () => {
    const room = roomService.getRoomByPlayerId(socket.id);
    if (!room || room.status !== 'PLAYING') return;

    const match = gameService.getMatch(room.code);
    if (!match || !match.isRunning) return;

    const player = match.players.get(socket.id);
    if (!player || player.isEliminated) return;

    const rocket = weaponService.createRocket(
      socket.id,
      player.physics.position,
      player.physics.rotation
    );

    if (rocket) {
      match.projectiles.push(rocket);
    }
  });

  // PLAYER BOOST
  socket.on(ClientToServerEvents.PLAYER_BOOST, () => {
    const room = roomService.getRoomByPlayerId(socket.id);
    if (!room || room.status !== 'PLAYING') return;

    const match = gameService.getMatch(room.code);
    if (!match || !match.isRunning) return;

    match.activateBoost(socket.id);
  });
}
