import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { RoomComponent } from './features/room/room.component';
import { GameComponent } from './features/game/game.component';
import { ResultsComponent } from './features/results/results.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'room', component: RoomComponent },
  { path: 'game', component: GameComponent },
  { path: 'results', component: ResultsComponent },
  { path: '**', redirectTo: '' }
];
