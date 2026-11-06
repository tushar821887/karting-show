import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import * as THREE from 'three';
import { StateService } from '../../core/services/state.service';
import { SocketService } from '../../core/services/socket.service';
import { KartModel } from '../../game-engine/kart/kart-model';
import { GameFinishedPayload, LeaderboardEntry } from '@kart-battle/shared';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('kartCanvas', { static: false }) private kartCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('confettiCanvas', { static: false }) private confettiCanvasRef?: ElementRef<HTMLCanvasElement>;

  public state = inject(StateService);
  public socket = inject(SocketService);
  private router = inject(Router);

  // Match Result Data
  public matchResult = signal<GameFinishedPayload | null>(null);

  // Three.js Turntable
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private kartModel?: KartModel;
  private animFrameId?: number;

  // 2D Confetti System
  private confettiAnimId?: number;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotSpeed: number;
  }> = [];

  // Computed properties
  public isDraw = computed(() => this.matchResult()?.reason === 'DRAW');
  public isLocalWinner = computed(() => {
    const res = this.matchResult();
    const myId = this.socket.socketId();
    return res && res.winnerId && myId && res.winnerId === myId;
  });

  public formattedDuration = computed(() => {
    const secs = this.matchResult()?.durationSeconds || 0;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  });

  ngOnInit(): void {
    const existing = this.state.lastMatchResult();
    if (existing) {
      this.matchResult.set(existing);
    } else {
      // Fallback mock sample if page was refreshed directly
      this.matchResult.set({
        matchId: 'match_arena_final',
        winnerId: 'winner_1',
        winnerName: 'Kart Champion',
        winnerColor: '#EF4444',
        reason: 'LAST_STANDING',
        durationSeconds: 98,
        leaderboard: [
          {
            rank: 1,
            playerId: 'winner_1',
            playerName: 'Kart Champion',
            color: '#EF4444',
            eliminations: 3,
            health: 75,
            isAlive: true,
            score: 350
          },
          {
            rank: 2,
            playerId: 'racer_2',
            playerName: 'SpeedDemon',
            color: '#3B82F6',
            eliminations: 1,
            health: 0,
            isAlive: false,
            score: 100
          }
        ]
      });
    }
  }

  ngAfterViewInit(): void {
    this.init3DKartShowcase();
    this.initConfetti();
  }

  private init3DKartShowcase(): void {
    if (!this.kartCanvasRef) return;
    const canvas = this.kartCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 320;
    const height = rect.height || 260;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 2.2, 5.2);
    this.camera.lookAt(0, 0.6, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight.position.set(5, 8, 5);
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xff007f, 2.0);
    rimLight.position.set(-5, 4, -5);
    this.scene.add(rimLight);

    // Glowing Circular Podium
    const podiumGeo = new THREE.CylinderGeometry(2.0, 2.2, 0.25, 32);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x12172b,
      metalness: 0.8,
      roughness: 0.2
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.y = -0.125;
    this.scene.add(podium);

    const ringGeo = new THREE.RingGeometry(1.85, 2.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);

    // Kart Model
    const winnerColor = this.matchResult()?.winnerColor || '#EF4444';
    this.kartModel = new KartModel({
      color: winnerColor,
      name: this.matchResult()?.winnerName || 'CHAMPION',
      isHost: false
    });
    this.kartModel.mesh.position.set(0, 0, 0);
    this.scene.add(this.kartModel.mesh);

    // Turntable Animation Loop
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      if (this.kartModel) {
        this.kartModel.mesh.rotation.y += 0.012;
      }
      this.renderer?.render(this.scene!, this.camera!);
    };
    animate();
  }

  private initConfetti(): void {
    if (!this.confettiCanvasRef) return;
    const canvas = this.confettiCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#00f0ff', '#ff007f', '#ffb800', '#00ff88', '#ffffff', '#8b5cf6'];
    const count = 120;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1
      });
    }

    const renderConfetti = () => {
      this.confettiAnimId = requestAnimationFrame(renderConfetti);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    };
    renderConfetti();
  }

  public playAgain(): void {
    const room = this.state.currentRoom();
    if (room) {
      // Return to existing room lobby
      this.router.navigate(['/room', room.code]);
      this.state.showToast('Returned to room lobby. Ready up for the next match!', 'info');
    } else {
      // Return to home to create or join a new match
      this.router.navigate(['/']);
    }
  }

  public returnToHome(): void {
    this.socket.leaveRoom();
    this.state.setRoom(null);
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
    }
    if (this.kartModel) {
      this.kartModel.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
