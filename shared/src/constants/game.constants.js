"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONSTANTS = void 0;
exports.GAME_CONSTANTS = {
    // Networking & Ticks
    SERVER_TICK_RATE: 30, // 30 ticks per sec
    SERVER_TICK_INTERVAL_MS: 1000 / 30, // ~33.33ms
    CLIENT_TARGET_FPS: 60,
    // Room limits
    ROOM_CODE_LENGTH: 6,
    MIN_PLAYERS_PER_ROOM: 2,
    MAX_PLAYERS_PER_ROOM: 8,
    COUNTDOWN_DURATION_SECONDS: 3,
    // Player Stats
    STARTING_HEALTH: 100,
    MAX_HEALTH: 100,
    // Weapon Stats (Rocket)
    ROCKET_DAMAGE: 25,
    ROCKET_COOLDOWN_MS: 2000,
    ROCKET_MAX_RANGE: 30,
    ROCKET_SPEED: 40,
    ROCKET_HITBOX_RADIUS: 1.2,
    ROCKET_EXPLOSION_RADIUS: 3.5,
    // Speed Boost
    BOOST_DURATION_MS: 3000,
    BOOST_COOLDOWN_MS: 8000,
    BOOST_SPEED_MULTIPLIER: 1.6,
    // Arena Dimensions
    ARENA_RADIUS: 45,
    ARENA_BOUNDARY_LIMIT: 50,
    // Kart Physics Constants
    KART_MAX_SPEED: 22,
    KART_REVERSE_MAX_SPEED: 8,
    KART_ACCELERATION: 18,
    KART_BRAKING: 25,
    KART_TURN_SPEED: 2.8,
    KART_FRICTION: 0.94,
    // Available Kart Colors
    PLAYER_COLORS: [
        '#EF4444', // Red
        '#3B82F6', // Blue
        '#10B981', // Emerald
        '#F59E0B', // Amber
        '#8B5CF6', // Purple
        '#EC4899', // Pink
        '#06B6D4', // Cyan
        '#84CC16' // Lime
    ]
};
//# sourceMappingURL=game.constants.js.map