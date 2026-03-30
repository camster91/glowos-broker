const jwtSecret = process.env.JWT_SECRET || 'glowos-dev-secret-change-me';

if (!process.env.JWT_SECRET || jwtSecret === 'glowos-dev-secret-change-me') {
  console.error('FATAL: JWT_SECRET must be set to a secure value (not the default)');
  process.exit(1);
}

export default {
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret,
  dbUrl: process.env.DATABASE_URL || 'postgresql://glowos:glowos@localhost:5432/glowos',
  corsOrigin: process.env.CORS_ORIGIN || 'https://getglowos.com',
};
