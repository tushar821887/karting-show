import { Injectable, signal, computed, inject } from '@angular/core';
import { RoomState, RoomPlayer, GAME_CONSTANTS, GameFinishedPayload, LeaderboardEntry } from '@kart-battle/shared';
import { SocketService } from './socket.service';

export interface PlayerProfile {
  name: string;
  color: string;
  kartIndex: number;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private socket = inject(SocketService);

  // Local Player Profile
  private readonly storedName =
    localStorage.getItem('kart_player_name') || `Racer_${Math.floor(100 + Math.random() * 900)}`;
  private readonly storedColor =
    localStorage.getItem('kart_player_color') || GAME_CONSTANTS.PLAYER_COLORS[0];

  public readonly profile = signal<PlayerProfile>({
    name: this.storedName,
    color: this.storedColor,
    kartIndex: 0
  });

  // Current Room
  public readonly currentRoom = signal<RoomState | null>(null);

  // Match Results & Leaderboard
  public readonly lastMatchResult = signal<GameFinishedPayload | null>(null);
  public readonly liveLeaderboard = signal<LeaderboardEntry[]>([]);

  // Toast Notifications
  public readonly toasts = signal<ToastNotification[]>([]);

  // Computed Helpers
  public readonly isInRoom = computed(() => this.currentRoom() !== null);

  public readonly selfPlayer = computed<RoomPlayer | undefined>(() => {
    const room = this.currentRoom();
    const myId = this.socket.socketId();
    if (!room || !myId) return undefined;
    return room.players.find((p) => p.id === myId);
  });

  public readonly isHost = computed(() => {
    const self = this.selfPlayer();
    return self ? self.isHost : false;
  });

  public readonly isReady = computed(() => {
    const self = this.selfPlayer();
    return self ? self.isReady : false;
  });

  public readonly unreadyPlayerNames = computed(() => {
    const room = this.currentRoom();
    if (!room) return [];
    return room.players.filter((p) => !p.isReady).map((p) => p.name);
  });

  public readonly canStartMatch = computed(() => {
    const room = this.currentRoom();
    if (!room) return false;
    const hasEnough = room.players.length >= room.minPlayers;
    const allReady = room.players.every((p) => p.isReady);
    return hasEnough && allReady && room.status === 'WAITING';
  });

  public updateProfile(patch: Partial<PlayerProfile>): void {
    this.profile.update((prev) => {
      const updated = { ...prev, ...patch };
      if (patch.name) localStorage.setItem('kart_player_name', updated.name);
      if (patch.color) localStorage.setItem('kart_player_color', updated.color);
      return updated;
    });
  }

  public setRoom(room: RoomState | null): void {
    this.currentRoom.set(room);
  }

  public setLastMatchResult(result: GameFinishedPayload | null): void {
    this.lastMatchResult.set(result);
  }

  public setLiveLeaderboard(leaderboard: LeaderboardEntry[]): void {
    this.liveLeaderboard.set(leaderboard);
  }

  public showToast(message: string, type: ToastNotification['type'] = 'info'): void {
    const id = `toast_${Date.now()}_${Math.random()}`;
    this.toasts.update((list) => [...list, { id, message, type }]);
    setTimeout(() => {
      this.dismissToast(id);
    }, 4000);
  }

  public dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
