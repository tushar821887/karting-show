import {
  RoomState,
  RoomPlayer,
  GAME_CONSTANTS,
  CreateRoomRequest,
  JoinRoomRequest,
  UpdateCustomizationRequest,
  RoomErrorCode
} from '@kart-battle/shared';

export class RoomError extends Error {
  constructor(message: string, public code: RoomErrorCode) {
    super(message);
    this.name = 'RoomError';
  }
}

export class RoomService {
  private static instance: RoomService;
  // Map of roomCode -> RoomState
  private rooms: Map<string, RoomState> = new Map();
  // Map of playerId (socketId) -> roomCode
  private playerToRoom: Map<string, string> = new Map();
  // Active countdown timers: roomCode -> NodeJS.Timeout
  private countdownTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  public static getInstance(): RoomService {
    if (!RoomService.instance) {
      RoomService.instance = new RoomService();
    }
    return RoomService.instance;
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (0, O, 1, I)
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < GAME_CONSTANTS.ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
      if (attempts > 1000) {
        throw new Error('Could not generate unique room code');
      }
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(playerId: string, request: CreateRoomRequest): RoomState {
    // If player is already in a room, remove them first
    this.leaveRoom(playerId);

    const roomCode = this.generateRoomCode();
    const color = request.color || GAME_CONSTANTS.PLAYER_COLORS[0];
    const kartIndex = request.kartIndex ?? 0;

    const hostPlayer: RoomPlayer = {
      id: playerId,
      name: request.playerName.trim(),
      isHost: true,
      isReady: true, // Host is ready by default
      color,
      kartIndex,
      ping: 0,
      isConnected: true,
      joinedAt: Date.now()
    };

    const newRoom: RoomState = {
      code: roomCode,
      status: 'WAITING',
      hostId: playerId,
      players: [hostPlayer],
      maxPlayers: GAME_CONSTANTS.MAX_PLAYERS_PER_ROOM,
      minPlayers: GAME_CONSTANTS.MIN_PLAYERS_PER_ROOM,
      createdAt: Date.now(),
      countdownSeconds: undefined
    };

    this.rooms.set(roomCode, newRoom);
    this.playerToRoom.set(playerId, roomCode);

    console.log(`[RoomService] Created room ${roomCode} by host ${hostPlayer.name} (${playerId})`);
    return newRoom;
  }

  public joinRoom(playerId: string, request: JoinRoomRequest): RoomState {
    const code = request.roomCode.toUpperCase().trim();
    const room = this.rooms.get(code);

    if (!room) {
      throw new RoomError(`Room "${code}" was not found`, 'ROOM_NOT_FOUND');
    }

    if (room.status !== 'WAITING') {
      throw new RoomError(`Room "${code}" is currently in progress (${room.status})`, 'GAME_IN_PROGRESS');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new RoomError(`Room "${code}" is full (${room.players.length}/${room.maxPlayers})`, 'ROOM_FULL');
    }

    // Check if player is already in this room
    if (this.playerToRoom.get(playerId) === code) {
      return room;
    }

    // Leave any other room
    this.leaveRoom(playerId);

    // Ensure unique display name inside room
    let requestedName = request.playerName.trim();
    const existingNames = new Set(room.players.map((p) => p.name.toLowerCase()));
    if (existingNames.has(requestedName.toLowerCase())) {
      let counter = 2;
      while (existingNames.has(`${requestedName} (${counter})`.toLowerCase())) {
        counter++;
      }
      requestedName = `${requestedName} (${counter})`;
    }

    // Pick an unused color if possible
    const usedColors = new Set(room.players.map((p) => p.color));
    const availableColor =
      (request.color && !usedColors.has(request.color) ? request.color : undefined) ||
      GAME_CONSTANTS.PLAYER_COLORS.find((c) => !usedColors.has(c)) ||
      GAME_CONSTANTS.PLAYER_COLORS[room.players.length % GAME_CONSTANTS.PLAYER_COLORS.length];

    const newPlayer: RoomPlayer = {
      id: playerId,
      name: requestedName,
      isHost: false,
      isReady: false,
      color: availableColor,
      kartIndex: request.kartIndex ?? (room.players.length % 4),
      ping: 0,
      isConnected: true,
      joinedAt: Date.now()
    };

    room.players.push(newPlayer);
    this.playerToRoom.set(playerId, code);

    console.log(`[RoomService] Player ${newPlayer.name} (${playerId}) joined room ${code} [${room.players.length}/${room.maxPlayers}]`);
    return room;
  }

  public leaveRoom(playerId: string): { room: RoomState | null; wasHost: boolean; roomClosed: boolean; leftPlayer: RoomPlayer | null } {
    const code = this.playerToRoom.get(playerId);
    if (!code) {
      return { room: null, wasHost: false, roomClosed: false, leftPlayer: null };
    }

    const room = this.rooms.get(code);
    this.playerToRoom.delete(playerId);

    if (!room) {
      return { room: null, wasHost: false, roomClosed: false, leftPlayer: null };
    }

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      return { room, wasHost: false, roomClosed: false, leftPlayer: null };
    }

    const player = room.players[playerIndex];
    const wasHost = player.isHost;
    room.players.splice(playerIndex, 1);

    console.log(`[RoomService] Player ${player.name} (${playerId}) left room ${code}`);

    // If no players remain, clean up the room and any countdown
    if (room.players.length === 0) {
      this.cancelCountdown(code);
      this.rooms.delete(code);
      console.log(`[RoomService] Room ${code} closed (empty)`);
      return { room: null, wasHost, roomClosed: true, leftPlayer: player };
    }

    // If countdown was in progress and players drop below minimum, cancel countdown
    if (room.status === 'COUNTDOWN' && room.players.length < room.minPlayers) {
      this.cancelCountdown(code);
      room.status = 'WAITING';
      room.countdownSeconds = undefined;
      console.log(`[RoomService] Countdown cancelled for room ${code} (players dropped below minimum)`);
    }

    // If host left, elect new host
    if (wasHost && room.players.length > 0) {
      room.players[0].isHost = true;
      room.players[0].isReady = true;
      room.hostId = room.players[0].id;
      console.log(`[RoomService] New host for room ${code}: ${room.players[0].name} (${room.players[0].id})`);
    }

    return { room, wasHost, roomClosed: false, leftPlayer: player };
  }

  public kickPlayer(hostId: string, targetPlayerId: string): { room: RoomState; kickedPlayer: RoomPlayer } {
    const room = this.getRoomByPlayerId(hostId);
    if (!room) {
      throw new RoomError('You are not in a room', 'PLAYER_NOT_FOUND');
    }

    if (room.hostId !== hostId) {
      throw new RoomError('Only the room host can kick players', 'NOT_HOST');
    }

    if (hostId === targetPlayerId) {
      throw new RoomError('You cannot kick yourself', 'INVALID_INPUT');
    }

    const targetIdx = room.players.findIndex((p) => p.id === targetPlayerId);
    if (targetIdx === -1) {
      throw new RoomError('Player not found in this room', 'PLAYER_NOT_FOUND');
    }

    const kickedPlayer = room.players[targetIdx];
    room.players.splice(targetIdx, 1);
    this.playerToRoom.delete(targetPlayerId);

    // Cancel countdown if dropped below min players
    if (room.status === 'COUNTDOWN' && room.players.length < room.minPlayers) {
      this.cancelCountdown(room.code);
      room.status = 'WAITING';
      room.countdownSeconds = undefined;
    }

    console.log(`[RoomService] Player ${kickedPlayer.name} was kicked from room ${room.code} by host`);
    return { room, kickedPlayer };
  }

  public setPlayerReady(playerId: string, isReady: boolean): RoomState {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) {
      throw new RoomError('You are not in a room', 'PLAYER_NOT_FOUND');
    }

    if (room.status !== 'WAITING') {
      throw new RoomError('Cannot change ready state during a match', 'GAME_IN_PROGRESS');
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new RoomError('Player not found in room', 'PLAYER_NOT_FOUND');
    }

    player.isReady = isReady;
    console.log(`[RoomService] Player ${player.name} in room ${room.code} set ready: ${isReady}`);
    return room;
  }

  public updatePlayerCustomization(playerId: string, request: UpdateCustomizationRequest): RoomState {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) {
      throw new RoomError('You are not in a room', 'PLAYER_NOT_FOUND');
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new RoomError('Player not found in room', 'PLAYER_NOT_FOUND');
    }

    if (request.color) {
      player.color = request.color;
    }
    if (request.kartIndex !== undefined) {
      player.kartIndex = request.kartIndex;
    }

    return room;
  }

  public validateStartMatch(playerId: string): RoomState {
    const room = this.getRoomByPlayerId(playerId);
    if (!room) {
      throw new RoomError('You are not in a room', 'PLAYER_NOT_FOUND');
    }

    if (room.hostId !== playerId) {
      throw new RoomError('Only the room host can start the match', 'NOT_HOST');
    }

    if (room.status !== 'WAITING') {
      throw new RoomError(`Cannot start match: room is in ${room.status} state`, 'GAME_IN_PROGRESS');
    }

    if (room.players.length < room.minPlayers) {
      throw new RoomError(
        `At least ${room.minPlayers} players are required to start the match (currently ${room.players.length})`,
        'NOT_ENOUGH_PLAYERS'
      );
    }

    const unreadyPlayers = room.players.filter((p) => !p.isReady);
    if (unreadyPlayers.length > 0) {
      const names = unreadyPlayers.map((p) => p.name).join(', ');
      throw new RoomError(
        `All players must be ready to start. Waiting for: ${names}`,
        'NOT_ALL_READY'
      );
    }

    return room;
  }

  public cancelCountdown(roomCode: string): void {
    const timer = this.countdownTimers.get(roomCode);
    if (timer) {
      clearInterval(timer);
      this.countdownTimers.delete(roomCode);
    }
  }

  public registerCountdownTimer(roomCode: string, timer: NodeJS.Timeout): void {
    this.cancelCountdown(roomCode);
    this.countdownTimers.set(roomCode, timer);
  }

  public getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode.toUpperCase().trim());
  }

  public getRoomByPlayerId(playerId: string): RoomState | undefined {
    const code = this.playerToRoom.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  public updateRoomStatus(code: string, status: RoomState['status']): void {
    const room = this.rooms.get(code);
    if (room) {
      room.status = status;
    }
  }

  public getStats(): { totalRooms: number; activePlayers: number } {
    return {
      totalRooms: this.rooms.size,
      activePlayers: this.playerToRoom.size
    };
  }
}

export const roomService = RoomService.getInstance();
