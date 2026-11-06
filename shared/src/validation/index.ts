import { z } from 'zod';
import { GAME_CONSTANTS } from '../constants/game.constants';

export const CreateRoomSchema = z.object({
  playerName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(16, 'Name cannot exceed 16 characters')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Name can only contain letters, numbers, spaces, underscores, and hyphens'),
  color: z.string().optional(),
  kartIndex: z.number().int().min(0).max(7).optional().default(0)
});

export const JoinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .length(GAME_CONSTANTS.ROOM_CODE_LENGTH, `Room code must be exactly ${GAME_CONSTANTS.ROOM_CODE_LENGTH} characters`)
    .toUpperCase(),
  playerName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(16, 'Name cannot exceed 16 characters')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Name can only contain letters, numbers, spaces, underscores, and hyphens'),
  color: z.string().optional(),
  kartIndex: z.number().int().min(0).max(7).optional().default(0)
});

export const UpdateCustomizationSchema = z.object({
  color: z.string().optional(),
  kartIndex: z.number().int().min(0).max(7).optional()
});

export const KickPlayerSchema = z.object({
  targetPlayerId: z.string().min(1, 'Target player ID required')
});

export const PlayerInputSchema = z.object({
  forward: z.boolean(),
  backward: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  drift: z.boolean().optional().default(false),
  fire: z.boolean().optional().default(false),
  boost: z.boolean().optional().default(false),
  sequenceNumber: z.number().int().nonnegative(),
  timestamp: z.number().positive()
});
