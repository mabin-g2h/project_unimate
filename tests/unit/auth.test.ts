import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let cookieValue: string | undefined;
const sqlMock = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }) }));
vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));

beforeEach(() => { vi.resetModules(); sqlMock.mockReset(); cookieValue = undefined; vi.stubEnv('JWT_SECRET', 'unit-test-secret-unit-test-secret-1234'); });
afterEach(() => vi.unstubAllEnvs());
const load = () => import('@/lib/auth');

describe('JWT helpers', () => {
  const claims = { userId: 7, email: 'a@b.test', role: 'student', emailVerified: true };
  it('round-trips a payload', async () => {
    const { signToken, verifyToken } = await load();
    const p = await verifyToken(await signToken(claims));
    expect(p).toMatchObject(claims);
    expect(Math.abs(p!.exp! - (Math.floor(Date.now() / 1000) + 7 * 24 * 3600))).toBeLessThan(5);
  });
  it('rejects tampered, truncated and foreign-secret tokens', async () => {
    const { signToken, verifyToken } = await load();
    const t = await signToken(claims);
    expect(await verifyToken(t.slice(0, -2) + 'xx')).toBeNull();
    expect(await verifyToken('nope')).toBeNull();
    vi.resetModules(); vi.stubEnv('JWT_SECRET', 'a-different-secret-a-different-secret-12');
    expect(await (await load()).verifyToken(t)).toBeNull();
  });
});

// F-14 / F-15 / F-16: the token is only a pointer; the DB row decides.
describe('getSession() re-checks the database', () => {
  const claims = { userId: 7, email: 'old@b.test', role: 'admin', emailVerified: true };
  const login = async (extra: object = {}) => { const a = await load(); cookieValue = await a.signToken({ ...claims, ...extra }); return a; };
  const row = (o: object = {}) => ({ email: 'old@b.test', role: 'admin', email_verified: true, token_version: 0, ...o });

  it('returns null when there is no cookie, without querying the DB', async () => {
    expect(await (await load()).getSession()).toBeNull();
    expect(sqlMock).not.toHaveBeenCalled();
  });
  it('returns null for a deleted user (F-15)', async () => {
    const a = await login(); sqlMock.mockResolvedValue([]);
    expect(await a.getSession()).toBeNull();
  });
  it('takes the role from the DB, so a demoted admin is a student at once (F-14)', async () => {
    const a = await login(); sqlMock.mockResolvedValue([row({ role: 'student', token_version: 0 })]);
    expect((await a.getSession())!.role).toBe('student');
  });
  it('rejects a token whose version no longer matches (demote / password reset) (F-14, F-16)', async () => {
    const a = await login({ tv: 0 }); sqlMock.mockResolvedValue([row({ token_version: 1 })]);
    expect(await a.getSession()).toBeNull();
  });
  it('accepts a legacy token with no `tv` while the user is at version 0', async () => {
    const a = await login(); sqlMock.mockResolvedValue([row()]);
    expect((await a.getSession())!.userId).toBe(7);
  });
  it('rejects a legacy token once the version has been bumped', async () => {
    const a = await login(); sqlMock.mockResolvedValue([row({ token_version: 2 })]);
    expect(await a.getSession()).toBeNull();
  });
  it('accepts a token carrying the current version, and uses DB email/emailVerified', async () => {
    const a = await login({ tv: 3 }); sqlMock.mockResolvedValue([row({ token_version: 3, email: 'new@b.test', email_verified: false })]);
    expect(await a.getSession()).toMatchObject({ email: 'new@b.test', emailVerified: false, tv: 3 });
  });
});

describe('makeSessionCookieOptions', () => {
  it('is Secure only in production, always HttpOnly + Lax + 7 days', async () => {
    const { makeSessionCookieOptions } = await load();
    vi.stubEnv('NODE_ENV', 'production');
    expect(makeSessionCookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 604800, path: '/' });
    vi.stubEnv('NODE_ENV', 'development');
    expect(makeSessionCookieOptions().secure).toBe(false);
  });
});
