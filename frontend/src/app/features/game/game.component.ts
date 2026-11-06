import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameEngine } from '../../game-engine/core/game-engine';
import { StateService } from '../../core/services/state.service';
import { SocketService } from '../../core/services/socket.service';
import {
  ClientToServerEvents,
  GameSnapshot,
  GameFinishedPayload,
  PlayerEliminatedPayload,
  LeaderboardEntry
} from '@kart-battle/shared';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ngZone = inject(NgZone);
  public state = inject(StateService);
  public socket = inject(SocketService);
  private router = inject(Router);

  private engine: GameEngine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private subs: Subscription[] = [];
  private prevHealth: number = 100;

  // HUD Reactive Signals
  public currentSpeed = signal<number>(0);
  public currentHealth = signal<number>(100);
  public isEliminated = signal<boolean>(false);
  public isBoosting = signal<boolean>(false);
  public boostAvailable = signal<boolean>(true);
  public boostCooldownPct = signal<number>(100);
  public rocketCooldownPct = signal<number>(100);
  public rocketAvailable = signal<boolean>(true);
  public eliminationCount = signal<number>(0);
  public remainingAliveCount = signal<number>(1);
  public tookDamageFlash = signal<boolean>(false);
  public showControlsHelp = signal<boolean>(false);
  public showLeaderboardOverlay = signal<boolean>(false);
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  ngOnInit(): void {
    if (!this.state.isInRoom()) {
      console.log('[GameComponent] Initialized in practice mode');
    }

    // Subscribe to multiplayer snapshots
    this.subs.push(
      this.socket.gameSnapshot$.subscribe((snapshot: GameSnapshot) => {
        if (this.engine) {
          this.engine.applySnapshot(snapshot);
        }

        const myId = this.socket.socketId() || 'local_player';
        const serverSelf = snapshot.players.find((p) => p.id === myId);

        if (serverSelf) {
          // Check for damage taken
          if (serverSelf.health < this.prevHealth) {
            this.triggerDamageFlash();
          }
          this.prevHealth = serverSelf.health;

          this.currentHealth.set(serverSelf.health);
          this.isEliminated.set(serverSelf.isEliminated);
          this.eliminationCount.set(serverSelf.kills);

          // Rocket cooldown calculation
          const remMs = serverSelf.rocketCooldownRemainingMs || 0;
          this.rocketAvailable.set(remMs <= 0 && !serverSelf.isEliminated);
          const rPct = remMs <= 0 ? 100 : Math.round(((2000 - remMs) / 2000) * 100);
          this.rocketCooldownPct.set(rPct);
        }

        // Count alive players
        const aliveCount = snapshot.players.filter((p) => !p.isEliminated).length;
        this.remainingAliveCount.set(aliveCount);

        // Update live leaderboard state
        if (snapshot.players.length > 0) {
          const dynamicLeaderboard: LeaderboardEntry[] = [...snapshot.players]
            .sort((a, b) => {
              if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
              if (a.kills !== b.kills) return b.kills - a.kills;
              return b.health - a.health;
            })
            .map((p, idx) => ({
              rank: idx + 1,
              playerId: p.id,
              playerName: p.name,
              color: p.color,
              eliminations: p.kills,
              health: p.health,
              isAlive: !p.isEliminated,
              score: p.score
            }));
          this.state.setLiveLeaderboard(dynamicLeaderboard);
        }
      }),

      this.socket.leaderboard$.subscribe((leaderboard: LeaderboardEntry[]) => {
        this.state.setLiveLeaderboard(leaderboard);
      }),

      this.socket.playerEliminated$.subscribe((data: PlayerEliminatedPayload) => {
        const myId = this.socket.socketId();

        if (data.eliminatedPlayerId === myId) {
          this.isEliminated.set(true);
          this.state.showToast('You were eliminated! Spectating remaining racers.', 'error');
        } else if (data.attackerId === myId) {
          this.state.showToast(`🎯 ROCKET ELIMINATION! You eliminated ${data.eliminatedPlayerName}!`, 'success');
        } else {
          this.state.showToast(
            data.attackerName
              ? `💥 ${data.eliminatedPlayerName} was eliminated by ${data.attackerName}!`
              : `💥 ${data.eliminatedPlayerName} was eliminated!`,
            'warn'
          );
        }
      }),

      this.socket.gameFinished$.subscribe((payload: GameFinishedPayload) => {
        this.state.setLastMatchResult(payload);
        this.state.setLiveLeaderboard(payload.leaderboard);
        this.state.showToast(
          payload.winnerName ? `🏆 Match Over! Champion: ${payload.winnerName}` : 'Match ended in a Draw!',
          'info'
        );
        this.router.navigate(['/results']);
      })
    );

    // Global Tab key to toggle live leaderboard
    this.keyListener = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.showLeaderboardOverlay.update((v) => !v);
      }
    };
    window.addEventListener('keydown', this.keyListener);
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const profile = this.state.profile();
    const currentRoom = this.state.currentRoom();

    // Run game engine OUTSIDE Angular zone for 60 FPS performance
    this.ngZone.runOutsideAngular(async () => {
      this.engine = await GameEngine.create({
        canvas,
        localPlayer: {
          id: this.socket.socketId() || 'local_player',
          name: profile.name,
          color: profile.color,
          isHost: this.state.isHost()
        },
        remotePlayers: currentRoom?.players,
        onHudUpdate: (hud) => {
          this.currentSpeed.set(hud.speed);
          this.isBoosting.set(hud.isBoosting);
          this.boostAvailable.set(hud.boostAvailable && !this.isEliminated());

          const cooldownPct = hud.boostAvailable
            ? 100
            : Math.round(((8000 - hud.boostCooldownRemainingMs) / 8000) * 100);
          this.boostCooldownPct.set(cooldownPct);
        },
        onFireWeapon: () => {
          if (!this.isEliminated() && this.rocketAvailable()) {
            this.socket.emit(ClientToServerEvents.WEAPON_FIRE);
          }
        },
        onSendInput: (input) => {
          if (!this.isEliminated()) {
            this.socket.emit(ClientToServerEvents.PLAYER_INPUT, input);
          }
        }
      });

      this.engine.start();
    });

    // Handle responsive resizing
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.engine?.resize(width, height);
        }
      }
    });

    this.resizeObserver.observe(canvas.parentElement || document.body);
  }

  private triggerDamageFlash(): void {
    this.tookDamageFlash.set(true);
    setTimeout(() => {
      this.tookDamageFlash.set(false);
    }, 280);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());

    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
  }

  public fireRocket(): void {
    if (!this.isEliminated() && this.rocketAvailable()) {
      this.socket.emit(ClientToServerEvents.WEAPON_FIRE);
    }
  }

  public triggerBoost(): void {
    if (!this.isEliminated() && this.boostAvailable()) {
      this.engine?.localKart.activateBoost();
      this.socket.emit(ClientToServerEvents.PLAYER_BOOST);
    }
  }

  public toggleControlsHelp(): void {
    this.showControlsHelp.update((v) => !v);
  }

  public toggleLeaderboard(): void {
    this.showLeaderboardOverlay.update((v) => !v);
  }

  public leaveMatch(): void {
    if (confirm('Are you sure you want to exit the match?')) {
      this.socket.leaveRoom();
      this.state.setRoom(null);
      this.router.navigate(['/']);
    }
  }
}
