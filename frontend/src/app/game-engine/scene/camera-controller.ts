import * as THREE from 'three';

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  // Configuration
  private readonly followDistance = 7.5;
  private readonly followHeight = 3.6;
  private readonly lookAheadDistance = 3.0;
  private readonly lookAheadHeight = 1.2;

  // Smoothing factors
  private readonly posLerpSpeed = 8.0;
  private readonly lookLerpSpeed = 10.0;

  // Dynamic FOV for speed sensation
  private baseFov: number = 60;
  private boostFov: number = 72;
  private currentFov: number = 60;

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, width / height, 0.1, 500);
    this.currentPosition.set(0, 15, 25);
    this.currentLookAt.set(0, 0, 0);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public update(
    kartPosition: THREE.Vector3,
    kartRotation: number,
    isBoosting: boolean,
    dt: number
  ): void {
    // Desired camera position behind the kart
    // Rotation is yaw in radians around Y
    const backwardX = -Math.sin(kartRotation);
    const backwardZ = -Math.cos(kartRotation);

    const targetPos = new THREE.Vector3(
      kartPosition.x + backwardX * this.followDistance,
      kartPosition.y + this.followHeight,
      kartPosition.z + backwardZ * this.followDistance
    );

    // Desired look-at point slightly ahead of the kart
    const forwardX = Math.sin(kartRotation);
    const forwardZ = Math.cos(kartRotation);

    const targetLookAt = new THREE.Vector3(
      kartPosition.x + forwardX * this.lookAheadDistance,
      kartPosition.y + this.lookAheadHeight,
      kartPosition.z + forwardZ * this.lookAheadDistance
    );

    // Smooth lerp
    const posAlpha = 1 - Math.exp(-this.posLerpSpeed * dt);
    const lookAlpha = 1 - Math.exp(-this.lookLerpSpeed * dt);

    this.currentPosition.lerp(targetPos, posAlpha);
    this.currentLookAt.lerp(targetLookAt, lookAlpha);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);

    // Smooth FOV interpolation on boost
    const targetFov = isBoosting ? this.boostFov : this.baseFov;
    this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-6.0 * dt));
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  public reset(kartPosition: THREE.Vector3, kartRotation: number): void {
    const backwardX = -Math.sin(kartRotation);
    const backwardZ = -Math.cos(kartRotation);

    this.currentPosition.set(
      kartPosition.x + backwardX * this.followDistance,
      kartPosition.y + this.followHeight,
      kartPosition.z + backwardZ * this.followDistance
    );

    this.currentLookAt.copy(kartPosition);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
}
