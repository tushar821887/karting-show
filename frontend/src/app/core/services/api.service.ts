import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: string;
    error: string | null;
    uri: string;
  };
  multiplayer: {
    activeRooms: number;
    activePlayersInRooms: number;
    connectedSockets: number;
    activeMatches: number;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export interface InfoResponse {
  gameName: string;
  version: string;
  description: string;
  constants: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }

  getInfo(): Observable<InfoResponse> {
    return this.http.get<InfoResponse>(`${this.baseUrl}/info`);
  }
}
