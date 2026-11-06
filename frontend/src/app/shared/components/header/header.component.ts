import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SocketService } from '../../../core/services/socket.service';
import { StateService } from '../../../core/services/state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="app-header">
      <div class="header-container">
        <a routerLink="/" class="logo">
          <span class="logo-icon">⚡</span>
          <div class="logo-text">
            <span class="logo-title">KART BATTLE</span>
            <span class="logo-tag">ARENA 3D</span>
          </div>
        </a>

        <div class="header-right">
          <!-- Server Connection Status -->
          <div class="status-badge" [class.connected]="socket.isConnected()">
            <span class="status-dot"></span>
            <span class="status-text">{{ socket.isConnected() ? 'ONLINE' : 'OFFLINE' }}</span>
            <span *ngIf="socket.isConnected()" class="latency-text">{{ socket.latencyMs() }}ms</span>
          </div>

          <!-- Player Chip -->
          <div class="player-chip">
            <div class="player-color-dot" [style.backgroundColor]="state.profile().color"></div>
            <span class="player-name">{{ state.profile().name }}</span>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      width: 100%;
      height: 70px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(10, 12, 22, 0.8);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .header-container {
      max-width: 1280px;
      height: 100%;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: inherit;
    }

    .logo-icon {
      font-size: 1.8rem;
      filter: drop-shadow(0 0 8px #00f0ff);
    }

    .logo-text {
      display: flex;
      flex-direction: column;
    }

    .logo-title {
      font-family: var(--font-display);
      font-weight: 900;
      font-size: 1.25rem;
      letter-spacing: 0.1em;
      background: linear-gradient(90deg, #00f0ff, #ff007f);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-tag {
      font-family: var(--font-display);
      font-size: 0.65rem;
      letter-spacing: 0.25em;
      color: var(--accent-yellow);
      font-weight: 700;
      margin-top: -3px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: var(--font-display);
      letter-spacing: 0.05em;
      background: rgba(255, 51, 68, 0.15);
      border: 1px solid rgba(255, 51, 68, 0.3);
      color: var(--accent-red);

      &.connected {
        background: rgba(0, 255, 136, 0.12);
        border-color: rgba(0, 255, 136, 0.3);
        color: var(--accent-green);
      }
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    .latency-text {
      color: var(--text-muted);
      font-size: 0.7rem;
      margin-left: 0.2rem;
    }

    .player-chip {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .player-color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      box-shadow: 0 0 6px currentColor;
    }

    .player-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-main);
    }
  `]
})
export class HeaderComponent {
  public socket = inject(SocketService);
  public state = inject(StateService);
}
