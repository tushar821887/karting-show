import { PlayerInputState } from '@kart-battle/shared';

export class InputManager {
  private keyState: Record<string, boolean> = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    drift: false,
    fire: false,
    boost: false
  };

  private sequenceNumber: number = 0;
  private isEnabled: boolean = true;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;

  // Listeners for weapon and boost triggers
  public onFireTrigger?: () => void;
  public onBoostTrigger?: () => void;

  constructor() {
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
  }

  public attach(): void {
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    this.reset();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  private isInputElement(target: EventTarget | null): boolean {
    if (!target) return false;
    const tag = (target as HTMLElement).tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (target as HTMLElement).isContentEditable;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isEnabled || this.isInputElement(e.target)) return;

    let handled = false;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyState['forward'] = true;
        handled = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyState['backward'] = true;
        handled = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyState['left'] = true;
        handled = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyState['right'] = true;
        handled = true;
        break;
      case 'Space':
        if (!this.keyState['fire']) {
          this.keyState['fire'] = true;
          this.onFireTrigger?.();
        }
        handled = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (!this.keyState['boost']) {
          this.keyState['boost'] = true;
          this.onBoostTrigger?.();
        }
        handled = true;
        break;
    }

    if (handled && e.code === 'Space') {
      e.preventDefault(); // Prevent page scroll on Space
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (this.isInputElement(e.target)) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyState['forward'] = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyState['backward'] = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyState['left'] = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyState['right'] = false;
        break;
      case 'Space':
        this.keyState['fire'] = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keyState['boost'] = false;
        break;
    }
  }

  public reset(): void {
    this.keyState['forward'] = false;
    this.keyState['backward'] = false;
    this.keyState['left'] = false;
    this.keyState['right'] = false;
    this.keyState['drift'] = false;
    this.keyState['fire'] = false;
    this.keyState['boost'] = false;
  }

  public getSnapshot(): PlayerInputState {
    this.sequenceNumber++;
    return {
      forward: this.keyState['forward'],
      backward: this.keyState['backward'],
      left: this.keyState['left'],
      right: this.keyState['right'],
      drift: this.keyState['drift'],
      fire: this.keyState['fire'],
      boost: this.keyState['boost'],
      sequenceNumber: this.sequenceNumber,
      timestamp: Date.now()
    };
  }
}
