import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { query } from '../db/client.js';
import { signToken, verifyToken } from './jwt.js';

export default async function authRoutes(app) {
  // Sign up
  app.post('/auth/signup', async (req, reply) => {
    const { email, password, name } = req.body || {};
    if (!email || !password) return reply.status(400).send({ error: 'Email and password required' });
    if (password.length < 6) return reply.status(400).send({ error: 'Password must be 6+ characters' });

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return reply.status(409).send({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email.toLowerCase(), name || email.split('@')[0], hash]
    );
    const user = result.rows[0];

    // Auto-create a gateway for the user
    const gatewayToken = nanoid(48);
    await query(
      'INSERT INTO gateways (user_id, auth_token) VALUES ($1, $2)',
      [user.id, gatewayToken]
    );

    const jwt = await signToken({ userId: user.id, email: user.email });
    return { token: jwt, user: { id: user.id, email: user.email, name: user.name }, gatewayToken };
  });

  // Login
  app.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) return reply.status(400).send({ error: 'Email and password required' });

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return reply.status(401).send({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    // Get gateway token
    const gw = await query('SELECT auth_token FROM gateways WHERE user_id = $1 LIMIT 1', [user.id]);

    const jwt = await signToken({ userId: user.id, email: user.email });
    return {
      token: jwt,
      user: { id: user.id, email: user.email, name: user.name },
      gatewayToken: gw.rows[0]?.auth_token || null
    };
  });

  // Get current user
  app.get('/auth/me', async (req, reply) => {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      const payload = await verifyToken(auth);
      const result = await query('SELECT id, email, name FROM users WHERE id = $1', [payload.userId]);
      if (!result.rows.length) return reply.status(401).send({ error: 'User not found' });

      const gw = await query('SELECT auth_token, status, last_seen_at FROM gateways WHERE user_id = $1 LIMIT 1', [payload.userId]);

      return {
        user: result.rows[0],
        gateway: gw.rows[0] || null
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
}
