import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({ sql: vi.fn(async () => []) }));
vi.mock('@/lib/archive', () => ({ archiveExpiredStudents: vi.fn(async () => 0) }));
vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => {}) }));
vi.mock('@/lib/rate-limit', () => ({ pruneRateLimits: vi.fn(async () => 0) }));

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());
const call = async (secret: string | undefined, header?: string) => {
  if (secret === undefined) vi.stubEnv('CRON_SECRET', ''); else vi.stubEnv('CRON_SECRET', secret);
  const { GET } = await import('@/app/api/auth/cleanup/route');
  return GET(new Request('http://x/api/auth/cleanup', { headers: header === undefined ? {} : { authorization: header } }));
};

describe('cleanup cron authorisation', () => {
  it('requires the Bearer scheme', async () => expect((await call('s3cret', 's3cret')).status).toBe(401));
  it('accepts the correct bearer secret', async () => expect((await call('s3cret', 'Bearer s3cret')).status).toBe(200));
  it('rejects a wrong or missing header when a secret is configured', async () => {
    expect((await call('s3cret', 'Bearer nope!!')).status).toBe(401);
    expect((await call('s3cret', 'Bearer s3cre')).status).toBe(401);
    expect((await call('s3cret')).status).toBe(401);
  });
  // F-31 (fixed): with CRON_SECRET unset/empty a request with no Authorization header used to pass
  // (`'' === ''`), running purge + archive + log prune. The endpoint now fails closed.
  it('fails closed when CRON_SECRET is unset or empty', async () => {
    expect((await call(undefined)).status).toBe(401);
    expect((await call('', 'Bearer ')).status).toBe(401);
  });
});

describe('pending-reminder cron authorisation', () => {
  const callReminder = async (secret: string, header?: string) => {
    vi.stubEnv('CRON_SECRET', secret);
    const { GET } = await import('@/app/api/auth/pending-reminder/route');
    return GET(new Request('http://x/api/auth/pending-reminder', { headers: header === undefined ? {} : { authorization: header } }));
  };
  it('rejects a missing, malformed or wrong secret', async () => {
    expect((await callReminder('s3cret')).status).toBe(401);
    expect((await callReminder('s3cret', 's3cret')).status).toBe(401);
    expect((await callReminder('s3cret', 'Bearer nope!!')).status).toBe(401);
  });
  it('fails closed when CRON_SECRET is unset or empty', async () => {
    expect((await callReminder('')).status).toBe(401);
    expect((await callReminder('', 'Bearer ')).status).toBe(401);
  });
  it('accepts the correct secret and sends nothing when nothing is pending', async () => {
    const res = await callReminder('s3cret', 'Bearer s3cret'); // sql mock returns []
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pending: 0, sent: 0, failed: 0 });
  });
});
