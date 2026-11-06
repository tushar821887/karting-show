const { io } = require('./frontend/node_modules/socket.io-client');

function waitForConnect(socket) {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
  });
}

async function runTest() {
  console.log('--- STARTING PHASE 2 E2E MULTIPLAYER ROOM TEST ---');
  
  const client1 = io('http://localhost:3000');
  await waitForConnect(client1);
  console.log('✓ Host (Alice) connected:', client1.id);

  let roomCode = '';

  // 1. Host creates room
  const createdPromise = new Promise((resolve) => {
    client1.on('room:created', (room) => {
      roomCode = room.code;
      console.log('✓ Room created with 6-char code:', roomCode, 'Host:', room.hostId);
      resolve(room);
    });
  });
  client1.emit('room:create', { playerName: 'Alice', color: '#EF4444' });
  await createdPromise;

  // 2. Client 2 tests invalid room code
  const client2 = io('http://localhost:3000');
  await waitForConnect(client2);
  const invalidPromise = new Promise((resolve) => {
    client2.once('room:error', (err) => {
      console.log('✓ Expected rejection on invalid room code:', err.message);
      resolve();
    });
  });
  client2.emit('room:join', { roomCode: 'ZZZZZZ', playerName: 'Bob' });
  await invalidPromise;

  // 3. Client 2 joins valid room
  const joinPromise = new Promise((resolve) => {
    client2.once('room:joined', (room) => {
      console.log('✓ Bob successfully joined room:', room.code, 'Players in room:', room.players.length);
      resolve(room);
    });
  });
  client2.emit('room:join', { roomCode, playerName: 'Bob', color: '#3B82F6' });
  await joinPromise;

  // 4. Bob (non-host) tries to start match -> expected failure
  const nonHostFailPromise = new Promise((resolve) => {
    client2.once('room:error', (err) => {
      console.log('✓ Non-host start rejected correctly:', err.message);
      resolve();
    });
  });
  client2.emit('game:start');
  await nonHostFailPromise;

  // 5. Host tries to start while Bob is NOT ready -> expected failure
  const unreadyFailPromise = new Promise((resolve) => {
    client1.once('room:error', (err) => {
      console.log('✓ Host start rejected while unready:', err.message);
      resolve();
    });
  });
  client1.emit('game:start');
  await unreadyFailPromise;

  // 6. Bob toggles ready
  const readyPromise = new Promise((resolve) => {
    client1.on('room:state', function handler(room) {
      const bob = room.players.find((p) => p.name === 'Bob');
      if (bob && bob.isReady) {
        console.log('✓ Bob ready status synchronized: isReady =', bob.isReady);
        client1.off('room:state', handler);
        resolve();
      }
    });
  });
  client2.emit('player:ready', true);
  await readyPromise;

  // 7. Client 3 joins (Charlie)
  const client3 = io('http://localhost:3000');
  await waitForConnect(client3);
  const charlieJoinedPromise = new Promise((resolve) => {
    client1.on('room:state', function handler(room) {
      if (room.players.length === 3) {
        console.log('✓ Charlie joined. Total players in room:', room.players.length);
        client1.off('room:state', handler);
        resolve();
      }
    });
  });
  client3.emit('room:join', { roomCode, playerName: 'Charlie', color: '#10B981' });
  await charlieJoinedPromise;

  // 8. Host kicks Charlie
  const kickPromise = new Promise((resolve) => {
    client3.once('room:kicked', (data) => {
      console.log('✓ Charlie received kicked event:', data.message);
      resolve();
    });
  });
  client1.emit('room:kick', { targetPlayerId: client3.id });
  await kickPromise;

  // Ready check after kick
  const bobReadyAgain = new Promise((resolve) => {
    client1.on('room:state', function handler(room) {
      if (room.players.length === 2 && room.players.every((p) => p.isReady)) {
        client1.off('room:state', handler);
        resolve();
      }
    });
  });
  client2.emit('player:ready', true);
  await bobReadyAgain;

  // 9. Host starts game countdown
  const countdownPromise = new Promise((resolve) => {
    client2.once('game:countdown', (data) => {
      console.log('✓ Countdown initiated successfully. Seconds remaining:', data.secondsRemaining);
      resolve();
    });
  });
  client1.emit('game:start');
  await countdownPromise;

  // 10. Wait for game:started
  const startPromise = new Promise((resolve) => {
    client1.once('game:started', (data) => {
      console.log('✓ Match started! Match ID:', data.matchId);
      resolve();
    });
  });
  await startPromise;

  client1.disconnect();
  client2.disconnect();
  client3.disconnect();

  console.log('--- ALL PHASE 2 TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
