import * as THREE from 'three';
import { RocketState, ExplosionEvent } from '@kart-battle/shared';

interface ActiveExplosion {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  initialScale: number;
  targetScale: number;
}

export class ProjectileManager {
  public readonly group: THREE.Group;
  private rocketMeshes: Map<string, THREE.Group> = new Map();
  private activeExplosions: ActiveExplosion[] = [];

  // Reusable Geometries & Materials
  private rocketBodyGeo: THREE.CylinderGeometry;
  private rocketTipGeo: THREE.ConeGeometry;
  private rocketFinGeo: THREE.BoxGeometry;
  private rocketBodyMat: THREE.MeshStandardMaterial;
  private rocketTipMat: THREE.MeshStandardMaterial;
  private rocketThrusterMat: THREE.MeshBasicMaterial;

  private explosionGeo: THREE.SphereGeometry;
  private explosionMat: THREE.MeshBasicMaterial;

  constructor(private scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'projectiles_layer';
    this.scene.add(this.group);

    // Geometries
    this.rocketBodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12);
    this.rocketTipGeo = new THREE.ConeGeometry(0.14, 0.35, 12);
    this.rocketFinGeo = new THREE.BoxGeometry(0.45, 0.04, 0.2);
    this.explosionGeo = new THREE.SphereGeometry(1.0, 16, 16);

    // Materials
    this.rocketBodyMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.8,
      roughness: 0.2
    });

    this.rocketTipMat = new THREE.MeshStandardMaterial({
      color: 0xff2244,
      metalness: 0.5,
      roughness: 0.3
    });

    this.rocketThrusterMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00
    });

    this.explosionMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
  }

  private createRocketMesh(): THREE.Group {
    const rocket = new THREE.Group();

    // Body
    const body = new THREE.Mesh(this.rocketBodyGeo, this.rocketBodyMat);
    body.rotation.x = Math.PI / 2;
    rocket.add(body);

    // Red Tip
    const tip = new THREE.Mesh(this.rocketTipGeo, this.rocketTipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.55;
    rocket.add(tip);

    // Fins
    const fin1 = new THREE.Mesh(this.rocketFinGeo, this.rocketTipMat);
    fin1.position.z = -0.3;
    const fin2 = fin1.clone();
    fin2.rotation.z = Math.PI / 2;
    rocket.add(fin1);
    rocket.add(fin2);

    // Glowing Thruster
    const flameGeo = new THREE.ConeGeometry(0.08, 0.3, 8);
    const flame = new THREE.Mesh(flameGeo, this.rocketThrusterMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -0.55;
    rocket.add(flame);

    return rocket;
  }

  public syncProjectiles(projectiles: RocketState[]): void {
    const currentIds = new Set(projectiles.map((p) => p.id));

    // Remove rockets that no longer exist on server
    for (const [id, mesh] of this.rocketMeshes.entries()) {
      if (!currentIds.has(id)) {
        this.group.remove(mesh);
        this.rocketMeshes.delete(id);
      }
    }

    // Add or update active rockets
    projectiles.forEach((p) => {
      let rocket = this.rocketMeshes.get(p.id);
      if (!rocket) {
        rocket = this.createRocketMesh();
        this.group.add(rocket);
        this.rocketMeshes.set(p.id, rocket);
      }

      rocket.position.set(p.position.x, p.position.y, p.position.z);
      rocket.rotation.y = p.rotation;
    });
  }

  public triggerExplosion(event: ExplosionEvent): void {
    const mesh = new THREE.Mesh(this.explosionGeo, this.explosionMat.clone());
    mesh.position.set(event.position.x, event.position.y, event.position.z);
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);

    this.activeExplosions.push({
      mesh,
      life: 0,
      maxLife: 0.45, // 450ms flash
      initialScale: 0.4,
      targetScale: event.radius || 3.5
    });
  }

  public update(dt: number): void {
    // Animate active explosions
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const exp = this.activeExplosions[i];
      exp.life += dt;

      const progress = exp.life / exp.maxLife;

      if (progress >= 1.0) {
        this.scene.remove(exp.mesh);
        (exp.mesh.material as THREE.Material).dispose();
        this.activeExplosions.splice(i, 1);
        continue;
      }

      // Expansion curve (fast out)
      const currentScale = exp.initialScale + (exp.targetScale - exp.initialScale) * Math.sin((progress * Math.PI) / 2);
      exp.mesh.scale.setScalar(currentScale);

      // Fade out
      const mat = exp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.85 * (1.0 - progress);
    }
  }

  public dispose(): void {
    this.rocketMeshes.forEach((mesh) => {
      this.group.remove(mesh);
    });
    this.rocketMeshes.clear();

    this.activeExplosions.forEach((exp) => {
      this.scene.remove(exp.mesh);
      (exp.mesh.material as THREE.Material).dispose();
    });
    this.activeExplosions = [];

    this.rocketBodyGeo.dispose();
    this.rocketTipGeo.dispose();
    this.rocketFinGeo.dispose();
    this.explosionGeo.dispose();
    this.rocketBodyMat.dispose();
    this.rocketTipMat.dispose();
    this.rocketThrusterMat.dispose();
    this.explosionMat.dispose();

    this.scene.remove(this.group);
  }
}
