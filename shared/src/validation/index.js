"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerInputSchema = exports.JoinRoomSchema = exports.CreateRoomSchema = void 0;
const zod_1 = require("zod");
const game_constants_1 = require("../constants/game.constants");
exports.CreateRoomSchema = zod_1.z.object({
    playerName: zod_1.z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(16, 'Name cannot exceed 16 characters')
        .regex(/^[a-zA-Z0-9 _-]+$/, 'Name can only contain letters, numbers, spaces, underscores, and hyphens'),
    color: zod_1.z.string().optional(),
    kartIndex: zod_1.z.number().int().min(0).max(7).optional().default(0)
});
exports.JoinRoomSchema = zod_1.z.object({
    roomCode: zod_1.z
        .string()
        .trim()
        .length(game_constants_1.GAME_CONSTANTS.ROOM_CODE_LENGTH, `Room code must be exactly ${game_constants_1.GAME_CONSTANTS.ROOM_CODE_LENGTH} characters`)
        .toUpperCase(),
    playerName: zod_1.z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(16, 'Name cannot exceed 16 characters')
        .regex(/^[a-zA-Z0-9 _-]+$/, 'Name can only contain letters, numbers, spaces, underscores, and hyphens'),
    color: zod_1.z.string().optional(),
    kartIndex: zod_1.z.number().int().min(0).max(7).optional().default(0)
});
exports.PlayerInputSchema = zod_1.z.object({
    forward: zod_1.z.boolean(),
    backward: zod_1.z.boolean(),
    left: zod_1.z.boolean(),
    right: zod_1.z.boolean(),
    drift: zod_1.z.boolean().optional().default(false),
    fire: zod_1.z.boolean().optional().default(false),
    boost: zod_1.z.boolean().optional().default(false),
    sequenceNumber: zod_1.z.number().int().nonnegative(),
    timestamp: zod_1.z.number().positive()
});
//# sourceMappingURL=index.js.map