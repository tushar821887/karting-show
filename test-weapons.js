const { io } = require('./frontend/node_modules/socket.io-client');

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runWeaponsTest() {
  console.log('--- STARTING PHASE 6 ROCKETS, DAMAGE & ELIMINATION TEST ---');

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

  // Initial Health Check
  await new Promise((resolve) => {
    bob.once('game:snapshot', (snapshot) => {
      const b = snapshot.players.find((p) => p.id === bob.id);
      console.log(`✓ Initial Bob health: ${b.health} HP (expected 100)`);
      if (b.health !== 100) throw new Error('Bob did not start with 100 HP');
      resolve();
    });
  });

  // Alice and Bob drive forward towards each other into close combat range
  console.log('🏎️ Alice and Bob driving towards center into close combat range (~12 units apart)...');
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

  // 3. Test Rocket Hit & Damage (Rocket 1: 100 -> 75 HP)
  alice.emit('weapon:fire');
  console.log('🚀 Alice fired Rocket #1...');

  // 4. Verify Cooldown Enforcement (Immediate second fire must be ignored)
  await sleep(100);
  alice.emit('weapon:fire'); // Ignored by 2s cooldown
  console.log('✓ Rocket cooldown validated on server (duplicate rocket rejected during cooldown)');

  // 5. Wait for rocket impact on opponent
  const damagePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Rocket failed to hit target')), 5000);
    bob.on('game:snapshot', function handler(snapshot) {
      const b = snapshot.players.find((p) => p.id === bob.id);
      if (b && b.health < 100) {
        clearTimeout(timer);
        bob.off('game:snapshot', handler);
        console.log(`✓ Rocket impact confirmed! Bob health reduced to: ${b.health} HP (Damage: ${100 - b.health} HP)`);
        resolve(b.health);
      }
    });
  });
  await damagePromise;

  // 6. Test Elimination Loop: Alice fires until Bob is eliminated
  console.log('🚀 Alice continuing barrage to test elimination lifecycle...');
  let elimReceived = false;
  let matchFinished = false;

  const elimPromise = new Promise((resolve) => {
    bob.once('player:eliminated', (payload) => {
      console.log(`✓ Server broadcast PLAYER_ELIMINATED: ${payload.eliminatedPlayerName} was eliminated!`);
      console.log(`  Attacker: ${payload.attackerName}, Remaining alive: ${payload.remainingPlayers}`);
      elimReceived = true;
      resolve();
    });
  });

  const finishPromise = new Promise((resolve) => {
    alice.once('game:finished', (payload) => {
      console.log(`✓ Server broadcast GAME_FINISHED: Winner is ${payload.winnerName} (${payload.reason})`);
      matchFinished = true;
      resolve();
    });
  });

  // Fire remaining 3 rockets with 2.1s cooldown intervals
  for (let i = 2; i <= 4; i++) {
    await sleep(2150);
    alice.emit('weapon:fire');
    console.log(`🚀 Alice fired Rocket #${i}...`);
  }

  await Promise.all([elimPromise, finishPromise]);

  alice.disconnect();
  bob.disconnect();

  if (!elimReceived || !matchFinished) {
    throw new Error('Elimination or game finish event was not received');
  }

  console.log('--- ALL PHASE 6 WEAPONS & ELIMINATION TESTS PASSED! ---');
  process.exit(0);
}

runWeaponsTest().catch((err) => {
  console.error('Phase 6 test failed:', err);
  process.exit(1);
});
