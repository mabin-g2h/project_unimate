import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
const load = () => import('@/lib/account');

describe('isValidDateString', () => {
  it.each(['2027-01-31', '2028-02-29', '1999-12-31'])('accepts %s', async d => expect((await load()).isValidDateString(d)).toBe(true));
  it.each(['', '2027-1-1', '01/02/2027', '2027-13-01', '2027-00-10', 'tomorrow', null, undefined, 20270101, {}])('rejects %j', async d => expect((await load()).isValidDateString(d)).toBe(false));
  // FINDING F-11: V8 rolls impossible days over, so validation passes and Postgres later rejects the DATE (500).
  it.fails('rejects impossible calendar dates (2027-02-30, 2027-04-31)', async () => {
    const { isValidDateString } = await load();
    expect(isValidDateString('2027-02-30')).toBe(false);
    expect(isValidDateString('2027-04-31')).toBe(false);
  });
});

describe('computeExpiry', () => {
  it('adds the default 30 days (UTC, month rollover, leap year)', async () => {
    const { computeExpiry } = await load();
    expect(computeExpiry('2027-01-01')).toBe('2027-01-31');
    expect(computeExpiry('2027-12-15')).toBe('2028-01-14');
    expect(computeExpiry('2028-02-10')).toBe('2028-03-11');
  });
  it('accepts a Date and does not mutate it', async () => {
    const { computeExpiry } = await load();
    const d = new Date('2027-03-01T00:00:00Z');
    expect(computeExpiry(d)).toBe('2027-03-31');
    expect(d.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });
  it('throws on an invalid date', async () => {
    const { computeExpiry } = await load();
    expect(() => computeExpiry('garbage')).toThrow();
  });
  it('honours ACCOUNT_LIFESPAN_DAYS and falls back to 30 for 0 / NaN', async () => {
    vi.stubEnv('ACCOUNT_LIFESPAN_DAYS', '90');
    expect((await load()).computeExpiry('2027-01-01')).toBe('2027-04-01');
    vi.resetModules();
    for (const bad of ['0', 'abc', '']) {
      vi.stubEnv('ACCOUNT_LIFESPAN_DAYS', bad);
      expect((await load()).ACCOUNT_LIFESPAN_DAYS, bad).toBe(30);
      vi.resetModules();
    }
  });
  it('a negative lifespan is accepted as-is (no lower bound)', async () => {
    vi.stubEnv('ACCOUNT_LIFESPAN_DAYS', '-5');
    expect((await load()).ACCOUNT_LIFESPAN_DAYS).toBe(-5);
  });
});
