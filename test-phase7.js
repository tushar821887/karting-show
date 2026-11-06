const { io } = require('./frontend/node_modules/socket.io-client');

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPhase7Test() {
  console.log('--- STARTING PHASE 7 LIVE LEADERBOARD & WINNER CEREMONY TEST ---');

  const alice = io('http://localhost:3000');
  const bob = io('http://localhost:3000');

  await Promise.all([waitForConnect(alice), waitForConnect(bob)]);
  console.log(`✓ Alice (${alice.id}) and Bob (${bob.id}) connected`);

  let roomCode = '';

  // 1. Create Room & Join
  await new Promise((resolve) => {
    alice.once('room:created', (room) => {
      roomCode = room.code;
      resolve();
    });
    alice.emit('room:create', { playerName: 'Alice', color: '#EF4444' });
  });

  await new Promise((resolve) => {
    bob.once('room:joined', resolve);
    bob.emit('room:join', { roomCode, playerName: 'Bob', color: '#3B82F6' });
  });

  // 2. Ready & Start
  const readyPromise = new Promise((resolve) => {
    alice.on('room:state', function handler(room) {
      if (room.players.every((p) => p.isReady)) {
        alice.off('room:state', handler);
        resolve();
      }
    });
  });
  bob.emit('player:ready', true);
  await readyPromise;

  const matchStartPromise = new Promise((resolve) => {
    bob.once('game:started', (data) => {
      console.log(`✓ Match started: ${data.matchId}`);
      resolve();
    });
  });
  alice.emit('game:start');
  await matchStartPromise;

  // 3. Move karts into combat range
  console.log('🏎️ Karts moving into combat position...');
  for (let f = 0; f < 45; f++) {
    alice.emit('player:input', {
      forward: true,
      backward: false,
      left: false,
      right: false,
      drift: false,
      fire: false,
      boost: false,
      sequenceNumber: f + 1,
      timestamp: Date.now()
    });
    if (f < 35) {
      bob.emit('player:input', {
        forward: true,
        backward: false,
        left: false,
        right: false,
        drift: false,
        fire: false,
        boost: false,
        sequenceNumber: f + 1,
        timestamp: Date.now()
      });
    }
    await sleep(30);
  }

  // 4. Setup listeners for leaderboard update and game finished
  let leaderboardUpdated = false;
  let finishedPayload = null;
  let roomResetToWaiting = false;

  bob.on('leaderboard:update', (leaderboard) => {
    console.log(`✓ Real-time LEADERBOARD_UPDATE received: ${leaderboard.length} entries`);
    leaderboard.forEach((entry) => {
      console.log(`  #${entry.rank} ${entry.playerName}: ${entry.health} HP, ${entry.eliminations} Kills, Score: ${entry.score}, Alive: ${entry.isAlive}`);
    });
    leaderboardUpdated = true;
  });

  const finishPromise = new Promise((resolve) => {
    alice.once('game:finished', (payload) => {
      console.log(`✓ GAME_FINISHED received!`);
      console.log(`  Winner: ${payload.winnerName} (${payload.reason})`);
      console.log(`  Match Duration: ${payload.durationSeconds}s`);
      console.log(`  Leaderboard size: ${payload.leaderboard.length}`);
      finishedPayload = payload;
      resolve();
    });
  });

  const roomResetPromise = new Promise((resolve) => {
    alice.on('room:state', function handler(room) {
      if (room.status === 'WAITING') {
        alice.off('room:state', handler);
        console.log(`✓ Room ${room.code} reset to WAITING status with unready players for rematch!`);
        roomResetToWaiting = true;
        resolve();
      }
    });
  });

  // 5. Alice fires rockets to eliminate Bob
  console.log('🚀 Firing rocket barrage to trigger elimination & finish match...');
  for (let i = 1; i <= 4; i++) {
    alice.emit('weapon:fire');
    console.log(`  Rocket #${i} fired`);
    await sleep(2150);
  }

  await Promise.all([finishPromise, roomResetPromise]);

  // 6. Validation
  if (!finishedPayload) {
    throw new Error('Game finished payload was not received');
  }

  if (finishedPayload.winnerName !== 'Alice') {
    throw new Error(`Expected winner Alice, got ${finishedPayload.winnerName}`);
  }

  if (finishedPayload.leaderboard.length !== 2) {
    throw new Error(`Expected 2 leaderboard entries, got ${finishedPayload.leaderboard.length}`);
  }

  const firstPlace = finishedPayload.leaderboard[0];
  const secondPlace = finishedPayload.leaderboard[1];

  if (firstPlace.playerName !== 'Alice' || !firstPlace.isAlive || firstPlace.eliminations !== 1) {
    throw new Error(`Invalid first place entry: ${JSON.stringify(firstPlace)}`);
  }

  if (secondPlace.playerName !== 'Bob' || secondPlace.isAlive || secondPlace.health !== 0) {
    throw new Error(`Invalid second place entry: ${JSON.stringify(secondPlace)}`);
  }

  console.log('✓ Winner: Alice correctly placed #1 with 1 kill');
  console.log('✓ Runner-up: Bob correctly placed #2 (Eliminated, 0 HP)');
  console.log(`✓ Room reset state confirmed: ${roomResetToWaiting}`);

  alice.disconnect();
  bob.disconnect();

  console.log('--- ALL PHASE 7 LEADERBOARD & WINNER CEREMONY TESTS PASSED! ---');
  process.exit(0);
}

runPhase7Test().catch((err) => {
  console.error('Phase 7 test failed:', err);
  process.exit(1);
});
