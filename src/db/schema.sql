CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gateways (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Computer',
  auth_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateways_user ON gateways(user_id);
CREATE INDEX IF NOT EXISTS idx_gateways_token ON gateways(auth_token);
