import { LeaderboardEntry, PlayerGameState } from '@kart-battle/shared';

export class LeaderboardService {
  private static instance: LeaderboardService;

  private constructor() {}

  public static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  public calculateLeaderboard(players: PlayerGameState[]): LeaderboardEntry[] {
    // Sort criteria:
    // 1. Alive players first
    // 2. Health descending
    // 3. Eliminations descending
    // 4. Score descending
    const sorted = [...players].sort((a, b) => {
      if (a.isEliminated !== b.isEliminated) {
        return a.isEliminated ? 1 : -1;
      }
      if (a.kills !== b.kills) {
        return b.kills - a.kills;
      }
      return b.health - a.health;
    });

    return sorted.map((p, index) => ({
      rank: index + 1,
      playerId: p.id,
      playerName: p.name,
      color: p.color,
      eliminations: p.kills,
      health: p.health,
      isAlive: !p.isEliminated,
      score: p.kills * 100 + (p.isEliminated ? 0 : 50)
    }));
  }
}

export const leaderboardService = LeaderboardService.getInstance();
