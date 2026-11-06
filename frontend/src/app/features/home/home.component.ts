import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, HealthResponse } from '../../core/services/api.service';
import { SocketService } from '../../core/services/socket.service';
import { StateService } from '../../core/services/state.service';
import { GAME_CONSTANTS, RoomErrorPayload, RoomState } from '@kart-battle/shared';
import * as THREE from 'three';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('previewCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private api = inject(ApiService);
  public socket = inject(SocketService);
  public state = inject(StateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Home state
  public healthData = signal<HealthResponse | null>(null);
  public healthError = signal<string | null>(null);
  public isCheckingHealth = signal<boolean>(false);

  // Player customizer
  public playerName: string = '';
  public selectedColor: string = '';
  public availableColors = GAME_CONSTANTS.PLAYER_COLORS;

  // Modals / forms
  public showCreateModal = signal<boolean>(false);
  public showJoinModal = signal<boolean>(false);
  public joinCode: string = '';
  public modalError = signal<string | null>(null);
  public isSubmitting = signal<boolean>(false);

  // Three.js animated kart preview
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private kartGroup: THREE.Group | null = null;
  private animFrameId: number | null = null;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    const profile = this.state.profile();
    this.playerName = profile.name;
    this.selectedColor = profile.color;

    this.checkHealth();
    this.socket.connect();

    // Check for room code in query params
    this.subs.push(
      this.route.queryParams.subscribe((params) => {
        if (params['code']) {
          this.joinCode = params['code'].toUpperCase().trim();
          this.showJoinModal.set(true);
        }
      })
    );

    // Socket subscriptions
    this.subs.push(
      this.socket.roomCreated$.subscribe((room: RoomState) => {
        this.isSubmitting.set(false);
        this.state.setRoom(room);
        this.showCreateModal.set(false);
        this.state.showToast(`Room ${room.code} created! You are the host.`, 'success');
        this.router.navigate(['/room']);
      }),

      this.socket.roomJoined$.subscribe((room: RoomState) => {
        this.isSubmitting.set(false);
        this.state.setRoom(room);
        this.showJoinModal.set(false);
        this.state.showToast(`Joined room ${room.code}!`, 'success');
        this.router.navigate(['/room']);
      }),

      this.socket.roomError$.subscribe((error: RoomErrorPayload) => {
        this.isSubmitting.set(false);
        this.modalError.set(error.message);
        this.state.showToast(error.message, 'error');
      })
    );
  }

  ngAfterViewInit(): void {
    this.init3DKartPreview();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  public checkHealth(): void {
    this.isCheckingHealth.set(true);
    this.healthError.set(null);

    this.api.getHealth().subscribe({
      next: (data) => {
        this.healthData.set(data);
        this.isCheckingHealth.set(false);
      },
      error: (err) => {
        this.healthError.set(err.message || 'Cannot reach backend server');
        this.isCheckingHealth.set(false);
      }
    });
  }

  public onColorSelect(color: string): void {
    this.selectedColor = color;
    this.updateProfile();
    this.updatePreviewKartColor();
  }

  public onNameChange(): void {
    this.updateProfile();
  }

  private updateProfile(): void {
    if (!this.playerName.trim()) return;
    this.state.updateProfile({
      name: this.playerName.trim(),
      color: this.selectedColor
    });
  }

  public openCreateModal(): void {
    this.modalError.set(null);
    this.showCreateModal.set(true);
  }

  public openJoinModal(): void {
    this.modalError.set(null);
    this.showJoinModal.set(true);
  }

  public submitCreateRoom(): void {
    this.updateProfile();
    const name = this.playerName.trim();
    if (!name) {
      this.modalError.set('Please enter a racer name (2-16 characters)');
      return;
    }

    this.isSubmitting.set(true);
    this.modalError.set(null);

    this.socket.createRoom({
      playerName: name,
      color: this.selectedColor,
      kartIndex: 0
    });
  }

  public submitJoinRoom(): void {
    this.updateProfile();
    const name = this.playerName.trim();
    if (!name) {
      this.modalError.set('Please enter a racer name (2-16 characters)');
      return;
    }

    const code = this.joinCode.trim().toUpperCase();
    if (!code || code.length !== GAME_CONSTANTS.ROOM_CODE_LENGTH) {
      this.modalError.set(`Room code must be exactly ${GAME_CONSTANTS.ROOM_CODE_LENGTH} characters`);
      return;
    }

    this.isSubmitting.set(true);
    this.modalError.set(null);

    this.socket.joinRoom({
      roomCode: code,
      playerName: name,
      color: this.selectedColor,
      kartIndex: 0
    });
  }

  // 3D Preview
  private init3DKartPreview(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 240;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 2.5, 5);
    this.camera.lookAt(0, 0.4, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
    dirLight.position.set(4, 8, 4);
    this.scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xff007f, 1.2);
    backLight.position.set(-4, 3, -4);
    this.scene.add(backLight);

    // Kart model placeholder group
    this.kartGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.4, 2.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.selectedColor),
      roughness: 0.3,
      metalness: 0.6
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.name = 'kart_body';
    this.kartGroup.add(body);

    // Cabin / Hood
    const hoodGeo = new THREE.BoxGeometry(1.0, 0.4, 1.0);
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x11162b, roughness: 0.2, metalness: 0.9 });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, 0.8, -0.2);
    this.kartGroup.add(hood);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const wheelPositions = [
      [-0.9, 0.35, 0.8],
      [0.9, 0.35, 0.8],
      [-0.9, 0.35, -0.8],
      [0.9, 0.35, -0.8]
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      this.kartGroup?.add(wheel);
    });

    // Exhaust pipes with glow
    const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ex1 = new THREE.Mesh(exhaustGeo, exhaustMat);
    ex1.rotation.x = Math.PI / 2;
    ex1.position.set(-0.4, 0.4, 1.3);
    const ex2 = ex1.clone();
    ex2.position.x = 0.4;
    this.kartGroup.add(ex1);
    this.kartGroup.add(ex2);

    this.scene.add(this.kartGroup);

    // Animation Loop
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      if (this.kartGroup) {
        this.kartGroup.rotation.y += 0.015;
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  private updatePreviewKartColor(): void {
    if (!this.kartGroup) return;
    const bodyMesh = this.kartGroup.getObjectByName('kart_body') as THREE.Mesh;
    if (bodyMesh && bodyMesh.material) {
      (bodyMesh.material as THREE.MeshStandardMaterial).color.set(this.selectedColor);
    }
  }
}
