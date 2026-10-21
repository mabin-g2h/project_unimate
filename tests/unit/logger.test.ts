import { describe, it, expect, vi, beforeEach } from 'vitest';

const sqlMock = vi.fn();
vi.mock('@/lib/db', () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));
beforeEach(() => { sqlMock.mockReset(); vi.resetModules(); });
const load = () => import('@/lib/logger');

describe('log()', () => {
  it('resolves (never rejects) when the DB write fails', async () => {
    sqlMock.mockImplementation(() => Promise.reject(new Error('db down')));
    const { log } = await load();
    await expect(log({ level: 'error', event: 'x', message: 'm' })).resolves.toBeUndefined();
  });
  it('resolves when the query succeeds, and serialises metadata as JSON', async () => {
    sqlMock.mockReturnValue(Promise.resolve([]));
    const { log } = await load();
    await expect(log({ level: 'info', event: 'e', message: 'm', metadata: { a: 1 } })).resolves.toBeUndefined();
    expect(sqlMock.mock.calls[0].slice(1)).toContain('{"a":1}');
  });
  it('maps absent optional fields to NULL', async () => {
    sqlMock.mockReturnValue(Promise.resolve([]));
    await (await load()).log({ level: 'warn', event: 'e', message: 'm' });
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values.filter((v: unknown) => v === null).length).toBe(6); // category, email, actor, user, route, metadata
  });
  it('documents: a synchronous throw from sql() is not caught (only async rejections are swallowed)', async () => {
    sqlMock.mockImplementation(() => { throw new Error('sync boom'); });
    const { log } = await load();
    expect(() => log({ level: 'error', event: 'x', message: 'm' })).toThrow('sync boom');
  });
});
