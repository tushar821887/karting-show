import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export class ParticleSystem {
  public readonly points: THREE.Points;
  private readonly maxParticles = 300;
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  public emitFlame(origin: THREE.Vector3, kartRotation: number, isBoosting: boolean): void {
    if (this.particles.length >= this.maxParticles) return;

    const backwardX = -Math.sin(kartRotation);
    const backwardZ = -Math.cos(kartRotation);

    const speed = isBoosting ? 12 + Math.random() * 6 : 4 + Math.random() * 2;
    const spread = 0.4;

    const velocity = new THREE.Vector3(
      backwardX * speed + (Math.random() - 0.5) * spread,
      0.5 + Math.random() * 0.5,
      backwardZ * speed + (Math.random() - 0.5) * spread
    );

    const color = isBoosting
      ? new THREE.Color(Math.random() > 0.5 ? 0x00f0ff : 0x0088ff)
      : new THREE.Color(Math.random() > 0.4 ? 0xff5500 : 0xffaa00);

    this.particles.push({
      position: origin.clone(),
      velocity,
      life: 0,
      maxLife: isBoosting ? 0.35 : 0.2,
      size: isBoosting ? 0.9 : 0.4,
      color
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.position.addScaledVector(p.velocity, dt);
    }

    // Update GPU buffers
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        const alpha = 1 - p.life / p.maxLife;

        this.positions[i * 3] = p.position.x;
        this.positions[i * 3 + 1] = p.position.y;
        this.positions[i * 3 + 2] = p.position.z;

        this.colors[i * 3] = p.color.r * alpha;
        this.colors[i * 3 + 1] = p.color.g * alpha;
        this.colors[i * 3 + 2] = p.color.b * alpha;

        this.sizes[i] = p.size * alpha;
      } else {
        this.positions[i * 3 + 1] = -9999;
        this.sizes[i] = 0;
      }
    }

    this.geometry.attributes['position'].needsUpdate = true;
    this.geometry.attributes['color'].needsUpdate = true;
    this.geometry.attributes['size'].needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    if (this.points.material instanceof THREE.Material) {
      this.points.material.dispose();
    }
  }
}
