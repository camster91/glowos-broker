import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { query } from '../db/client.js';
import { signToken, verifyToken } from './jwt.js';
import { sendWelcome, sendPairingCode, sendPasswordReset, sendGoodbye } from '../email.js';

export default async function authRoutes(app) {
  // Sign up (10/min rate limit)
  app.post('/auth/signup', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { email, password, name } = req.body || {};
    if (!email || !password) return reply.status(400).send({ error: 'Email and password required' });
    if (!email.includes('@')) return reply.status(400).send({ error: 'Invalid email address' });
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

    // Send welcome + pairing code emails (non-blocking)
    const safeName = (user.name || '').replace(/[<>&"']/g, '');
    sendWelcome(user.email, safeName).catch(() => {});
    sendPairingCode(user.email, safeName, gatewayToken.slice(0, 8).toUpperCase()).catch(() => {});

    return { token: jwt, user: { id: user.id, email: user.email, name: user.name }, gatewayToken };
  });

  // Login (20/min rate limit)
  app.post('/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) return reply.status(400).send({ error: 'Email and password required' });
    if (!email.includes('@')) return reply.status(400).send({ error: 'Invalid email address' });

    const result = await query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
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

      const gw = await query('SELECT status, last_seen_at, auth_token FROM gateways WHERE user_id = $1 LIMIT 1', [payload.userId]);

      return {
        user: result.rows[0],
        gateway: gw.rows[0] ? { status: gw.rows[0].status, last_seen_at: gw.rows[0].last_seen_at } : null,
        gatewayToken: gw.rows[0]?.auth_token || null
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // Refresh token
  app.post('/auth/refresh', async (req, reply) => {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      const payload = await verifyToken(auth);

      // Only refresh if token expires within 3 days
      const now = Math.floor(Date.now() / 1000);
      const threeDays = 3 * 24 * 60 * 60;
      if (payload.exp && (payload.exp - now) > threeDays) {
        return reply.status(400).send({ error: 'Token still has more than 3 days remaining' });
      }

      // Verify user still exists
      const result = await query('SELECT id, email FROM users WHERE id = $1', [payload.userId]);
      if (!result.rows.length) return reply.status(401).send({ error: 'User not found' });

      const user = result.rows[0];
      const jwt = await signToken({ userId: user.id, email: user.email });
      return { token: jwt };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // Forgot password
  app.post('/auth/forgot-password', async (req, reply) => {
    const { email } = req.body || {};
    if (!email) return reply.status(400).send({ error: 'Email required' });

    // Always return success to prevent email enumeration
    const result = await query('SELECT id, name FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return { message: 'If that email exists, a reset link has been sent.' };

    const user = result.rows[0];
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetUrl = `https://getglowos.com/?reset=${token}`;
    const safeName = (user.name || '').replace(/[<>&"']/g, '');
    sendPasswordReset(email.toLowerCase(), safeName, resetUrl).catch(() => {});

    return { message: 'If that email exists, a reset link has been sent.' };
  });

  // Reset password
  app.post('/auth/reset-password', async (req, reply) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return reply.status(400).send({ error: 'Token and new password required' });
    if (newPassword.length < 6) return reply.status(400).send({ error: 'Password must be 6+ characters' });

    const result = await query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    if (!result.rows.length) return reply.status(400).send({ error: 'Invalid or expired reset token' });

    const resetToken = result.rows[0];
    const hash = await bcrypt.hash(newPassword, 10);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, resetToken.user_id]);
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetToken.id]);

    return { message: 'Password has been reset. You can now log in.' };
  });

  // Delete account
  app.delete('/auth/account', async (req, reply) => {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      const payload = await verifyToken(auth);
      const result = await query('SELECT id, email, name FROM users WHERE id = $1', [payload.userId]);
      if (!result.rows.length) return reply.status(401).send({ error: 'User not found' });

      const user = result.rows[0];

      // Delete reset tokens, gateways cascade from ON DELETE CASCADE, but be explicit
      await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      await query('DELETE FROM gateways WHERE user_id = $1', [user.id]);
      await query('DELETE FROM users WHERE id = $1', [user.id]);

      // Send goodbye email (non-blocking)
      const safeName = (user.name || '').replace(/[<>&"']/g, '');
      sendGoodbye(user.email, safeName).catch(() => {});

      return { message: 'Account deleted' };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
}
