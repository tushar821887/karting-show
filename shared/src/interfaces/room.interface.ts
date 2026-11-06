export type RoomStatus = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';

export interface RoomPlayer {
  id: string; // Socket ID or unique session ID
  name: string;
  isHost: boolean;
  isReady: boolean;
  color: string;
  kartIndex: number;
  ping: number;
  isConnected: boolean;
  joinedAt: number;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  minPlayers: number;
  createdAt: number;
  matchId?: string;
  countdownSeconds?: number;
}

export interface CreateRoomRequest {
  playerName: string;
  color?: string;
  kartIndex?: number;
}

export interface JoinRoomRequest {
  roomCode: string;
  playerName: string;
  color?: string;
  kartIndex?: number;
}

export interface UpdateCustomizationRequest {
  color?: string;
  kartIndex?: number;
}

export interface KickPlayerRequest {
  targetPlayerId: string;
}

export type RoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_ALL_READY'
  | 'INVALID_INPUT'
  | 'ALREADY_IN_ROOM'
  | 'PLAYER_NOT_FOUND';

export interface RoomErrorPayload {
  message: string;
  code?: RoomErrorCode;
}
