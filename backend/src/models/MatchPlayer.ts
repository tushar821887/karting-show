import { Schema } from 'mongoose';

export interface IMatchPlayer {
  playerId: string;
  username: string;
  eliminations: number;
  finalHealth: number;
  placement: number;
  survivedDuration: number;
}

export const MatchPlayerSubSchema = new Schema<IMatchPlayer>(
  {
    playerId: { type: String, required: true },
    username: { type: String, required: true },
    eliminations: { type: Number, default: 0 },
    finalHealth: { type: Number, default: 0 },
    placement: { type: Number, default: 0 },
    survivedDuration: { type: Number, default: 0 }
  },
  { _id: false }
);
