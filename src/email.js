import config from './config.js';

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@getglowos.com';

export async function sendEmail({ to, subject, html, text }) {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.log(`[email] Mailgun not configured, skipping: ${subject} → ${to}`);
    return false;
  }

  const form = new URLSearchParams();
  form.append('from', `GlowOS <${FROM_EMAIL}>`);
  form.append('to', to);
  form.append('subject', subject);
  if (html) form.append('html', html);
  if (text) form.append('text', text);

  const resp = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')
    },
    body: form
  });

  if (!resp.ok) {
    console.error(`[email] Mailgun error ${resp.status}: ${await resp.text()}`);
    return false;
  }
  return true;
}

export async function sendWelcome(email, name) {
  return sendEmail({
    to: email,
    subject: '✨ Welcome to GlowOS',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0f0f5;padding:40px;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#6c5ce7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px;margin-bottom:8px;">GlowOS</h1>
        <p style="color:rgba(255,255,255,0.6);margin-bottom:24px;">Your AI, your hardware, anywhere.</p>
        <h2 style="color:#f0f0f5;font-size:20px;">Hey ${escapeHtml(name)} 👋</h2>
        <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Welcome to GlowOS! You're now part of a new kind of AI platform — one that runs on <strong>your</strong> hardware, stays private, and is accessible from anywhere.</p>
        <h3 style="color:#f0f0f5;font-size:16px;margin-top:24px;">Next steps:</h3>
        <ol style="color:rgba(255,255,255,0.7);line-height:2;">
          <li>Install GlowOS on your computer</li>
          <li>Pick your AI provider (Gemini, Claude, ChatGPT...)</li>
          <li>Start chatting from any device</li>
        </ol>
        <a href="https://getglowos.com" style="display:inline-block;margin-top:24px;padding:12px 28px;background:linear-gradient(135deg,#6c5ce7,#a855f7);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;">Open GlowOS →</a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:32px;">GlowOS by Ashbi • Your AI runs locally, stays private.</p>
      </div>
    `
  });
}

export async function sendPairingCode(email, name, code) {
  return sendEmail({
    to: email,
    subject: `🔗 Your GlowOS pairing code: ${code}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0f0f5;padding:40px;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#6c5ce7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px;">GlowOS</h1>
        <h2 style="color:#f0f0f5;">Your pairing code</h2>
        <p style="color:rgba(255,255,255,0.7);">Hey ${escapeHtml(name)}, use this code to connect your computer:</p>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <code style="font-size:32px;font-weight:700;letter-spacing:4px;color:#a855f7;">${code}</code>
        </div>
        <p style="color:rgba(255,255,255,0.5);font-size:13px;">Or run this command:</p>
        <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;color:#6c5ce7;">
          curl -fsSL getglowos.com/install.sh | bash
        </div>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:32px;">GlowOS by Ashbi</p>
      </div>
    `
  });
}

export async function sendPasswordReset(email, name, resetUrl) {
  return sendEmail({
    to: email,
    subject: '🔑 Reset your GlowOS password',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0f0f5;padding:40px;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#6c5ce7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px;margin-bottom:8px;">GlowOS</h1>
        <p style="color:rgba(255,255,255,0.6);margin-bottom:24px;">Password Reset</p>
        <h2 style="color:#f0f0f5;font-size:20px;">Hey ${escapeHtml(name)},</h2>
        <p style="color:rgba(255,255,255,0.7);line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;margin-top:24px;padding:14px 32px;background:linear-gradient(135deg,#6c5ce7,#a855f7);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px;">Reset Password</a>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:24px;line-height:1.5;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:32px;">GlowOS by Ashbi • Your AI runs locally, stays private.</p>
      </div>
    `
  });
}

export async function sendGoodbye(email, name) {
  return sendEmail({
    to: email,
    subject: '👋 Your GlowOS account has been deleted',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0f0f5;padding:40px;border-radius:16px;">
        <h1 style="background:linear-gradient(135deg,#6c5ce7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px;margin-bottom:8px;">GlowOS</h1>
        <h2 style="color:#f0f0f5;font-size:20px;">Goodbye ${escapeHtml(name)},</h2>
        <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Your GlowOS account and all associated data have been permanently deleted as requested.</p>
        <p style="color:rgba(255,255,255,0.7);line-height:1.6;">If you ever want to come back, you're always welcome to create a new account at <a href="https://getglowos.com" style="color:#a855f7;">getglowos.com</a>.</p>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:32px;">GlowOS by Ashbi</p>
      </div>
    `
  });
}
