import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="app-footer">
      <div class="footer-container">
        <p class="copyright">
          © 2026 <strong>Kart Battle Arena</strong> • Desktop Multiplayer 3D Action
        </p>
        <div class="tech-tags">
          <span class="tech-tag">Angular 21/22</span>
          <span class="tech-tag">Three.js</span>
          <span class="tech-tag">Rapier.js</span>
          <span class="tech-tag">Socket.IO</span>
          <span class="tech-tag">Node.js</span>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding: 1.5rem 0;
      background: rgba(10, 12, 22, 0.95);
      margin-top: auto;
    }

    .footer-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .copyright {
      color: var(--text-muted);
      font-size: 0.85rem;

      strong {
        color: var(--text-main);
      }
    }

    .tech-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tech-tag {
      font-family: var(--font-display);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid rgba(0, 240, 255, 0.2);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
  `]
})
export class FooterComponent {}
