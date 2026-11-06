import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { StateService } from '../../core/services/state.service';
import { Subscription } from 'rxjs';
import { RoomState, RoomPlayer, GAME_CONSTANTS } from '@kart-battle/shared';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit, OnDestroy {
  public socket = inject(SocketService);
  public state = inject(StateService);
  private router = inject(Router);

  public room = this.state.currentRoom;
  public codeCopied = signal<boolean>(false);
  public linkCopied = signal<boolean>(false);
  public countdownValue = signal<number | null>(null);
  public availableColors = GAME_CONSTANTS.PLAYER_COLORS;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    // If not in a room, redirect to home
    if (!this.state.isInRoom()) {
      this.router.navigate(['/']);
      return;
    }

    this.subs.push(
      this.socket.roomState$.subscribe((room: RoomState) => {
        this.state.setRoom(room);
        if (room.status === 'COUNTDOWN' && room.countdownSeconds !== undefined) {
          this.countdownValue.set(room.countdownSeconds);
        } else if (room.status !== 'COUNTDOWN') {
          this.countdownValue.set(null);
        }

        if (room.status === 'PLAYING') {
          this.router.navigate(['/game']);
        }
      }),

      this.socket.countdown$.subscribe((data: { secondsRemaining: number }) => {
        this.countdownValue.set(data.secondsRemaining);
      }),

      this.socket.gameStarted$.subscribe(() => {
        this.router.navigate(['/game']);
      }),

      this.socket.roomKicked$.subscribe((data: { message: string }) => {
        this.state.setRoom(null);
        this.state.showToast(data.message, 'warn');
        this.router.navigate(['/']);
      }),

      this.socket.roomError$.subscribe((err) => {
        this.state.showToast(err.message, 'error');
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  public get totalSlots(): number[] {
    return Array.from({ length: GAME_CONSTANTS.MAX_PLAYERS_PER_ROOM }, (_, i) => i);
  }

  public getPlayerAtSlot(index: number): RoomPlayer | undefined {
    const players = this.room()?.players;
    return players && players[index] ? players[index] : undefined;
  }

  public isLocalPlayer(player: RoomPlayer): boolean {
    return player.id === this.socket.socketId();
  }

  public copyRoomCode(): void {
    const code = this.room()?.code;
    if (code) {
      navigator.clipboard.writeText(code);
      this.codeCopied.set(true);
      this.state.showToast(`Room code ${code} copied to clipboard!`, 'success');
      setTimeout(() => this.codeCopied.set(false), 2000);
    }
  }

  public copyInviteLink(): void {
    const code = this.room()?.code;
    if (code) {
      const inviteUrl = `${window.location.origin}/?code=${code}`;
      navigator.clipboard.writeText(inviteUrl);
      this.linkCopied.set(true);
      this.state.showToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => this.linkCopied.set(false), 2000);
    }
  }

  public toggleReady(): void {
    const currentReady = this.state.isReady();
    this.socket.setReady(!currentReady);
  }

  public onColorSelect(color: string): void {
    this.state.updateProfile({ color });
    this.socket.updateCustomization({ color });
  }

  public kickPlayer(targetPlayer: RoomPlayer): void {
    if (confirm(`Are you sure you want to kick ${targetPlayer.name} from the room?`)) {
      this.socket.kickPlayer(targetPlayer.id);
    }
  }

  public startGame(): void {
    this.socket.startGame();
  }

  public leaveRoom(): void {
    this.socket.leaveRoom();
    this.state.setRoom(null);
    this.router.navigate(['/']);
  }
}
