import * as THREE from 'three';
import { GAME_CONSTANTS } from '@kart-battle/shared';

export interface ObstacleCollider {
  type: 'box' | 'cylinder';
  position: THREE.Vector3;
  size?: THREE.Vector3; // for box: width, height, depth
  radius?: number; // for cylinder
}

export class Arena {
  public readonly group: THREE.Group;
  public readonly colliders: ObstacleCollider[] = [];
  private animatedElements: THREE.Object3D[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'battle_arena';

    this.createLights();
    this.createGround();
    this.createBoundaryWalls();
    this.createObstacles();
    this.createPowerupPads();
    this.createSpeedPads();
  }

  private createLights(): void {
    // 1. Ambient Light
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.group.add(ambient);

    // 2. Main Sun Directional Light
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(25, 45, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    const d = 50;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    this.group.add(sun);

    // 3. Hemisphere Sky / Ground Light
    const hemi = new THREE.HemisphereLight(0x00f0ff, 0x1a0933, 0.6);
    this.group.add(hemi);

    // 4. Colorful Corner Accent Lights
    const accents = [
      { color: 0x00f0ff, pos: [28, 6, 28] },
      { color: 0xff007f, pos: [-28, 6, 28] },
      { color: 0xffb800, pos: [28, 6, -28] },
      { color: 0x00ff88, pos: [-28, 6, -28] }
    ];

    accents.forEach((a) => {
      const pLight = new THREE.PointLight(a.color, 2.5, 40, 1.5);
      pLight.position.set(a.pos[0], a.pos[1], a.pos[2]);
      this.group.add(pLight);
    });
  }

  private createGround(): void {
    const radius = GAME_CONSTANTS.ARENA_RADIUS;

    // Outer Circular Base
    const groundGeo = new THREE.CylinderGeometry(radius, radius, 1.0, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f1d,
      roughness: 0.4,
      metalness: 0.3
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Inner Battle Track Surface (Decorative Rings)
    const ringRadii = [15, 28, 40];
    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.25, r + 0.25, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? 0x00f0ff : 0xff007f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.group.add(ring);
    });

    // Center Battle Emblem
    const centerGeo = new THREE.CircleGeometry(6, 32);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x141a33,
      roughness: 0.3,
      metalness: 0.6
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.03;
    center.receiveShadow = true;
    this.group.add(center);
  }

  private createBoundaryWalls(): void {
    const radius = GAME_CONSTANTS.ARENA_RADIUS;
    const height = 4.0;

    // Translucent Neon Outer Perimeter Barrier
    const wallGeo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0066aa,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = height / 2;
    this.group.add(wall);

    // Glowing Neon Top Rim
    const rimGeo = new THREE.TorusGeometry(radius, 0.25, 8, 64);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    this.group.add(rim);

    // Lower Energy Base Rim
    const baseRimMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const baseRim = new THREE.Mesh(rimGeo, baseRimMat);
    baseRim.rotation.x = Math.PI / 2;
    baseRim.position.y = 0.2;
    this.group.add(baseRim);
  }

  private createObstacles(): void {
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x222a45,
      roughness: 0.4,
      metalness: 0.7
    });

    const neonTrimMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x181e36,
      roughness: 0.3,
      metalness: 0.8
    });

    // 4 Corner Barrier Bunkers
    const bunkerPositions = [
      { x: 18, z: 18 },
      { x: -18, z: 18 },
      { x: 18, z: -18 },
      { x: -18, z: -18 }
    ];

    bunkerPositions.forEach(({ x, z }) => {
      // Main Bunker Block
      const blockGeo = new THREE.BoxGeometry(4.5, 2.5, 4.5);
      const block = new THREE.Mesh(blockGeo, crateMat);
      block.position.set(x, 1.25, z);
      block.castShadow = true;
      block.receiveShadow = true;
      this.group.add(block);

      // Neon Trim Top
      const trimGeo = new THREE.BoxGeometry(4.6, 0.15, 4.6);
      const trim = new THREE.Mesh(trimGeo, neonTrimMat);
      trim.position.set(x, 2.55, z);
      this.group.add(trim);

      // Add Collider
      this.colliders.push({
        type: 'box',
        position: new THREE.Vector3(x, 1.25, z),
        size: new THREE.Vector3(4.8, 2.5, 4.8)
      });
    });

    // 4 Inner Guard Pillars
    const pillarAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    pillarAngles.forEach((angle) => {
      const px = Math.cos(angle) * 9;
      const pz = Math.sin(angle) * 9;

      const pGeo = new THREE.CylinderGeometry(0.9, 1.1, 4.0, 16);
      const pillar = new THREE.Mesh(pGeo, pillarMat);
      pillar.position.set(px, 2.0, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.group.add(pillar);

      // Glowing Beacon Top
      const bGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const bMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const beacon = new THREE.Mesh(bGeo, bMat);
      beacon.position.set(px, 4.2, pz);
      this.group.add(beacon);

      // Add Collider
      this.colliders.push({
        type: 'cylinder',
        position: new THREE.Vector3(px, 2.0, pz),
        radius: 1.2
      });
    });
  }

  private createPowerupPads(): void {
    // 4 Powerup Spawn Pads around arena
    const padLocations = [
      { x: 0, z: 24 },
      { x: 0, z: -24 },
      { x: 24, z: 0 },
      { x: -24, z: 0 }
    ];

    const padMat = new THREE.MeshStandardMaterial({
      color: 0x1a213d,
      roughness: 0.2,
      metalness: 0.8
    });

    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xffb800,
      emissive: 0xff8800,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9
    });

    padLocations.forEach(({ x, z }) => {
      // Pad base
      const padGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.2, 16);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(x, 0.1, z);
      this.group.add(pad);

      // Glowing pad ring
      const ringGeo = new THREE.RingGeometry(1.3, 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb800, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.22, z);
      this.group.add(ring);

      // Floating Holographic Diamond / Gem
      const gemGeo = new THREE.OctahedronGeometry(0.7, 0);
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(x, 1.4, z);
      this.group.add(gem);
      this.animatedElements.push(gem);
    });
  }

  private createSpeedPads(): void {
    // 2 Nitro Speed Pads
    const boostLocations = [
      { x: 12, z: 0, rot: -Math.PI / 2 },
      { x: -12, z: 0, rot: Math.PI / 2 }
    ];

    boostLocations.forEach(({ x, z, rot }) => {
      const padGroup = new THREE.Group();
      padGroup.position.set(x, 0.04, z);
      padGroup.rotation.y = rot;

      const chevronGeo = new THREE.PlaneGeometry(2.5, 4.0);
      const chevronMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      const chevron = new THREE.Mesh(chevronGeo, chevronMat);
      chevron.rotation.x = -Math.PI / 2;
      padGroup.add(chevron);

      this.group.add(padGroup);
    });
  }

  public update(dt: number): void {
    // Rotate holographic powerup gems
    this.animatedElements.forEach((elem) => {
      elem.rotation.y += 1.8 * dt;
      elem.rotation.x += 0.8 * dt;
    });
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }
}
