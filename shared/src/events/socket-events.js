"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerToClientEvents = exports.ClientToServerEvents = void 0;
var ClientToServerEvents;
(function (ClientToServerEvents) {
    ClientToServerEvents["ROOM_CREATE"] = "room:create";
    ClientToServerEvents["ROOM_JOIN"] = "room:join";
    ClientToServerEvents["ROOM_LEAVE"] = "room:leave";
    ClientToServerEvents["PLAYER_READY"] = "player:ready";
    ClientToServerEvents["GAME_START"] = "game:start";
    ClientToServerEvents["PLAYER_INPUT"] = "player:input";
    ClientToServerEvents["WEAPON_FIRE"] = "weapon:fire";
    ClientToServerEvents["PLAYER_BOOST"] = "player:boost";
    ClientToServerEvents["PLAYER_PING"] = "player:ping";
})(ClientToServerEvents || (exports.ClientToServerEvents = ClientToServerEvents = {}));
var ServerToClientEvents;
(function (ServerToClientEvents) {
    ServerToClientEvents["ROOM_CREATED"] = "room:created";
    ServerToClientEvents["ROOM_JOINED"] = "room:joined";
    ServerToClientEvents["ROOM_STATE"] = "room:state";
    ServerToClientEvents["ROOM_ERROR"] = "room:error";
    ServerToClientEvents["GAME_COUNTDOWN"] = "game:countdown";
    ServerToClientEvents["GAME_STARTED"] = "game:started";
    ServerToClientEvents["GAME_SNAPSHOT"] = "game:snapshot";
    ServerToClientEvents["PLAYER_ELIMINATED"] = "player:eliminated";
    ServerToClientEvents["LEADERBOARD_UPDATE"] = "leaderboard:update";
    ServerToClientEvents["GAME_FINISHED"] = "game:finished";
    ServerToClientEvents["PLAYER_DISCONNECTED"] = "player:disconnected";
    ServerToClientEvents["PLAYER_RECONNECTED"] = "player:reconnected";
    ServerToClientEvents["PLAYER_PONG"] = "player:pong";
})(ServerToClientEvents || (exports.ServerToClientEvents = ServerToClientEvents = {}));
//# sourceMappingURL=socket-events.js.map