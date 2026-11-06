import { test, expect } from '@playwright/test';
import { studentCtx, adminCtx } from '../helpers/api';
import { testSql } from '../helpers/db';

const onboardedAt = async (userId: number) =>
  (await testSql()`SELECT onboarded_at FROM student_profiles WHERE user_id = ${userId}`)[0].onboarded_at as Date | null;

test.describe('POST /api/students/onboarded (dashboard tour flag)', () => {
  test('/me exposes onboarded_at: null before the tour, a timestamp after', async () => {
    const { api, user } = await studentCtx({ onboarded: false });
    expect((await (await api.get('/api/students/me')).json()).profile.onboarded_at).toBeNull();
    expect((await api.post('/api/students/onboarded', { data: { outcome: 'completed', step: 8 } })).status()).toBe(200);
    expect((await (await api.get('/api/students/me')).json()).profile.onboarded_at).not.toBeNull();
    expect(await onboardedAt(user.id)).not.toBeNull();
  });

  test('is idempotent: a second call keeps the first timestamp', async () => {
    const { api, user } = await studentCtx({ onboarded: false });
    await api.post('/api/students/onboarded', { data: { outcome: 'skipped', step: 1 } });
    const first = await onboardedAt(user.id);
    await api.post('/api/students/onboarded', { data: { outcome: 'completed', step: 8 } });
    expect(await onboardedAt(user.id)).toEqual(first);
  });

  test('logs tour_completed / tour_skipped with outcome and step only', async () => {
    const { api, user } = await studentCtx({ onboarded: false });
    await api.post('/api/students/onboarded', { data: { outcome: 'skipped', step: 3 } });
    const rows = await testSql()`SELECT event, category, metadata FROM student_error_logs WHERE user_id = ${user.id} AND event LIKE 'tour_%'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: 'tour_skipped', category: 'dashboard', metadata: { outcome: 'skipped', step: 3 } });
  });

  for (const data of [{}, { outcome: 'maybe' }, { outcome: 7 }, null]) {
    test(`rejects bad body ${JSON.stringify(data)} -> 400 and does not set the flag`, async () => {
      const { api, user } = await studentCtx({ onboarded: false });
      expect((await api.post('/api/students/onboarded', { data })).status()).toBe(400);
      expect(await onboardedAt(user.id)).toBeNull();
    });
  }

  test('pending student -> 404 and flag untouched', async () => {
    const { api, user } = await studentCtx({ status: 'pending', onboarded: false });
    expect((await api.post('/api/students/onboarded', { data: { outcome: 'completed' } })).status()).toBe(404);
    expect(await onboardedAt(user.id)).toBeNull();
  });

  test('admin session (no student profile) -> 404', async () => {
    const api = await adminCtx();
    expect((await api.post('/api/students/onboarded', { data: { outcome: 'completed' } })).status()).toBe(404);
  });
});
