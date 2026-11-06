import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/environment';
import { registerRoomHandlers } from './room.handler';
import { registerGameHandlers } from './game.handler';

export class SocketServer {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: [env.CLIENT_ORIGIN, 'http://localhost:4200', 'http://127.0.0.1:4200'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingInterval: 10000,
      pingTimeout: 5000
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[SocketServer] Client connected: ${socket.id} (Transport: ${socket.conn.transport.name})`);

      registerRoomHandlers(this.io, socket);
      registerGameHandlers(this.io, socket);

      socket.on('disconnect', (reason) => {
        console.log(`[SocketServer] Client disconnected: ${socket.id} (${reason})`);
      });
    });
  }

  public getIO(): Server {
    return this.io;
  }

  public getConnectedClientCount(): number {
    return this.io.engine.clientsCount;
  }
}
