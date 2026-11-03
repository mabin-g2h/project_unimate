import { test, expect, request } from '@playwright/test';
import { newUnregisteredStudent } from '../helpers/api';
import { testSql } from '../helpers/db';
import { BASE_URL } from '../helpers/env';

const rows = async (email: string) =>
  testSql()`SELECT level, event, message, category, route, user_id, metadata FROM student_error_logs WHERE email = ${email} AND event LIKE 'client\\_%' ORDER BY created_at`;

test.describe('client-log: browser-side registration failures', () => {
  test('refused without a session (middleware redirect), and nothing is stored', async () => {
    const anon = await request.newContext({ baseURL: BASE_URL });
    const r = await anon.post('/api/student/client-log', { data: { event: 'client_submit_gave_up' }, maxRedirects: 0 });
    expect([307, 401]).toContain(r.status());
    expect(await testSql()`SELECT 1 FROM student_error_logs WHERE event = 'client_submit_gave_up'`).toHaveLength(0);
  });

  test('a known event is stored as a registration row for the signed-in student', async () => {
    const { user, api } = await newUnregisteredStudent();
    const r = await api.post('/api/student/client-log', {
      data: { event: 'client_submit_network_error', metadata: { attempt: 2, error_name: 'TypeError', error_message: 'Failed to fetch', total_bytes: 3_900_000, online: false, net_type: '3g' } },
    });
    expect(r.status()).toBe(204);
    const [row] = await rows(user.email);
    expect(row).toMatchObject({ level: 'warn', event: 'client_submit_network_error', category: 'registration', route: '/api/student/client-log', user_id: user.id });
    expect(row.metadata).toEqual({ attempt: 2, error_name: 'TypeError', error_message: 'Failed to fetch', total_bytes: 3_900_000, online: false, net_type: '3g' });
  });

  test('an unknown event, bad JSON or an oversized body is rejected and not stored', async () => {
    const { user, api } = await newUnregisteredStudent();
    expect((await api.post('/api/student/client-log', { data: { event: 'student_approved' } })).status()).toBe(400);
    expect((await api.post('/api/student/client-log', { data: { event: 'toString' } })).status()).toBe(400);
    expect((await api.post('/api/student/client-log', { headers: { 'Content-Type': 'application/json' }, data: '{nope' })).status()).toBe(400);
    expect((await api.post('/api/student/client-log', { data: { event: 'client_submit_gave_up', metadata: { error_message: 'x'.repeat(5000) } } })).status()).toBe(400);
    expect(await rows(user.email)).toHaveLength(0);
  });

  test('only whitelisted, correctly typed metadata is kept; strings are clamped', async () => {
    const { user, api } = await newUnregisteredStudent();
    await api.post('/api/student/client-log', {
      data: {
        event: 'client_validation_error',
        metadata: {
          field: 'phone', reason: 'invalid_phone',
          phone: '+919876543210', passport_url: 'https://blob.example/x.pdf', file_name: 'Anna Passport.pdf', full_name: 'Anna Grace',
          attempt: 'two', online: 'yes', rtt: Number.NaN, error_message: 'e'.repeat(1000),
        },
      },
    });
    const [row] = await rows(user.email);
    expect(Object.keys(row.metadata).sort()).toEqual(['error_message', 'field', 'reason']);
    expect(row.metadata.error_message).toHaveLength(300);
    expect(JSON.stringify(row)).not.toMatch(/9876543210|blob\.example|Anna/);
  });

  test('over the per-student hourly cap the endpoint still answers 204 but stops storing', async () => {
    const { user, api } = await newUnregisteredStudent();
    for (let i = 0; i < 43; i++) {
      expect((await api.post('/api/student/client-log', { data: { event: 'client_load_failed', metadata: { step: 'me' } } })).status()).toBe(204);
    }
    expect(await rows(user.email)).toHaveLength(40);
  });
});
