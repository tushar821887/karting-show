export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  color: string;
  eliminations: number;
  health: number;
  isAlive: boolean;
  score: number;
  placement?: number;
}
