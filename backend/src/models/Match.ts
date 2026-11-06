import mongoose, { Schema, Document } from 'mongoose';
import { IMatchPlayer, MatchPlayerSubSchema } from './MatchPlayer';

export interface IMatchDocument extends Document {
  matchId: string;
  roomCode: string;
  players: IMatchPlayer[];
  winnerId: string | null;
  duration: number; // in seconds
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  completedAt?: Date;
}

const MatchSchema = new Schema<IMatchDocument>(
  {
    matchId: { type: String, required: true, unique: true, index: true },
    roomCode: { type: String, required: true, index: true },
    players: [MatchPlayerSubSchema],
    winnerId: { type: String, default: null },
    duration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'IN_PROGRESS'
    },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

export const MatchModel = mongoose.model<IMatchDocument>('Match', MatchSchema);
