export default {
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'glowos-dev-secret-change-me',
  dbUrl: process.env.DATABASE_URL || 'postgresql://glowos:glowos@localhost:5432/glowos',
  corsOrigin: process.env.CORS_ORIGIN || 'https://getglowos.com',
};
