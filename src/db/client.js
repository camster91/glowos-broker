import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: config.dbUrl });

export async function initDb() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
}

export function query(text, params) {
  return pool.query(text, params);
}

export default pool;
