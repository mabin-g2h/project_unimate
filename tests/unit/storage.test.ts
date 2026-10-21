import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const put = vi.fn(async () => ({ url: 'https://blob.example/x.pdf' }));
const del = vi.fn(async () => {});
vi.mock('@vercel/blob', () => ({ put: (...a: unknown[]) => (put as (...x: unknown[]) => unknown)(...a), del: (...a: unknown[]) => (del as (...x: unknown[]) => unknown)(...a) }));
const dir = path.join(process.cwd(), 'public', '__test_uploads');

beforeEach(() => { vi.resetModules(); put.mockClear(); del.mockClear(); });
afterEach(() => vi.unstubAllEnvs());
const file = (s: string) => new File([s], 'whatever.pdf');

describe('lib/storage', () => {
  it('delegates to Vercel Blob when STORAGE_DRIVER is not "local"', async () => {
    vi.stubEnv('STORAGE_DRIVER', '');
    const s = await import('@/lib/storage');
    expect(await s.putFile('a.pdf', file('x'))).toBe('https://blob.example/x.pdf');
    await s.delFiles(['https://blob.example/x.pdf']);
    expect(put).toHaveBeenCalledOnce(); expect(del).toHaveBeenCalledWith(['https://blob.example/x.pdf']);
  });
  it('local driver writes under public/__test_uploads, strips path components, and deletes only local URLs', async () => {
    vi.stubEnv('STORAGE_DRIVER', 'local');
    const s = await import('@/lib/storage');
    const url = await s.putFile('../../escape_unit.pdf', file('hello'));
    expect(url).toBe('/__test_uploads/escape_unit.pdf');
    expect(fs.readFileSync(path.join(dir, 'escape_unit.pdf'), 'utf8')).toBe('hello');
    await s.delFiles([url, 'https://blob.example/never-touched.pdf']);
    expect(fs.existsSync(path.join(dir, 'escape_unit.pdf'))).toBe(false);
    expect(put).not.toHaveBeenCalled(); expect(del).not.toHaveBeenCalled();
  });
  it('local delete of a missing file does not throw', async () => {
    vi.stubEnv('STORAGE_DRIVER', 'local');
    await expect((await import('@/lib/storage')).delFiles(['/__test_uploads/does-not-exist.pdf'])).resolves.toBeUndefined();
  });
});
