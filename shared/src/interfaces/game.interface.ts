import { PlayerGameState } from './player.interface';
import { RocketState, ExplosionEvent } from './weapon.interface';
import { LeaderboardEntry } from './leaderboard.interface';

export interface GameSnapshot {
  tick: number;
  timestamp: number;
  players: PlayerGameState[];
  projectiles: RocketState[];
  explosions?: ExplosionEvent[];
}

export interface CountdownPayload {
  secondsRemaining: number;
  message?: string;
}

export interface PlayerEliminatedPayload {
  eliminatedPlayerId: string;
  eliminatedPlayerName: string;
  attackerId?: string;
  attackerName?: string;
  remainingPlayers: number;
}

export interface GameFinishedPayload {
  winnerId: string | null; // null if draw
  winnerName: string | null;
  winnerColor?: string;
  reason: 'LAST_STANDING' | 'DRAW' | 'MATCH_TIMEOUT';
  durationSeconds: number;
  leaderboard: LeaderboardEntry[];
  matchId: string;
}
