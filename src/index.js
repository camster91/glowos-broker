import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import config from './config.js';
import { initDb } from './db/client.js';
import authRoutes from './auth/routes.js';
import relayRoutes from './relay/handler.js';

const app = Fastify({ logger: true });

// Plugins
await app.register(cors, { origin: [config.corsOrigin, 'http://localhost:3000', 'http://localhost:8080'] });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(websocket);

// Routes
await app.register(authRoutes);
await app.register(relayRoutes);

// Health check
app.get('/health', () => ({ status: 'ok', service: 'glowos-broker', version: '1.0.0' }));

// Root
app.get('/', () => ({ name: 'GlowOS Broker', version: '1.0.0' }));

// Graceful shutdown
async function shutdown(signal) {
  app.log.info(`${signal} received, shutting down...`);
  try {
    await app.close(); // closes HTTP server + all WebSocket connections
  } catch (err) {
    app.log.error('Error during close:', err);
  }
  try {
    const pool = (await import('./db/client.js')).default;
    await pool.end();
  } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start
try {
  await initDb();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`GlowOS Broker running on ${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
