import mongoose from 'mongoose';
import { env } from './environment';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

let currentStatus: DatabaseStatus = 'disconnected';
let lastError: string | null = null;

export async function connectDatabase(): Promise<void> {
  try {
    currentStatus = 'connecting';
    mongoose.set('strictQuery', true);

    // Set connection timeout to 4s so offline local mongo doesn't hang server start
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000
    });

    currentStatus = 'connected';
    lastError = null;
    console.log(`[Database] Successfully connected to MongoDB at ${env.MONGODB_URI}`);
  } catch (err: unknown) {
    currentStatus = 'error';
    const message = err instanceof Error ? err.message : String(err);
    lastError = message;
    console.warn(`[Database] MongoDB connection warning: ${message}`);
    console.warn('[Database] Continuing in non-blocking mode; game sessions will function in-memory.');
  }

  mongoose.connection.on('disconnected', () => {
    currentStatus = 'disconnected';
    console.warn('[Database] MongoDB connection disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    currentStatus = 'connected';
    lastError = null;
    console.log('[Database] MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    currentStatus = 'error';
    lastError = err.message;
    console.error('[Database] MongoDB connection error:', err.message);
  });
}

export function getDatabaseStatus(): { status: DatabaseStatus; error: string | null; uri: string } {
  return {
    status: currentStatus,
    error: lastError,
    uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@') // Mask credentials if present
  };
}
