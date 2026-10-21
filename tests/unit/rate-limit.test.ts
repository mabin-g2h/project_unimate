import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sqlMock = vi.fn();
vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));
beforeEach(() => { vi.resetModules(); sqlMock.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const load = () => import('@/lib/rate-limit');
const req = (h: Record<string, string>) => new Request('http://x', { headers: h });

describe('clientIp', () => {
  it('prefers the first x-forwarded-for entry, then x-real-ip, then "unknown"', async () => {
    const { clientIp } = await load();
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(req({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('ipMax', () => {
  it('uses the given max, or RATE_LIMIT_IP_MAX when set (test harness)', async () => {
    const { ipMax } = await load();
    expect(ipMax(20)).toBe(20);
    vi.stubEnv('RATE_LIMIT_IP_MAX', '5000');
    expect(ipMax(20)).toBe(5000);
    vi.stubEnv('RATE_LIMIT_IP_MAX', 'abc');
    expect(ipMax(20)).toBe(20);
  });
});

describe('retryAfter', () => {
  it('is 0 when there is no row, under the limit, or the window has passed', async () => {
    const { retryAfter } = await load();
    sqlMock.mockResolvedValueOnce([]);
    expect(await retryAfter('k', 5, 60)).toBe(0);
    sqlMock.mockResolvedValueOnce([{ count: 4, wait: 30 }]);
    expect(await retryAfter('k', 5, 60)).toBe(0);
    sqlMock.mockResolvedValueOnce([{ count: 9, wait: 0 }]);
    expect(await retryAfter('k', 5, 60)).toBe(0);
  });
  it('returns the seconds to wait once the count reaches the max', async () => {
    const { retryAfter } = await load();
    sqlMock.mockResolvedValueOnce([{ count: 5, wait: 42 }]);
    expect(await retryAfter('k', 5, 60)).toBe(42);
  });
});

describe('hitAndCheck', () => {
  it('records every key, then reports the longest wait', async () => {
    const { hitAndCheck } = await load();
    sqlMock
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])              // two recordHit upserts
      .mockResolvedValueOnce([{ count: 4, wait: 10 }])                  // key A: 4th attempt, max 3 -> refused
      .mockResolvedValueOnce([{ count: 99, wait: 300 }]);               // key B far over a max of 10
    const wait = await hitAndCheck([{ key: 'a', max: 3, windowSec: 60 }, { key: 'b', max: 10, windowSec: 600 }]);
    expect(wait).toBe(300);
    expect(sqlMock).toHaveBeenCalledTimes(4);
  });
  it('allows exactly `max` attempts: the 3rd of 3 passes, the 4th does not', async () => {
    const { hitAndCheck } = await load();
    sqlMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 3, wait: 59 }]);
    expect(await hitAndCheck([{ key: 'a', max: 3, windowSec: 60 }])).toBe(0);
    sqlMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 4, wait: 58 }]);
    expect(await hitAndCheck([{ key: 'a', max: 3, windowSec: 60 }])).toBe(58);
  });
});

describe('tooMany', () => {
  it('is a 429 with a Retry-After header and a generic message', async () => {
    const { tooMany } = await load();
    const r = tooMany(125);
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('125');
    expect((await r.json()).error).toMatch(/3 minutes/);
    expect((await tooMany(30).json()).error).toMatch(/1 minute\./);
  });
});

describe('housekeeping', () => {
  it('pruneRateLimits returns the number of rows deleted', async () => {
    const { pruneRateLimits } = await load();
    sqlMock.mockResolvedValueOnce([1, 1, 1]);
    expect(await pruneRateLimits()).toBe(3);
  });
});
