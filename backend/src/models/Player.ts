import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayerDocument extends Document {
  playerId: string;
  username: string;
  totalMatches: number;
  totalWins: number;
  totalEliminations: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayerDocument>(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true },
    totalMatches: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    totalEliminations: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const PlayerModel = mongoose.model<IPlayerDocument>('Player', PlayerSchema);
