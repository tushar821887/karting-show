import { Socket, Server } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  CreateRoomSchema,
  JoinRoomSchema,
  UpdateCustomizationSchema,
  KickPlayerSchema,
  RoomErrorPayload
} from '@kart-battle/shared';
import { roomService, RoomError } from '../modules/rooms/room.service';
import { gameService } from '../modules/game/game.service';

export function registerRoomHandlers(io: Server, socket: Socket): void {
  // CREATE ROOM
  socket.on(ClientToServerEvents.ROOM_CREATE, (data: unknown) => {
    try {
      const parsed = CreateRoomSchema.safeParse(data);
      if (!parsed.success) {
        const errorPayload: RoomErrorPayload = {
          message: parsed.error.errors.map((e) => e.message).join(', '),
          code: 'INVALID_INPUT'
        };
        socket.emit(ServerToClientEvents.ROOM_ERROR, errorPayload);
        return;
      }

      const room = roomService.createRoom(socket.id, parsed.data);
      socket.join(room.code);

      socket.emit(ServerToClientEvents.ROOM_CREATED, room);
      io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      const code = err instanceof RoomError ? err.code : 'INVALID_INPUT';
      socket.emit(ServerToClientEvents.ROOM_ERROR, { message, code });
    }
  });

  // JOIN ROOM
  socket.on(ClientToServerEvents.ROOM_JOIN, (data: unknown) => {
    try {
      const parsed = JoinRoomSchema.safeParse(data);
      if (!parsed.success) {
        const errorPayload: RoomErrorPayload = {
          message: parsed.error.errors.map((e) => e.message).join(', '),
          code: 'INVALID_INPUT'
        };
        socket.emit(ServerToClientEvents.ROOM_ERROR, errorPayload);
        return;
      }

      const room = roomService.joinRoom(socket.id, parsed.data);
      socket.join(room.code);

      socket.emit(ServerToClientEvents.ROOM_JOINED, room);
      io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      const code = err instanceof RoomError ? err.code : 'INVALID_INPUT';
      socket.emit(ServerToClientEvents.ROOM_ERROR, { message, code });
    }
  });

  // PLAYER READY TOGGLE
  socket.on(ClientToServerEvents.PLAYER_READY, (isReady: boolean) => {
    try {
      const room = roomService.setPlayerReady(socket.id, Boolean(isReady));
      io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update ready status';
      const code = err instanceof RoomError ? err.code : 'INVALID_INPUT';
      socket.emit(ServerToClientEvents.ROOM_ERROR, { message, code });
    }
  });

  // UPDATE CUSTOMIZATION (Color / Kart in lobby)
  socket.on(ClientToServerEvents.ROOM_UPDATE_CUSTOMIZATION, (data: unknown) => {
    try {
      const parsed = UpdateCustomizationSchema.safeParse(data);
      if (!parsed.success) return;

      const room = roomService.updatePlayerCustomization(socket.id, parsed.data);
      io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update customization';
      const code = err instanceof RoomError ? err.code : 'INVALID_INPUT';
      socket.emit(ServerToClientEvents.ROOM_ERROR, { message, code });
    }
  });

  // HOST KICK PLAYER
  socket.on(ClientToServerEvents.ROOM_KICK, (data: unknown) => {
    try {
      const parsed = KickPlayerSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(ServerToClientEvents.ROOM_ERROR, {
          message: 'Invalid target player for kick',
          code: 'INVALID_INPUT'
        });
        return;
      }

      const { room, kickedPlayer } = roomService.kickPlayer(socket.id, parsed.data.targetPlayerId);

      // Notify the kicked player
      const targetSocket = io.sockets.sockets.get(kickedPlayer.id);
      if (targetSocket) {
        targetSocket.leave(room.code);
        targetSocket.emit(ServerToClientEvents.ROOM_KICKED, {
          message: 'You were kicked from the room by the host'
        });
      }

      // Broadcast updated room state to remaining players
      io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to kick player';
      const code = err instanceof RoomError ? err.code : 'INVALID_INPUT';
      socket.emit(ServerToClientEvents.ROOM_ERROR, { message, code });
    }
  });

  // GAME START (Host Only with Countdown)
  socket.on(ClientToServerEvents.GAME_START, () => {
    try {
      const room = roomService.validateStartMatch(socket.id);

      // Begin Countdown
      roomService.updateRoomStatus(room.code, 'COUNTDOWN');
      room.countdownSeconds = 3;
      io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, room);

      let remaining = 3;
      io.to(room.code).emit(ServerToClientEvents.GAME_COUNTDOWN, { secondsRemaining: remaining });

      const timer = setInterval(() => {
        remaining--;
        const currentRoom = roomService.getRoom(room.code);

        // If room was cancelled or players left below minimum during countdown
        if (!currentRoom || currentRoom.status !== 'COUNTDOWN') {
          clearInterval(timer);
          return;
        }

        currentRoom.countdownSeconds = remaining;

        if (remaining > 0) {
          io.to(room.code).emit(ServerToClientEvents.GAME_COUNTDOWN, { secondsRemaining: remaining });
          io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, currentRoom);
        } else {
          clearInterval(timer);
          roomService.updateRoomStatus(room.code, 'PLAYING');
          currentRoom.countdownSeconds = undefined;
          io.to(room.code).emit(ServerToClientEvents.ROOM_STATE, currentRoom);

          // Start Match in GameService
          const match = gameService.createMatch(currentRoom, io);
          match.start();
          io.to(room.code).emit(ServerToClientEvents.GAME_STARTED, { matchId: match.matchId });
        }
      }, 1000);

      roomService.registerCountdownTimer(room.code, timer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cannot start game';
      const code = err instanceof RoomError ? err.code : 'INVALID_INPUT';
      socket.emit(ServerToClientEvents.ROOM_ERROR, { message, code });
    }
  });

  // LEAVE ROOM
  socket.on(ClientToServerEvents.ROOM_LEAVE, () => {
    const result = roomService.leaveRoom(socket.id);
    if (result.leftPlayer) {
      socket.leave(result.room ? result.room.code : '');
    }
    if (result.room) {
      io.to(result.room.code).emit(ServerToClientEvents.ROOM_STATE, result.room);
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const result = roomService.leaveRoom(socket.id);
    if (result.room) {
      io.to(result.room.code).emit(ServerToClientEvents.PLAYER_DISCONNECTED, { playerId: socket.id });
      io.to(result.room.code).emit(ServerToClientEvents.ROOM_STATE, result.room);
    }
  });
}
