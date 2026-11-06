export enum ClientToServerEvents {
  ROOM_CREATE = 'room:create',
  ROOM_JOIN = 'room:join',
  ROOM_LEAVE = 'room:leave',
  PLAYER_READY = 'player:ready',
  ROOM_UPDATE_CUSTOMIZATION = 'room:update-customization',
  ROOM_KICK = 'room:kick',
  GAME_START = 'game:start',
  PLAYER_INPUT = 'player:input',
  WEAPON_FIRE = 'weapon:fire',
  PLAYER_BOOST = 'player:boost',
  PLAYER_PING = 'player:ping'
}

export enum ServerToClientEvents {
  ROOM_CREATED = 'room:created',
  ROOM_JOINED = 'room:joined',
  ROOM_STATE = 'room:state',
  ROOM_ERROR = 'room:error',
  ROOM_KICKED = 'room:kicked',
  GAME_COUNTDOWN = 'game:countdown',
  GAME_STARTED = 'game:started',
  GAME_SNAPSHOT = 'game:snapshot',
  PLAYER_ELIMINATED = 'player:eliminated',
  LEADERBOARD_UPDATE = 'leaderboard:update',
  GAME_FINISHED = 'game:finished',
  PLAYER_DISCONNECTED = 'player:disconnected',
  PLAYER_RECONNECTED = 'player:reconnected',
  PLAYER_PONG = 'player:pong'
}
