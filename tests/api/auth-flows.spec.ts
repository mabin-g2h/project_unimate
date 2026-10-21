import { test, expect } from '@playwright/test';
import { ctx, loginAs, adminCtx, seedUser, seedProfile, emailFor, PASSWORD, finding, uniq } from '../helpers/api';
import { testSql } from '../helpers/db';
import { waitForMail, mailHtml, firstLink, mailFor } from '../helpers/mail';
import { BASE_URL, loadTestEnv } from '../helpers/env';

const tokenFrom = (link: string) => new URL(link).searchParams.get('token')!;

async function signupAndLink(email: string) {
  const c = await ctx();
  const r = await c.post('/api/auth/signup', { data: { email, password: PASSWORD } });
  expect(r.status()).toBe(200);
  const html = await mailHtml((await waitForMail(email, '')).ID);
  return firstLink(html, /http:\/\/localhost:3100\/api\/auth\/verify-email\?token=[a-f0-9]+/);
}

test.describe('signup + verification', () => {
  test('validation: missing fields and short password -> 400', async () => {
    const c = await ctx();
    expect((await c.post('/api/auth/signup', { data: { email: 'a@b.test' } })).status()).toBe(400);
    expect((await c.post('/api/auth/signup', { data: { email: 'a@b.test', password: 'short' } })).status()).toBe(400);
  });

  test('student: verify link redirects to /register, sets cookie + 48h form deadline, link is single-use', async () => {
    const email = emailFor('signup');
    const link = await signupAndLink(email);
    const c = await ctx();
    const r = await c.get(link, { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()['location']).toContain('/register');
    expect(r.headers()['set-cookie']).toContain('auth-token=');
    const [u] = await testSql()`SELECT email_verified, verification_token, role, (verification_expires - NOW()) > INTERVAL '47 hours' AS deadline FROM users WHERE email = ${email}`;
    expect(u.email_verified).toBe(true);
    expect(u.verification_token).toBeNull();
    expect(u.role).toBe('student');
    expect(u.deadline).toBe(true);
    const again = await (await ctx()).get(link, { maxRedirects: 0 });
    expect(again.headers()['location']).toContain('error=invalid');
  });

  test('duplicate signup (also case-insensitive) -> 409', async () => {
    const email = emailFor('dup');
    await signupAndLink(email);
    const c = await ctx();
    expect((await c.post('/api/auth/signup', { data: { email, password: PASSWORD } })).status()).toBe(409);
    expect((await c.post('/api/auth/signup', { data: { email: email.toUpperCase(), password: PASSWORD } })).status()).toBe(409);
  });

  test('ADMIN_EMAIL address becomes role=admin and lands on /admin after verifying', async () => {
    const email = 'boot-admin@unimate.test';
    await testSql()`DELETE FROM users WHERE email = ${email}`;
    const link = await signupAndLink(email);
    const r = await (await ctx()).get(link, { maxRedirects: 0 });
    expect(r.headers()['location']).toContain('/admin');
    const [u] = await testSql()`SELECT role, verification_expires FROM users WHERE email = ${email}`;
    expect(u.role).toBe('admin');
    expect(u.verification_expires).toBeNull();
  });

  test('expired verification link deletes the account and reports expiry', async () => {
    const email = emailFor('exp');
    const link = await signupAndLink(email);
    await testSql()`UPDATE users SET verification_expires = NOW() - INTERVAL '1 minute' WHERE email = ${email}`;
    const r = await (await ctx()).get(link, { maxRedirects: 0 });
    expect(r.headers()['location']).toContain('error=expired');
    expect(await testSql()`SELECT 1 FROM users WHERE email = ${email}`).toHaveLength(0);
  });

  test('bogus / missing token -> invalid', async () => {
    const c = await ctx();
    expect((await c.get('/api/auth/verify-email?token=deadbeef', { maxRedirects: 0 })).headers()['location']).toContain('error=invalid');
    expect((await c.get('/api/auth/verify-email', { maxRedirects: 0 })).headers()['location']).toContain('error=invalid');
  });

  test('an abandoned (expired, no profile) account is purged by a fresh signup with the same email', async () => {
    const email = emailFor('abandon');
    await signupAndLink(email);
    await testSql()`UPDATE users SET verification_expires = NOW() - INTERVAL '1 hour' WHERE email = ${email}`;
    const r = await (await ctx()).post('/api/auth/signup', { data: { email, password: PASSWORD } });
    expect(r.status()).toBe(200);
  });
});

test.describe('login', () => {
  test('unknown email and wrong password give the same message; unverified -> 403 UNVERIFIED', async () => {
    const u = await seedUser();
    const unverified = await seedUser({ verified: false });
    const c = await ctx();
    const a = await c.post('/api/auth/login', { data: { email: 'nobody@example.test', password: PASSWORD } });
    const b = await c.post('/api/auth/login', { data: { email: u.email, password: 'WrongPass123!' } });
    expect(a.status()).toBe(401);
    expect(b.status()).toBe(401);
    expect((await a.json()).error).toBe((await b.json()).error);
    const v = await c.post('/api/auth/login', { data: { email: unverified.email, password: PASSWORD } });
    expect(v.status()).toBe(403);
    expect((await v.json()).code).toBe('UNVERIFIED');
  });

  test('success sets an HttpOnly, SameSite=Lax, 7-day cookie; email is case-insensitive; logout clears it', async () => {
    const u = await seedUser();
    const c = await ctx();
    const r = await c.post('/api/auth/login', { data: { email: u.email.toUpperCase(), password: PASSWORD } });
    expect(r.status()).toBe(200);
    const cookie = r.headers()['set-cookie'];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=604800/i);
    expect((await c.get('/api/auth/me')).status()).toBe(200);
    const out = await c.post('/api/auth/logout');
    expect(out.status()).toBe(200);
    expect((await c.get('/api/auth/me')).status()).toBe(401);
  });

  test('login with a missing body field returns a controlled error, not a crash', async () => {
    finding('F-12', 'login/forgot-password call .toLowerCase() on an undefined email and return 500 instead of 400');
    const r = await (await ctx()).post('/api/auth/login', { data: { password: PASSWORD } });
    expect(r.status()).toBe(400);
  });
});

test.describe('forgot / reset password', () => {
  test('unknown + unverified emails get 200 and no mail; verified gets a link', async () => {
    const c = await ctx();
    const unknown = emailFor('nx');
    const unverified = await seedUser({ verified: false });
    const real = await seedUser();
    expect((await c.post('/api/auth/forgot-password', { data: { email: unknown } })).status()).toBe(200);
    expect((await c.post('/api/auth/forgot-password', { data: { email: unverified.email } })).status()).toBe(200);
    expect((await c.post('/api/auth/forgot-password', { data: { email: real.email } })).status()).toBe(200);
    await waitForMail(real.email, '');
    expect(await mailFor(unknown)).toHaveLength(0);
    expect(await mailFor(unverified.email)).toHaveLength(0);
  });

  test('reset: link works once, new password logs in, old one does not; short/invalid/expired tokens refused', async () => {
    const u = await seedUser();
    const c = await ctx();
    await c.post('/api/auth/forgot-password', { data: { email: u.email } });
    const html = await mailHtml((await waitForMail(u.email, '')).ID);
    const token = tokenFrom(firstLink(html, /http:\/\/localhost:3100\/reset-password\?token=[a-f0-9]+/));

    expect((await c.post('/api/auth/reset-password', { data: { token, password: 'short' } })).status()).toBe(400);
    expect((await c.post('/api/auth/reset-password', { data: { token: 'nope', password: 'LongEnough123!' } })).status()).toBe(400);
    expect((await c.post('/api/auth/reset-password', { data: { password: 'LongEnough123!' } })).status()).toBe(400);

    expect((await c.post('/api/auth/reset-password', { data: { token, password: 'BrandNew123!' } })).status()).toBe(200);
    expect((await c.post('/api/auth/reset-password', { data: { token, password: 'Another123!' } })).status()).toBe(400); // single-use
    expect((await c.post('/api/auth/login', { data: { email: u.email, password: 'BrandNew123!' } })).status()).toBe(200);
    expect((await c.post('/api/auth/login', { data: { email: u.email, password: PASSWORD } })).status()).toBe(401);
  });

  test('expired reset token -> 400', async () => {
    const u = await seedUser();
    const c = await ctx();
    await c.post('/api/auth/forgot-password', { data: { email: u.email } });
    const [row] = await testSql()`UPDATE users SET password_reset_expires = NOW() - INTERVAL '1 minute' WHERE email = ${u.email} RETURNING password_reset_token`;
    const r = await c.post('/api/auth/reset-password', { data: { token: row.password_reset_token, password: 'BrandNew123!' } });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/expired/i);
  });

  test('forgot-password with a missing email returns 400, not 500', async () => {
    finding('F-12', 'login/forgot-password call .toLowerCase() on an undefined email and return 500 instead of 400');
    expect((await (await ctx()).post('/api/auth/forgot-password', { data: {} })).status()).toBe(400);
  });
});

test.describe('admin management + invites', () => {
  test('invite -> mail -> accept (cookie, role=admin, invite consumed) -> reuse refused', async () => {
    const admin = await adminCtx();
    const email = emailFor('newadmin');
    expect((await admin.post('/api/admin/admins', { data: { email } })).status()).toBe(201);
    expect((await admin.post('/api/admin/admins', { data: { email } })).status()).toBe(409); // pending invite
    const html = await mailHtml((await waitForMail(email, '')).ID);
    const token = tokenFrom(firstLink(html, /http:\/\/localhost:3100\/accept-invite\?token=[a-f0-9-]+/));

    const c = await ctx();
    expect((await c.post('/api/auth/accept-invite', { data: { token, password: 'short' } })).status()).toBe(400);
    expect((await c.post('/api/auth/accept-invite', { data: {} })).status()).toBe(400);
    const ok = await c.post('/api/auth/accept-invite', { data: { token, password: 'AdminNew123!' } });
    expect(ok.status()).toBe(200);
    expect(ok.headers()['set-cookie']).toContain('auth-token=');
    expect((await c.get('/api/admin/students')).status()).toBe(200);
    expect((await (await ctx()).post('/api/auth/accept-invite', { data: { token, password: 'AdminNew123!' } })).status()).toBe(404);
  });

  test('invite guards: existing admin / student -> 409; blank -> 400; expired invite -> 410; revoke removes it', async () => {
    const admin = await adminCtx();
    const student = await seedUser();
    expect((await admin.post('/api/admin/admins', { data: { email: 'admin@unimate.test' } })).status()).toBe(409);
    expect((await admin.post('/api/admin/admins', { data: { email: student.email } })).status()).toBe(409);
    expect((await admin.post('/api/admin/admins', { data: { email: '  ' } })).status()).toBe(400);

    const email = emailFor('exp-inv');
    await admin.post('/api/admin/admins', { data: { email } });
    const [inv] = await testSql()`UPDATE admin_invites SET expires_at = NOW() - INTERVAL '1 hour' WHERE email = ${email} RETURNING token, id`;
    expect((await (await ctx()).post('/api/auth/accept-invite', { data: { token: inv.token, password: 'AdminNew123!' } })).status()).toBe(410);

    const email2 = emailFor('rev-inv');
    await admin.post('/api/admin/admins', { data: { email: email2 } });
    const [inv2] = await testSql()`SELECT id FROM admin_invites WHERE email = ${email2}`;
    expect((await admin.delete(`/api/admin/admins/invite/${inv2.id}`)).status()).toBe(204);
    expect(await testSql()`SELECT 1 FROM admin_invites WHERE email = ${email2}`).toHaveLength(0);
  });

  test('demote: cannot demote self; non-admin id 404; demoted admin loses access', async () => {
    const admin = await adminCtx();
    const target = await seedUser({ role: 'admin' });
    const targetApi = await loginAs(target.email);
    const [me] = await testSql()`SELECT id FROM users WHERE email = 'admin@unimate.test'`;
    expect((await admin.delete(`/api/admin/admins/${me.id}`)).status()).toBe(400);
    expect((await admin.delete('/api/admin/admins/999999')).status()).toBe(404);
    expect((await targetApi.get('/api/admin/students')).status()).toBe(200);
    expect((await admin.delete(`/api/admin/admins/${target.id}`)).status()).toBe(204);
    expect([401, 403]).toContain((await loginAs(target.email).then(c => c.get('/api/admin/students'))).status()); // fresh login: role re-read
    // the already-issued token keeps working (see security spec): not asserted here
  });
});

test.describe('cron cleanup', () => {
  const cron = (secret?: string) => ctx().then(c => c.get('/api/auth/cleanup', { headers: secret === undefined ? {} : { authorization: `Bearer ${secret}` } }));

  test('rejects missing / wrong secret', async () => {
    expect((await cron()).status()).toBe(401);
    expect((await cron('wrong-secret')).status()).toBe(401);
    expect((await cron('x')).status()).toBe(401);
  });

  test('purges abandoned students, keeps admins + students with a profile, archives expired, prunes old logs', async () => {
    const sql = testSql();
    const secret = loadTestEnv().CRON_SECRET;
    const abandoned = await seedUser({ verified: false });
    const verifiedNoForm = await seedUser();
    const withProfile = await seedUser();
    await seedProfile(withProfile.id, { status: 'pending' });
    const admin = await seedUser({ role: 'admin' });
    await sql`UPDATE users SET verification_expires = NOW() - INTERVAL '1 hour' WHERE id IN (${abandoned.id}, ${verifiedNoForm.id}, ${withProfile.id}, ${admin.id})`;
    const expiring = await seedUser();
    await seedProfile(expiring.id, { status: 'approved', expiry: new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10) });
    const oldTag = uniq('oldlog');
    await sql`INSERT INTO student_error_logs (level, event, message, email, created_at) VALUES ('info','t_old','old',${oldTag},NOW() - INTERVAL '91 days'), ('info','t_new','new',${oldTag},NOW() - INTERVAL '89 days')`;

    const r = await cron(secret);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.deleted).toBeGreaterThanOrEqual(2);
    expect(body.archived).toBeGreaterThanOrEqual(1);
    expect(body.pruned).toBeGreaterThanOrEqual(1);

    const exists = async (id: number) => (await sql`SELECT 1 FROM users WHERE id = ${id}`).length === 1;
    expect(await exists(abandoned.id)).toBe(false);
    expect(await exists(verifiedNoForm.id)).toBe(false);
    expect(await exists(withProfile.id)).toBe(true);
    expect(await exists(admin.id)).toBe(true);
    expect((await sql`SELECT status FROM student_profiles WHERE user_id = ${expiring.id}`)[0].status).toBe('archived');
    const left = await sql`SELECT event FROM student_error_logs WHERE email = ${oldTag}`;
    expect(left.map(l => l.event)).toEqual(['t_new']);
    expect((await sql`SELECT 1 FROM student_error_logs WHERE event = 'account_purged' AND email = ${abandoned.email}`).length).toBe(1);
  });

  test('purged email can register again', async () => {
    const u = await seedUser({ verified: false });
    await testSql()`UPDATE users SET verification_expires = NOW() - INTERVAL '1 hour' WHERE id = ${u.id}`;
    await cron(loadTestEnv().CRON_SECRET);
    expect((await (await ctx()).post('/api/auth/signup', { data: { email: u.email, password: PASSWORD } })).status()).toBe(200);
  });
});

test('BASE_URL sanity', () => {
  expect(BASE_URL).toBe('http://localhost:3100');
});
