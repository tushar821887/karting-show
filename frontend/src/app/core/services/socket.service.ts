import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  GameSnapshot,
  GameFinishedPayload,
  PlayerEliminatedPayload,
  RoomErrorPayload,
  LeaderboardEntry,
  CreateRoomRequest,
  JoinRoomRequest,
  UpdateCustomizationRequest,
  KickPlayerRequest
} from '@kart-battle/shared';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;

  // Reactive state signals
  public readonly isConnected = signal<boolean>(false);
  public readonly socketId = signal<string | null>(null);
  public readonly latencyMs = signal<number>(0);

  // Event subjects
  private roomStateSubject = new Subject<RoomState>();
  private roomCreatedSubject = new Subject<RoomState>();
  private roomJoinedSubject = new Subject<RoomState>();
  private roomErrorSubject = new Subject<RoomErrorPayload>();
  private roomKickedSubject = new Subject<{ message: string }>();
  private countdownSubject = new Subject<{ secondsRemaining: number }>();
  private gameStartedSubject = new Subject<{ matchId: string }>();
  private gameSnapshotSubject = new Subject<GameSnapshot>();
  private playerEliminatedSubject = new Subject<PlayerEliminatedPayload>();
  private leaderboardSubject = new Subject<LeaderboardEntry[]>();
  private gameFinishedSubject = new Subject<GameFinishedPayload>();

  public readonly roomState$ = this.roomStateSubject.asObservable();
  public readonly roomCreated$ = this.roomCreatedSubject.asObservable();
  public readonly roomJoined$ = this.roomJoinedSubject.asObservable();
  public readonly roomError$ = this.roomErrorSubject.asObservable();
  public readonly roomKicked$ = this.roomKickedSubject.asObservable();
  public readonly countdown$ = this.countdownSubject.asObservable();
  public readonly gameStarted$ = this.gameStartedSubject.asObservable();
  public readonly gameSnapshot$ = this.gameSnapshotSubject.asObservable();
  public readonly playerEliminated$ = this.playerEliminatedSubject.asObservable();
  public readonly leaderboard$ = this.leaderboardSubject.asObservable();
  public readonly gameFinished$ = this.gameFinishedSubject.asObservable();

  private pingTimer: ReturnType<typeof setInterval> | null = null;

  public connect(): void {
    if (this.socket && this.socket.connected) {
      return;
    }

    this.socket = io(environment.socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.setupListeners();
    this.startPingLoop();
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      this.socketId.set(this.socket?.id ?? null);
      console.log('[SocketService] Connected to game server:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected.set(false);
      this.socketId.set(null);
      console.warn('[SocketService] Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] Connection error:', error.message);
    });

    this.socket.on(ServerToClientEvents.ROOM_CREATED, (room: RoomState) => {
      this.roomCreatedSubject.next(room);
    });

    this.socket.on(ServerToClientEvents.ROOM_JOINED, (room: RoomState) => {
      this.roomJoinedSubject.next(room);
    });

    this.socket.on(ServerToClientEvents.ROOM_STATE, (room: RoomState) => {
      this.roomStateSubject.next(room);
    });

    this.socket.on(ServerToClientEvents.ROOM_ERROR, (error: RoomErrorPayload) => {
      this.roomErrorSubject.next(error);
    });

    this.socket.on(ServerToClientEvents.ROOM_KICKED, (data: { message: string }) => {
      this.roomKickedSubject.next(data);
    });

    this.socket.on(ServerToClientEvents.GAME_COUNTDOWN, (data: { secondsRemaining: number }) => {
      this.countdownSubject.next(data);
    });

    this.socket.on(ServerToClientEvents.GAME_STARTED, (data: { matchId: string }) => {
      this.gameStartedSubject.next(data);
    });

    this.socket.on(ServerToClientEvents.GAME_SNAPSHOT, (snapshot: GameSnapshot) => {
      this.gameSnapshotSubject.next(snapshot);
    });

    this.socket.on(ServerToClientEvents.PLAYER_ELIMINATED, (data: PlayerEliminatedPayload) => {
      this.playerEliminatedSubject.next(data);
    });

    this.socket.on(ServerToClientEvents.LEADERBOARD_UPDATE, (leaderboard: LeaderboardEntry[]) => {
      this.leaderboardSubject.next(leaderboard);
    });

    this.socket.on(ServerToClientEvents.GAME_FINISHED, (finished: GameFinishedPayload) => {
      this.gameFinishedSubject.next(finished);
    });

    this.socket.on(ServerToClientEvents.PLAYER_PONG, (data: { clientTimestamp: number }) => {
      const latency = Math.max(1, Math.round(Date.now() - data.clientTimestamp));
      this.latencyMs.set(latency);
    });
  }

  private startPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit(ClientToServerEvents.PLAYER_PING, Date.now());
      }
    }, 3000);
  }

  // Room Actions
  public createRoom(request: CreateRoomRequest): void {
    this.emit(ClientToServerEvents.ROOM_CREATE, request);
  }

  public joinRoom(request: JoinRoomRequest): void {
    this.emit(ClientToServerEvents.ROOM_JOIN, request);
  }

  public leaveRoom(): void {
    this.emit(ClientToServerEvents.ROOM_LEAVE);
  }

  public setReady(isReady: boolean): void {
    this.emit(ClientToServerEvents.PLAYER_READY, isReady);
  }

  public updateCustomization(request: UpdateCustomizationRequest): void {
    this.emit(ClientToServerEvents.ROOM_UPDATE_CUSTOMIZATION, request);
  }

  public kickPlayer(targetPlayerId: string): void {
    const payload: KickPlayerRequest = { targetPlayerId };
    this.emit(ClientToServerEvents.ROOM_KICK, payload);
  }

  public startGame(): void {
    this.emit(ClientToServerEvents.GAME_START);
  }

  public emit<T = unknown>(event: ClientToServerEvents, data?: T): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[SocketService] Cannot emit ${event}: socket not connected`);
    }
  }

  public disconnect(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected.set(false);
    this.socketId.set(null);
  }
}
