import { PlayerModel, IPlayerDocument } from '../../models/Player';

export class PlayerService {
  private static instance: PlayerService;

  private constructor() {}

  public static getInstance(): PlayerService {
    if (!PlayerService.instance) {
      PlayerService.instance = new PlayerService();
    }
    return PlayerService.instance;
  }

  public async findOrCreatePlayer(playerId: string, username: string): Promise<IPlayerDocument | null> {
    try {
      let player = await PlayerModel.findOne({ playerId });
      if (!player) {
        player = await PlayerModel.create({
          playerId,
          username
        });
      }
      return player;
    } catch (err) {
      console.warn(`[PlayerService] Database unavailable or error during findOrCreatePlayer:`, err);
      return null;
    }
  }

  public async recordMatchStats(playerId: string, isWinner: boolean, eliminations: number): Promise<void> {
    try {
      await PlayerModel.updateOne(
        { playerId },
        {
          $inc: {
            totalMatches: 1,
            totalWins: isWinner ? 1 : 0,
            totalEliminations: eliminations
          }
        },
        { upsert: true }
      );
    } catch (err) {
      console.warn(`[PlayerService] Could not persist player stats to MongoDB:`, err);
    }
  }
}

export const playerService = PlayerService.getInstance();
