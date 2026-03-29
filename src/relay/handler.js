import { query } from '../db/client.js';
import { verifyToken } from '../auth/jwt.js';

// In-memory maps for live WebSocket connections
const gatewayConnections = new Map();  // userId -> ws
const clientConnections = new Map();   // userId -> Set<ws>

export function getGatewayStatus(userId) {
  return gatewayConnections.has(userId) ? 'online' : 'offline';
}

export default async function relayRoutes(app) {

  // Gateway connects here (outbound from user's machine)
  app.get('/gateway/connect', { websocket: true }, async (socket, req) => {
    const token = req.headers['x-gateway-token'] ||
                  new URL(req.url, 'http://localhost').searchParams.get('token');

    if (!token) {
      socket.send(JSON.stringify({ error: 'Missing gateway token' }));
      socket.close(4001, 'Missing token');
      return;
    }

    // Look up gateway by token
    const result = await query(
      'SELECT g.id, g.user_id FROM gateways g WHERE g.auth_token = $1',
      [token]
    );
    if (!result.rows.length) {
      socket.send(JSON.stringify({ error: 'Invalid gateway token' }));
      socket.close(4003, 'Invalid token');
      return;
    }

    const { user_id: userId } = result.rows[0];

    // Store connection
    gatewayConnections.set(userId, socket);
    await query('UPDATE gateways SET status = $1, last_seen_at = NOW() WHERE user_id = $2', ['online', userId]);

    app.log.info(`Gateway connected for user ${userId}`);

    // Forward messages from gateway to all connected PWA clients
    socket.on('message', (msg) => {
      const clients = clientConnections.get(userId);
      if (clients) {
        const data = msg.toString();
        for (const client of clients) {
          if (client.readyState === 1) client.send(data);
        }
      }
    });

    socket.on('close', async () => {
      gatewayConnections.delete(userId);
      await query('UPDATE gateways SET status = $1 WHERE user_id = $2', ['offline', userId]).catch(() => {});
      app.log.info(`Gateway disconnected for user ${userId}`);
    });

    socket.on('error', () => {
      gatewayConnections.delete(userId);
    });

    // Send a hello so the gateway knows it's connected
    socket.send(JSON.stringify({ type: 'broker.hello', version: '1.0.0' }));
  });

  // PWA client connects here
  app.get('/relay', { websocket: true }, async (socket, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const token = params.get('token') || req.headers['sec-websocket-protocol'];

    if (!token) {
      socket.send(JSON.stringify({ error: 'Missing auth token' }));
      socket.close(4001, 'Missing token');
      return;
    }

    let userId;
    try {
      const payload = await verifyToken(token);
      userId = payload.userId;
    } catch {
      socket.send(JSON.stringify({ error: 'Invalid auth token' }));
      socket.close(4003, 'Invalid token');
      return;
    }

    // Add to client set
    if (!clientConnections.has(userId)) clientConnections.set(userId, new Set());
    clientConnections.get(userId).add(socket);

    app.log.info(`PWA client connected for user ${userId}`);

    // Check if gateway is online
    const gw = gatewayConnections.get(userId);
    if (!gw || gw.readyState !== 1) {
      socket.send(JSON.stringify({ type: 'broker.status', gateway: 'offline' }));
    } else {
      socket.send(JSON.stringify({ type: 'broker.status', gateway: 'online' }));
    }

    // Forward messages from PWA client to gateway
    socket.on('message', (msg) => {
      const gw = gatewayConnections.get(userId);
      if (gw && gw.readyState === 1) {
        gw.send(msg.toString());
      } else {
        socket.send(JSON.stringify({ type: 'broker.status', gateway: 'offline' }));
      }
    });

    socket.on('close', () => {
      const clients = clientConnections.get(userId);
      if (clients) {
        clients.delete(socket);
        if (clients.size === 0) clientConnections.delete(userId);
      }
    });

    socket.on('error', () => {
      const clients = clientConnections.get(userId);
      if (clients) clients.delete(socket);
    });
  });

  // REST endpoint: gateway status
  app.get('/gateway/status', async (req, reply) => {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      const payload = await verifyToken(auth);
      const status = getGatewayStatus(payload.userId);
      const gw = await query('SELECT status, last_seen_at, version FROM gateways WHERE user_id = $1 LIMIT 1', [payload.userId]);
      return { online: status === 'online', ...(gw.rows[0] || {}) };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
}
