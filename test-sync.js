const { io } = require('./frontend/node_modules/socket.io-client');

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
  });
}

async function runSyncTest() {
  console.log('--- STARTING PHASE 5 MULTIPLAYER SYNCHRONIZATION TEST ---');

  const alice = io('http://localhost:3000');
  const bob = io('http://localhost:3000');

  await Promise.all([waitForConnect(alice), waitForConnect(bob)]);
  console.log(`✓ Both clients connected: Alice (${alice.id}), Bob (${bob.id})`);

  let roomCode = '';

  // 1. Alice creates room
  const createPromise = new Promise((resolve) => {
    alice.once('room:created', (room) => {
      roomCode = room.code;
      console.log(`✓ Alice created room: ${roomCode}`);
      resolve();
    });
  });
  alice.emit('room:create', { playerName: 'Alice', color: '#EF4444' });
  await createPromise;

  // 2. Bob joins room
  const joinPromise = new Promise((resolve) => {
    bob.once('room:joined', (room) => {
      console.log(`✓ Bob joined room: ${room.code}`);
      resolve();
    });
  });
  bob.emit('room:join', { roomCode, playerName: 'Bob', color: '#3B82F6' });
  await joinPromise;

  // 3. Bob readies up
  const readyPromise = new Promise((resolve) => {
    alice.on('room:state', function handler(room) {
      if (room.players.every((p) => p.isReady)) {
        alice.off('room:state', handler);
        console.log('✓ All players marked ready in room');
        resolve();
      }
    });
  });
  bob.emit('player:ready', true);
  await readyPromise;

  // 4. Alice starts match (countdown -> playing)
  const matchStartPromise = new Promise((resolve) => {
    bob.once('game:started', (data) => {
      console.log(`✓ Authoritative match started on server! Match ID: ${data.matchId}`);
      resolve();
    });
  });
  alice.emit('game:start');
  console.log('⏳ Match countdown initiated...');
  await matchStartPromise;

  // 5. Alice begins sending forward input stream
  console.log('🚀 Alice sending forward acceleration input stream to server...');
  let seq = 1;
  const inputInterval = setInterval(() => {
    alice.emit('player:input', {
      forward: true,
      backward: false,
      left: false,
      right: false,
      drift: false,
      fire: false,
      boost: false,
      sequenceNumber: seq++,
      timestamp: Date.now()
    });
  }, 33); // 30Hz input stream

  // 6. Test snapshot reception and authoritative movement validation on Bob's client
  let snapshotCount = 0;
  let initialAlicePos = null;
  let finalAlicePos = null;

  const snapshotPromise = new Promise((resolve, reject) => {
    bob.on('game:snapshot', (snapshot) => {
      snapshotCount++;
      const aliceInSnap = snapshot.players.find((p) => p.id === alice.id);

      if (aliceInSnap) {
        if (!initialAlicePos) {
          initialAlicePos = { ...aliceInSnap.physics.position };
        }
        finalAlicePos = { ...aliceInSnap.physics.position };

        if (snapshotCount >= 30) {
          // Collected ~1 second of 30Hz snapshots
          clearInterval(inputInterval);
          bob.off('game:snapshot');
          resolve();
        }
      }
    });

    setTimeout(() => {
      clearInterval(inputInterval);
      reject(new Error('Timed out waiting for 30Hz snapshots from server'));
    }, 5000);
  });

  await snapshotPromise;

  const deltaX = finalAlicePos.x - initialAlicePos.x;
  const deltaZ = finalAlicePos.z - initialAlicePos.z;
  const distanceMoved = Math.sqrt(deltaX ** 2 + deltaZ ** 2);

  console.log(`✓ Received ${snapshotCount} authoritative 30Hz snapshots over Socket.IO`);
  console.log(`✓ Alice initial position: (${initialAlicePos.x.toFixed(2)}, ${initialAlicePos.z.toFixed(2)})`);
  console.log(`✓ Alice final position: (${finalAlicePos.x.toFixed(2)}, ${finalAlicePos.z.toFixed(2)})`);
  console.log(`✓ Authoritative distance moved: ${distanceMoved.toFixed(2)} units`);

  if (distanceMoved < 1.0) {
    throw new Error('Alice did not move forward authoritatively on the server!');
  }

  // 7. Test Nitro Boost Synchronization
  const boostPromise = new Promise((resolve) => {
    bob.once('game:snapshot', (snapshot) => {
      const aliceInSnap = snapshot.players.find((p) => p.id === alice.id);
      if (aliceInSnap && aliceInSnap.physics.isBoosting) {
        console.log('✓ Nitro Boost status synchronized authoritatively in snapshot: isBoosting = true');
        resolve();
      }
    });
  });
  alice.emit('player:boost');
  await boostPromise;

  alice.disconnect();
  bob.disconnect();

  console.log('--- ALL PHASE 5 SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runSyncTest().catch((err) => {
  console.error('Phase 5 test failed:', err);
  process.exit(1);
});
