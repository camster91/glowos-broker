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

// Start
try {
  await initDb();
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`GlowOS Broker running on ${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
