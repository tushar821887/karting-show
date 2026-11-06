const RAPIER = require('./frontend/node_modules/@dimforge/rapier3d-compat');

async function testPhysics() {
  console.log('--- STARTING PHASE 4 RAPIER.JS PHYSICS & COLLISION TEST ---');

  // 1. Initialize WASM
  await RAPIER.init();
  console.log('✓ Rapier3D WebAssembly initialized');

  // 2. Create World with Arcade Gravity
  const world = new RAPIER.World({ x: 0, y: -25, z: 0 });
  console.log('✓ Rapier World created with gravity y = -25');

  // 3. Create Static Floor
  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), floorBody);
  console.log('✓ Static floor collider created (60x60 units)');

  // 4. Create Perimeter Circular Boundary Colliders (48 segments, radius 45)
  const segments = 48;
  const radius = 45;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const chord = 2 * radius * Math.sin(Math.PI / segments) * 1.05;

    const b = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, 2.0, z)
        .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(chord / 2, 2.0, 0.5), b);
  }
  console.log(`✓ 48 perimeter boundary wall colliders created along radius ${radius}`);

  // 5. Create Kart Dynamic RigidBody
  const kartBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.4, 0)
      .setLinearDamping(0.6)
      .setAngularDamping(3.0)
      .enabledRotations(false, true, false)
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.85, 0.35, 1.3).setFriction(0.5).setRestitution(0.2), kartBody);
  console.log('✓ Kart dynamic RigidBody created with locked X/Z rotation and dynamic Y yaw');

  // 6. Test Forward Acceleration Impulse
  const dt = 1 / 60;
  for (let frame = 0; frame < 30; frame++) {
    kartBody.applyImpulse({ x: 0, y: 0, z: -1100 * dt }, true);
    world.step();
  }
  const velForward = kartBody.linvel();
  console.log(`✓ Forward acceleration: linear velocity z = ${velForward.z.toFixed(2)} units/s (expected negative z)`);
  if (velForward.z >= 0) {
    throw new Error('Kart failed to accelerate forward along -Z');
  }

  // 7. Test Steering Angular Torque
  kartBody.setAngvel({ x: 0, y: 5.0, z: 0 }, true);
  world.step();
  const angVel = kartBody.angvel();
  console.log(`✓ Steering yaw torque applied: angular velocity y = ${angVel.y.toFixed(2)} rad/s`);
  if (angVel.y <= 0) {
    throw new Error('Kart failed to rotate around Y axis');
  }

  // 8. Test Boundary Collision & Containment
  // Place kart traveling towards the boundary at high speed
  kartBody.setTranslation({ x: 0, y: 0.4, z: 42 }, true);
  kartBody.setLinvel({ x: 0, y: 0, z: 50 }, true);

  for (let frame = 0; frame < 60; frame++) {
    world.step();
  }

  const finalPos = kartBody.translation();
  const finalDistFromCenter = Math.sqrt(finalPos.x ** 2 + finalPos.z ** 2);
  console.log(`✓ Boundary containment test: kart distance from center after high-speed collision = ${finalDistFromCenter.toFixed(2)} units (limit <= 46.5)`);
  if (finalDistFromCenter > 46.5) {
    throw new Error('Kart escaped outside the perimeter boundary!');
  }

  world.free();
  console.log('✓ Physics world freed and GPU/WASM memory disposed cleanly');
  console.log('--- ALL PHASE 4 RAPIER.JS TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

testPhysics().catch((err) => {
  console.error('Phase 4 physics test failed:', err);
  process.exit(1);
});
