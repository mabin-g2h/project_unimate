import { loadTestEnv, assertSafeTestDb } from './helpers/env';
import { resetAndSeed } from './helpers/db';

export default async function globalSetup() {
  const env = loadTestEnv();
  assertSafeTestDb(env); // throws before anything destructive runs
  const m = await fetch(`${env.MAILPIT_API}/api/v1/info`).catch(() => null);
  if (!m?.ok) throw new Error('Mailpit is not reachable — start it: docker start unimate-mailpit');
  await resetAndSeed();
}
