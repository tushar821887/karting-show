import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" *ngIf="state.toasts().length > 0">
      <div
        *ngFor="let toast of state.toasts()"
        class="toast-item glass-panel"
        [class]="toast.type"
        (click)="state.dismissToast(toast.id)"
      >
        <span class="toast-icon">
          {{ toast.type === 'error' ? '❌' : toast.type === 'success' ? '✅' : toast.type === 'warn' ? '⚠️' : 'ℹ️' }}
        </span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 85px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      z-index: 9999;
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.25s ease-out;

      &.success {
        border-color: rgba(0, 255, 136, 0.4);
        background: rgba(6, 30, 20, 0.95);
        color: #00ff88;
      }
      &.error {
        border-color: rgba(255, 51, 68, 0.4);
        background: rgba(30, 8, 12, 0.95);
        color: #ff3344;
      }
      &.warn {
        border-color: rgba(255, 184, 0, 0.4);
        background: rgba(30, 24, 8, 0.95);
        color: #ffb800;
      }
      &.info {
        border-color: rgba(0, 240, 255, 0.4);
        background: rgba(8, 20, 32, 0.95);
        color: #00f0ff;
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `]
})
export class ToastComponent {
  public state = inject(StateService);
}
