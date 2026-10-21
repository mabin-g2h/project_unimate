import { test, expect, type APIRequestContext } from '@playwright/test';
import { ctx, adminCtx, studentCtx } from '../helpers/api';

// Role matrix: every route group x {anonymous, student, admin}. Anonymous requests to
// non-/api/auth routes are bounced by middleware with a 307 to /login (not a 401), so
// redirects are never followed. Admin routes are exercised with invalid bodies / ids
// that cannot change real data.
type Call = { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; data?: unknown };
const UUID = '00000000-0000-4000-8000-000000000000';

const ADMIN_ROUTES: Call[] = [
  { method: 'GET', path: '/api/admin/students' },
  { method: 'POST', path: '/api/admin/students/999999/review', data: {} },
  { method: 'POST', path: '/api/admin/students/999999/revoke', data: {} },
  { method: 'PATCH', path: '/api/admin/students/999999/profile', data: {} },
  { method: 'POST', path: '/api/admin/students/archive-expired' },
  { method: 'GET', path: '/api/admin/logs' },
  { method: 'GET', path: '/api/admin/logs/student?email=nobody@example.test' },
  { method: 'GET', path: '/api/admin/admins' },
  { method: 'POST', path: '/api/admin/admins', data: {} },
  { method: 'DELETE', path: '/api/admin/admins/999999' },
  { method: 'DELETE', path: `/api/admin/admins/invite/${UUID}` },
  { method: 'POST', path: '/api/admin/options/universities', data: {} },
  { method: 'DELETE', path: '/api/admin/options/universities/999999' },
  { method: 'POST', path: '/api/admin/options/universities/999999/courses', data: {} },
  { method: 'DELETE', path: '/api/admin/options/courses/999999' },
  { method: 'POST', path: '/api/admin/options/airports', data: {} },
  { method: 'DELETE', path: '/api/admin/options/airports/999999' },
  { method: 'POST', path: '/api/admin/options/airlines', data: {} },
  { method: 'DELETE', path: '/api/admin/options/airlines/999999' },
  { method: 'POST', path: '/api/admin/options/cities', data: {} },
  { method: 'DELETE', path: '/api/admin/options/cities/999999' },
];

const SESSION_ROUTES: Call[] = [
  { method: 'GET', path: '/api/auth/me' },
  { method: 'GET', path: '/api/students/me' },
  { method: 'GET', path: '/api/students/peers' },
  { method: 'GET', path: '/api/students/flight' },
  { method: 'GET', path: '/api/options/universities' },
  { method: 'GET', path: '/api/options/airports' },
  { method: 'GET', path: '/api/options/airlines' },
  { method: 'GET', path: '/api/options/cities' },
  { method: 'GET', path: '/api/files/anything.pdf' },
];

function send(c: APIRequestContext, call: Call) {
  return c.fetch(call.path, { method: call.method, data: call.data as never, maxRedirects: 0 });
}

test.describe('anonymous', () => {
  for (const call of [...ADMIN_ROUTES, ...SESSION_ROUTES.filter(c => !c.path.startsWith('/api/auth'))]) {
    test(`${call.method} ${call.path} -> 307 /login`, async () => {
      const r = await send(await ctx(), call);
      expect(r.status()).toBe(307);
      expect(r.headers()['location']).toContain('/login');
    });
  }
  test('GET /api/auth/me -> 401 (public prefix, route-level check)', async () => {
    expect((await send(await ctx(), { method: 'GET', path: '/api/auth/me' })).status()).toBe(401);
  });
  test('POST /api/students/flight, share-phone, invite-peer, student/register -> 307', async () => {
    const c = await ctx();
    for (const [method, path] of [['POST', '/api/students/flight'], ['PUT', '/api/students/share-phone'], ['POST', '/api/students/invite-peer'], ['POST', '/api/student/register']] as const) {
      const r = await send(c, { method, path, data: {} });
      expect(r.status(), path).toBe(307);
    }
  });
});

test.describe('student session on admin routes', () => {
  for (const call of ADMIN_ROUTES) {
    test(`${call.method} ${call.path} -> 401/403`, async () => {
      const { api } = await studentCtx();
      const r = await send(api, call);
      expect([401, 403], `${call.method} ${call.path} returned ${r.status()}`).toContain(r.status());
    });
  }
});

test.describe('admin session reaches admin routes', () => {
  for (const call of ADMIN_ROUTES) {
    test(`${call.method} ${call.path} is not blocked`, async () => {
      const api = await adminCtx();
      const r = await send(api, call);
      expect([401, 403, 307], `${call.method} ${call.path} returned ${r.status()}`).not.toContain(r.status());
      expect(r.status()).toBeLessThan(500);
    });
  }
});

test.describe('student session reaches student routes', () => {
  for (const call of SESSION_ROUTES.filter(c => c.path !== '/api/files/anything.pdf')) {
    test(`${call.method} ${call.path} -> 200`, async () => {
      const { api } = await studentCtx();
      expect((await send(api, call)).status()).toBe(200);
    });
  }
  test('GET /api/files/* is retired -> 410', async () => {
    const { api } = await studentCtx();
    expect((await send(api, { method: 'GET', path: '/api/files/anything.pdf' })).status()).toBe(410);
  });
});

test('admin routes: cross-student isolation of /api/students/me', async () => {
  const a = await studentCtx({ name: 'Alice A' });
  const b = await studentCtx({ name: 'Bob B' });
  const ra = await (await a.api.get('/api/students/me')).json();
  const rb = await (await b.api.get('/api/students/me')).json();
  expect(ra.profile.full_name).toBe('Alice A');
  expect(rb.profile.full_name).toBe('Bob B');
});
