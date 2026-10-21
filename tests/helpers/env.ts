import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..', '..');
export const TEST_PORT = 3100;
export const BASE_URL = `http://localhost:${TEST_PORT}`;
export const ADMIN = { email: 'admin@unimate.test', password: 'AdminPass123!' };

// .env.test is parsed explicitly: Next only auto-loads it when NODE_ENV=test, and we must
// never fall back to .env.local (production credentials).
export function loadTestEnv(): Record<string, string> {
  const file = path.join(ROOT, '.env.test');
  if (!fs.existsSync(file)) throw new Error('.env.test is missing — refusing to run tests.');
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

// Hard guard: nothing destructive (TRUNCATE / seed) may run unless every check passes.
export function assertSafeTestDb(env: Record<string, string>): string {
  if (env.TEST_MODE !== '1') throw new Error('GUARD: TEST_MODE=1 is required.');
  const conn = env.DATABASE_CONNECTION_STRING;
  if (!conn) throw new Error('GUARD: DATABASE_CONNECTION_STRING is empty.');
  const host = new URL(conn).hostname;
  const prod = env.PROD_DB_HOST_MARKER || 'ep-red-queen-apffrdjy';
  if (host.includes(prod)) throw new Error(`GUARD: ${host} is the PRODUCTION database. Aborting.`);
  const allowed = (env.TEST_DB_ALLOWED_HOSTS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(host)) throw new Error(`GUARD: ${host} is not on TEST_DB_ALLOWED_HOSTS. Aborting.`);
  return conn;
}
