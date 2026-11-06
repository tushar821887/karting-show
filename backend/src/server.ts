import http from 'http';
import express from 'express';
import cors from 'cors';
import { env } from './config/environment';
import { connectDatabase } from './config/database';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { SocketServer } from './sockets/socket.server';
import { createHealthRouter } from './routes/health.routes';

async function bootstrap(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  // Middleware
  app.use(cors({
    origin: [env.CLIENT_ORIGIN, 'http://localhost:4200', 'http://127.0.0.1:4200'],
    credentials: true
  }));
  app.use(express.json());
  app.use(requestLogger);

  // Initialize WebSockets
  const socketServer = new SocketServer(server);

  // API Routes
  app.use('/api', createHealthRouter(socketServer));

  // Root Welcome
  app.get('/', (_req, res) => {
    res.json({
      name: 'Kart Battle Arena API',
      status: 'active',
      healthCheck: '/api/health',
      info: '/api/info'
    });
  });

  // Error Handler
  app.use(errorHandler);

  // Connect Database (non-blocking)
  await connectDatabase();

  // Start Server
  server.listen(env.PORT, () => {
    console.log(`====================================================`);
    console.log(`  🏎️  Kart Battle Arena Server Started!`);
    console.log(`  🚀 Port: ${env.PORT}`);
    console.log(`  🌐 Environment: ${env.NODE_ENV}`);
    console.log(`  🩺 Health: http://localhost:${env.PORT}/api/health`);
    console.log(`====================================================`);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Graceful shutdown initiated...');
    server.close(() => {
      console.log('[Server] HTTP and Socket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Fatal] Server failed to start:', err);
  process.exit(1);
});
