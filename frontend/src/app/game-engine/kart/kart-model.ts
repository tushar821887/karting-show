import * as THREE from 'three';

export interface KartModelOptions {
  color: string;
  name: string;
  isHost?: boolean;
}

export class KartModel {
  public readonly mesh: THREE.Group;
  private bodyMaterial: THREE.MeshStandardMaterial;
  private frontWheelPivots: THREE.Group[] = [];
  private wheels: THREE.Mesh[] = [];
  private exhaustPipes: THREE.Mesh[] = [];
  private hudSprite: THREE.Sprite | null = null;
  private hudCanvas: HTMLCanvasElement;
  private hudContext: CanvasRenderingContext2D;
  private hudTexture: THREE.CanvasTexture | null = null;

  private currentHealth: number = 100;
  private maxHealth: number = 100;
  private playerName: string;
  private isHost: boolean;
  public isEliminated: boolean = false;
  private originalColor: string;

  constructor(options: KartModelOptions) {
    this.playerName = options.name;
    this.isHost = !!options.isHost;
    this.originalColor = options.color;
    this.mesh = new THREE.Group();
    this.mesh.name = `kart_${this.playerName}`;

    // Reusable Materials
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.color),
      roughness: 0.3,
      metalness: 0.5
    });

    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x121626,
      roughness: 0.5,
      metalness: 0.8
    });

    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8,
      metalness: 0.2
    });

    const wheelRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.2,
      metalness: 0.9
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.9
    });

    const neonMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    // 1. Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(1.6, 0.25, 2.8);
    const chassis = new THREE.Mesh(chassisGeo, darkMaterial);
    chassis.position.y = 0.3;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.mesh.add(chassis);

    // 2. Main Body Shell (Colored)
    const bodyGeo = new THREE.BoxGeometry(1.3, 0.45, 2.0);
    const body = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    body.position.set(0, 0.55, 0.1);
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // 3. Front Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.65, 0.8, 4);
    const nose = new THREE.Mesh(noseGeo, this.bodyMaterial);
    nose.rotation.y = Math.PI / 4;
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.45, -1.25);
    nose.scale.set(1.4, 1.0, 0.45);
    this.mesh.add(nose);

    // Front Bumper with neon edge
    const bumperGeo = new THREE.BoxGeometry(1.7, 0.15, 0.2);
    const bumper = new THREE.Mesh(bumperGeo, neonMaterial);
    bumper.position.set(0, 0.3, -1.5);
    this.mesh.add(bumper);

    // 4. Cockpit & Driver Seat
    const cockpitGeo = new THREE.BoxGeometry(0.85, 0.35, 0.9);
    const cockpit = new THREE.Mesh(cockpitGeo, darkMaterial);
    cockpit.position.set(0, 0.8, 0.05);
    this.mesh.add(cockpit);

    const seatGeo = new THREE.BoxGeometry(0.7, 0.6, 0.3);
    const seat = new THREE.Mesh(seatGeo, darkMaterial);
    seat.position.set(0, 0.95, 0.5);
    this.mesh.add(seat);

    // Steering Column & Wheel
    const colGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
    const col = new THREE.Mesh(colGeo, darkMaterial);
    col.rotation.x = Math.PI / 4;
    col.position.set(0, 0.85, -0.2);
    this.mesh.add(col);

    const wheelRimGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16);
    const steerWheel = new THREE.Mesh(wheelRimGeo, chromeMaterial);
    steerWheel.rotation.x = Math.PI / 4;
    steerWheel.position.set(0, 0.98, -0.32);
    this.mesh.add(steerWheel);

    // 5. Rear Wing / Spoiler
    const wingPostGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    const postLeft = new THREE.Mesh(wingPostGeo, darkMaterial);
    postLeft.position.set(-0.6, 0.85, 1.25);
    const postRight = postLeft.clone();
    postRight.position.x = 0.6;
    this.mesh.add(postLeft);
    this.mesh.add(postRight);

    const wingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.45);
    const wing = new THREE.Mesh(wingGeo, this.bodyMaterial);
    wing.position.set(0, 1.15, 1.25);
    this.mesh.add(wing);

    const wingNeon = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.04, 0.08), neonMaterial);
    wingNeon.position.set(0, 1.15, 1.48);
    this.mesh.add(wingNeon);

    // 6. Exhaust Pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.45, 12);
    const exLeft = new THREE.Mesh(exhaustGeo, chromeMaterial);
    exLeft.rotation.x = Math.PI / 2;
    exLeft.position.set(-0.4, 0.4, 1.45);
    const exRight = exLeft.clone();
    exRight.position.x = 0.4;
    this.mesh.add(exLeft);
    this.mesh.add(exRight);
    this.exhaustPipes.push(exLeft, exRight);

    // 7. Wheels & Pivots (Front steerable, Rear fixed)
    const wheelPositions: { pos: [number, number, number]; isFront: boolean }[] = [
      { pos: [-0.95, 0.36, -0.9], isFront: true },  // Front Left
      { pos: [0.95, 0.36, -0.9], isFront: true },   // Front Right
      { pos: [-0.98, 0.42, 0.95], isFront: false }, // Rear Left (slightly larger)
      { pos: [0.98, 0.42, 0.95], isFront: false }   // Rear Right (slightly larger)
    ];

    wheelPositions.forEach(({ pos, isFront }) => {
      const radius = isFront ? 0.36 : 0.42;
      const width = isFront ? 0.3 : 0.36;

      const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
      const tire = new THREE.Mesh(tireGeo, wheelMaterial);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;

      // Rim
      const rimGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width + 0.01, 12);
      const rim = new THREE.Mesh(rimGeo, wheelRimMaterial);
      rim.rotation.z = Math.PI / 2;
      tire.add(rim);

      if (isFront) {
        const pivot = new THREE.Group();
        pivot.position.set(...pos);
        pivot.add(tire);
        this.mesh.add(pivot);
        this.frontWheelPivots.push(pivot);
        this.wheels.push(tire);
      } else {
        const rearHolder = new THREE.Group();
        rearHolder.position.set(...pos);
        rearHolder.add(tire);
        this.mesh.add(rearHolder);
        this.wheels.push(tire);
      }
    });

    // 8. Overhead HUD Sprite (Player Name + Health Bar)
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 256;
    this.hudCanvas.height = 80;
    this.hudContext = this.hudCanvas.getContext('2d')!;
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    this.hudTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.hudTexture,
      transparent: true,
      depthTest: false
    });
    this.hudSprite = new THREE.Sprite(spriteMat);
    this.hudSprite.position.set(0, 2.2, 0);
    this.hudSprite.scale.set(2.4, 0.75, 1);
    this.mesh.add(this.hudSprite);

    this.renderHUD();
  }

  public update(speed: number, steeringAngle: number, dt: number): void {
    // Steer front wheels
    this.frontWheelPivots.forEach((pivot) => {
      pivot.rotation.y = -steeringAngle;
    });

    // Spin all wheels around their axis according to forward speed
    const spinSpeed = (speed / 0.36) * dt;
    this.wheels.forEach((w) => {
      w.rotation.x += spinSpeed;
    });
  }

  public setEliminated(eliminated: boolean): void {
    if (this.isEliminated === eliminated) return;
    this.isEliminated = eliminated;
    if (eliminated) {
      this.bodyMaterial.color.setHex(0x222226);
      this.bodyMaterial.roughness = 0.9;
    } else {
      this.bodyMaterial.color.set(this.originalColor);
      this.bodyMaterial.roughness = 0.3;
    }
    this.renderHUD();
  }

  public setHealth(health: number, maxHealth: number = 100): void {
    this.currentHealth = Math.max(0, Math.min(health, maxHealth));
    this.maxHealth = maxHealth;
    if (this.currentHealth <= 0) {
      this.setEliminated(true);
    }
    this.renderHUD();
  }

  public setColor(colorHex: string): void {
    this.bodyMaterial.color.set(colorHex);
  }

  private renderHUD(): void {
    const ctx = this.hudContext;
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background pill
    ctx.fillStyle = 'rgba(8, 12, 24, 0.75)';
    ctx.beginPath();
    ctx.roundRect(10, 8, w - 20, h - 16, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player name or Eliminated Status
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.isEliminated) {
      ctx.fillStyle = '#ff3344';
      ctx.fillText(`💀 ${this.playerName} (OUT)`, w / 2, 28);
    } else {
      ctx.fillStyle = '#ffffff';
      const nameText = this.isHost ? `👑 ${this.playerName}` : this.playerName;
      ctx.fillText(nameText, w / 2, 28);
    }

    // Health Bar Container
    const barX = 26;
    const barY = 46;
    const barW = w - 52;
    const barH = 12;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Health Fill
    const pct = this.currentHealth / this.maxHealth;
    const fillW = Math.max(0, barW * pct);

    if (pct > 0.5) {
      ctx.fillStyle = '#00ff88'; // Green
    } else if (pct > 0.25) {
      ctx.fillStyle = '#ffb800'; // Yellow
    } else {
      ctx.fillStyle = '#ff3344'; // Red
    }

    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 4);
    ctx.fill();

    if (this.hudTexture) {
      this.hudTexture.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    if (this.hudTexture) {
      this.hudTexture.dispose();
    }
  }
}
