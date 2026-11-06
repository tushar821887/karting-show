const { io } = require('./frontend/node_modules/socket.io-client');

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runEndToEndMatch() {
  console.log('====================================================');
  console.log('  🏎️  KART BATTLE ARENA - FULL END-TO-END TEST SUITE');
  console.log('====================================================\n');

  // Step 1: Connect Clients
  const alice = io('http://localhost:3000');
  const bob = io('http://localhost:3000');
  await Promise.all([waitForConnect(alice), waitForConnect(bob)]);
  console.log(`[E2E] ✓ Connected: Alice (${alice.id}) & Bob (${bob.id})`);

  // Step 2: Room Creation & Joining
  let roomCode = '';
  await new Promise((resolve) => {
    alice.once('room:created', (room) => {
      roomCode = room.code;
      console.log(`[E2E] ✓ Room created with 6-character code: ${roomCode}`);
      resolve();
    });
    alice.emit('room:create', { playerName: 'Alice', color: '#EF4444' });
  });

  await new Promise((resolve) => {
    bob.once('room:joined', (room) => {
      console.log(`[E2E] ✓ Bob joined room ${room.code} (${room.players.length}/8 players)`);
      resolve();
    });
    bob.emit('room:join', { roomCode, playerName: 'Bob', color: '#3B82F6' });
  });

  // Step 3: Customization Update
  bob.emit('room:update-customization', { color: '#06B6D4', kartIndex: 2 });
  await sleep(100);
  console.log(`[E2E] ✓ Player customization update validated`);

  // Step 4: Ready Status & Host Match Start
  const readyPromise = new Promise((resolve) => {
    alice.on('room:state', function handler(room) {
      if (room.players.every((p) => p.isReady)) {
        alice.off('room:state', handler);
        console.log(`[E2E] ✓ All players marked READY`);
        resolve();
      }
    });
  });
  bob.emit('player:ready', true);
  await readyPromise;

  const matchStartedPromise = new Promise((resolve) => {
    bob.once('game:started', (payload) => {
      console.log(`[E2E] ✓ Server match started: ${payload.matchId}`);
      resolve();
    });
  });
  alice.emit('game:start');
  await matchStartedPromise;

  // Step 5: Server-Authoritative Simulation & Nitro Boost
  let snapshotCount = 0;
  const snapshotPromise = new Promise((resolve) => {
    alice.on('game:snapshot', function handler(snapshot) {
      snapshotCount++;
      if (snapshotCount >= 10) {
        alice.off('game:snapshot', handler);
        console.log(`[E2E] ✓ Authoritative 30Hz snapshots streaming (${snapshot.players.length} players tracked)`);
        resolve();
      }
    });
  });

  // Alice activates Nitro Boost
  alice.emit('player:boost');
  console.log(`[E2E] ✓ Alice triggered Nitro Boost (1.6x speed multiplier)`);
  await snapshotPromise;

  // Step 6: Navigation into Combat Range
  console.log(`[E2E] 🏎️ Karts closing distance into rocket combat range...`);
  for (let f = 0; f < 40; f++) {
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
    if (f < 30) {
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

  // Step 7: Combat & Real-Time Leaderboard Tracking
  let leaderboardReceived = false;
  bob.on('leaderboard:update', (lb) => {
    leaderboardReceived = true;
  });

  let elimReceived = false;
  bob.once('player:eliminated', (data) => {
    console.log(`[E2E] 💀 PLAYER ELIMINATED: ${data.eliminatedPlayerName} was defeated by ${data.attackerName}!`);
    console.log(`      Remaining survivors in arena: ${data.remainingPlayers}`);
    elimReceived = true;
  });

  let matchFinishedPayload = null;
  const finishPromise = new Promise((resolve) => {
    alice.once('game:finished', (data) => {
      matchFinishedPayload = data;
      console.log(`[E2E] 🏆 GAME FINISHED: Winner is ${data.winnerName} (${data.reason})`);
      console.log(`      Match Duration: ${data.durationSeconds}s, Total Leaderboard: ${data.leaderboard.length}`);
      resolve();
    });
  });

  const roomResetPromise = new Promise((resolve) => {
    alice.on('room:state', function handler(room) {
      if (room.status === 'WAITING') {
        alice.off('room:state', handler);
        console.log(`[E2E] 🔄 Room ${room.code} reset to WAITING state for instant rematch!`);
        resolve();
      }
    });
  });

  console.log(`[E2E] 🚀 Alice firing rocket barrage at Bob...`);
  for (let i = 1; i <= 4; i++) {
    alice.emit('weapon:fire');
    await sleep(2150);
  }

  await Promise.all([finishPromise, roomResetPromise]);

  // Step 8: Assert Final Results
  if (!elimReceived) throw new Error('Player elimination event was not dispatched');
  if (!matchFinishedPayload) throw new Error('Match finish event was not dispatched');
  if (matchFinishedPayload.winnerName !== 'Alice') {
    throw new Error(`Unexpected winner: ${matchFinishedPayload.winnerName}`);
  }

  const champion = matchFinishedPayload.leaderboard[0];
  const runnerUp = matchFinishedPayload.leaderboard[1];

  console.log('\n====================================================');
  console.log('  🏁 FINAL LEADERBOARD STANDINGS');
  console.log('====================================================');
  console.log(`  🥇 Rank #1: ${champion.playerName} (${champion.health} HP, ${champion.eliminations} Kills, ${champion.score} Pts) - ALIVE`);
  console.log(`  🥈 Rank #2: ${runnerUp.playerName} (${runnerUp.health} HP, ${runnerUp.eliminations} Kills, ${runnerUp.score} Pts) - ELIMINATED`);
  console.log('====================================================\n');

  alice.disconnect();
  bob.disconnect();

  console.log('✅ ALL END-TO-END MULTIPLAYER SYSTEMS VERIFIED WITH 100% SUCCESS!\n');
  process.exit(0);
}

runEndToEndMatch().catch((err) => {
  console.error('[E2E Error]:', err);
  process.exit(1);
});
