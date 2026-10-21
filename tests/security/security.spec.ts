import { test, expect } from '@playwright/test';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { ctx, loginAs, adminCtx, seedUser, seedProfile, studentCtx, newUnregisteredStudent, registerForm, forgeToken, withToken, emailFor, finding, PASSWORD } from '../helpers/api';
import { testSql } from '../helpers/db';
import { htmlsFor, mailFor, waitForMail, mailHtml } from '../helpers/mail';
import { ROOT, BASE_URL } from '../helpers/env';

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const redirectsToLogin = (r: { status(): number; headers(): Record<string, string> }) => r.status() === 307 && (r.headers()['location'] ?? '').includes('/login');

test.describe('JWT / session', () => {
  const claims = { userId: 1, email: 'admin@unimate.test', role: 'admin', emailVerified: true };

  test('token signed with another secret is rejected', async () => {
    const api = await withToken(await forgeToken(claims, { secret: 'attacker-secret-attacker-secret-1234' }));
    expect(redirectsToLogin(await api.get('/api/admin/students', { maxRedirects: 0 }))).toBe(true);
  });

  test('alg:none unsigned token is rejected', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    expect(redirectsToLogin(await (await withToken(token)).get('/api/admin/students', { maxRedirects: 0 }))).toBe(true);
  });

  test('expired token is rejected', async () => {
    const api = await withToken(await forgeToken(claims, { exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(redirectsToLogin(await api.get('/api/students/me', { maxRedirects: 0 }))).toBe(true);
  });

  test('payload tampering (role escalation) invalidates the signature', async () => {
    const student = await seedUser();
    const real = (await (await loginAs(student.email)).storageState()).cookies.find(c => c.name === 'auth-token')!.value;
    const [h, , s] = real.split('.');
    const forged = Buffer.from(JSON.stringify({ userId: student.id, email: student.email, role: 'admin', emailVerified: true, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const r = await (await withToken(`${h}.${forged}.${s}`)).get('/api/admin/students', { maxRedirects: 0 });
    expect(redirectsToLogin(r)).toBe(true);
  });

  test('garbage and empty cookies are rejected', async () => {
    for (const t of ['garbage', 'a.b.c', '']) {
      expect(redirectsToLogin(await (await withToken(t)).get('/api/students/me', { maxRedirects: 0 }))).toBe(true);
    }
  });

  test('token_version: a legacy token (no tv) works, a stale or future tv is rejected, and the DB role wins over the claim', async () => {
    const u = await seedUser();
    const claimsFor = (o: object = {}) => ({ userId: u.id, email: u.email, role: 'student', emailVerified: true, ...o });
    const status = async (t: string) => (await (await withToken(t)).get('/api/auth/me')).status();
    expect(await status(await forgeToken(claimsFor()))).toBe(200);            // issued before the column existed
    expect(await status(await forgeToken(claimsFor({ tv: 0 })))).toBe(200);
    expect(await status(await forgeToken(claimsFor({ tv: 1 })))).toBe(401);   // not the user's current version
    await testSql()`UPDATE users SET token_version = 2 WHERE id = ${u.id}`;
    expect(await status(await forgeToken(claimsFor()))).toBe(401);            // legacy token dies once bumped
    expect(await status(await forgeToken(claimsFor({ tv: 2 })))).toBe(200);
    // a token that CLAIMS admin does not grant it: the DB row says student
    const adminClaim = await withToken(await forgeToken(claimsFor({ tv: 2, role: 'admin' })));
    expect([401, 403]).toContain((await adminClaim.get('/api/admin/students')).status());
  });

  test('a demoted admin\'s existing token stops working', async () => {
    const target = await seedUser({ role: 'admin' });
    const old = await loginAs(target.email);
    await (await adminCtx()).delete(`/api/admin/admins/${target.id}`);
    expect([401, 403]).toContain((await old.get('/api/admin/students')).status());
  });

  test('a deleted account\'s token stops working on admin routes', async () => {
    const target = await seedUser({ role: 'admin' });
    const old = await loginAs(target.email);
    await testSql()`DELETE FROM users WHERE id = ${target.id}`;
    expect([401, 403]).toContain((await old.get('/api/admin/students')).status());
  });

  test('a password reset invalidates sessions issued before it', async () => {
    const u = await seedUser();
    const old = await loginAs(u.email);
    const c = await ctx();
    await c.post('/api/auth/forgot-password', { data: { email: u.email } });
    const [row] = await testSql()`SELECT password_reset_token t FROM users WHERE id = ${u.id}`;
    await c.post('/api/auth/reset-password', { data: { token: row.t, password: 'BrandNew123!' } });
    expect((await old.get('/api/auth/me')).status()).toBe(401);
  });

  test('a logged-out token cannot be replayed', async () => {
    finding('F-17', 'logout only clears the browser cookie; the JWT stays valid server-side, so a stolen token survives sign-out');
    const u = await seedUser();
    const api = await loginAs(u.email);
    const token = (await api.storageState()).cookies.find(c => c.name === 'auth-token')!.value;
    await api.post('/api/auth/logout');
    expect((await (await withToken(token)).get('/api/auth/me')).status()).toBe(401);
  });

  test('session cookie is HttpOnly + SameSite=Lax (Secure is production-only: see unit tests)', async () => {
    const u = await seedUser();
    const r = await (await ctx()).post('/api/auth/login', { data: { email: u.email, password: PASSWORD } });
    const cookie = r.headers()['set-cookie'];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
  });
});

test.describe('CSRF / origin handling', () => {
  test('state-changing endpoints reject a foreign Origin', async () => {
    finding('F-18', 'no Origin/Referer check or CSRF token; JSON bodies are parsed regardless of Content-Type, so only SameSite=Lax stands between a cross-site form post and the API');
    const { api } = await studentCtx();
    const r = await api.put('/api/students/share-phone', { headers: { origin: 'https://evil.example' }, data: { share_phone: true } });
    expect([400, 403]).toContain(r.status());
  });

  test('JSON endpoints accept a text/plain body (CORS-simple request)', async () => {
    finding('F-18', 'no Origin/Referer check or CSRF token; JSON bodies are parsed regardless of Content-Type, so only SameSite=Lax stands between a cross-site form post and the API');
    const { api } = await studentCtx();
    const r = await api.fetch('/api/students/share-phone', { method: 'PUT', headers: { 'content-type': 'text/plain' }, data: JSON.stringify({ share_phone: true }) });
    expect(r.status()).toBe(415);
  });
});

test.describe('brute force + abuse (no rate limiting exists)', () => {
  test('repeated wrong passwords are throttled (429 + Retry-After) before bcrypt is even run', async () => {
    const u = await seedUser();
    const c = await ctx();
    const ip = { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` };
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await c.post('/api/auth/login', { headers: ip, data: { email: u.email, password: `Wrong-${i}-pass` } })).status());
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429, 429]);
    const blocked = await c.post('/api/auth/login', { headers: ip, data: { email: u.email, password: PASSWORD } });
    expect(blocked.status()).toBe(429); // even the right password waits out the window
    expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatch(/too many/i);
  });

  test('a successful login clears the failure counter; other accounts are unaffected', async () => {
    const u = await seedUser();
    const other = await seedUser();
    const c = await ctx();
    const ip = { 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` };
    for (let i = 0; i < 4; i++) expect((await c.post('/api/auth/login', { headers: ip, data: { email: u.email, password: 'nope-nope-1' } })).status()).toBe(401);
    expect((await c.post('/api/auth/login', { headers: ip, data: { email: u.email, password: PASSWORD } })).status()).toBe(200);
    for (let i = 0; i < 4; i++) expect((await c.post('/api/auth/login', { headers: ip, data: { email: u.email, password: 'nope-nope-1' } })).status()).toBe(401);
    expect((await c.post('/api/auth/login', { headers: ip, data: { email: other.email, password: PASSWORD } })).status()).toBe(200);
  });

  test('signup is throttled per email (3/hour) and reset-password per IP', async () => {
    const c = await ctx();
    const email = emailFor('throttle');
    const ip = { 'x-forwarded-for': '10.7.1.1' };
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await c.post('/api/auth/signup', { headers: ip, data: { email, password: PASSWORD } })).status());
    expect(codes).toEqual([200, 409, 409, 429, 429]);
  });

  test('forgot-password cannot be used to mail-bomb a verified address (3/hour, uniform 200)', async () => {
    const u = await seedUser();
    const c = await ctx();
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await c.post('/api/auth/forgot-password', { data: { email: u.email } })).status());
    await waitForMail(u.email, '');
    await new Promise(r => setTimeout(r, 1500));
    expect((await mailFor(u.email)).length).toBe(3);
    expect(new Set(statuses)).toEqual(new Set([200])); // limited requests look identical to normal ones
  });

  test('invite-peer is capped per student (control: this limit does exist)', async () => {
    const s = await studentCtx();
    const sql = testSql();
    for (let i = 0; i < 10; i++) await sql`INSERT INTO peer_invites (email, invited_by) VALUES (${emailFor('c')}, ${s.user.id})`;
    expect((await s.api.post('/api/students/invite-peer', { data: { email: emailFor('over') } })).status()).toBe(429);
  });
});

test.describe('injection', () => {
  test('SQL metacharacters in registration text fields are stored verbatim and harmless', async () => {
    const { user, api } = await newUnregisteredStudent();
    const evil = "Robert'); DROP TABLE users;--";
    const r = await api.post('/api/student/register', { multipart: registerForm({ fields: { full_name: evil, city: "x' OR '1'='1", course_name: '"; DELETE FROM student_profiles; --' } }) });
    expect(r.status()).toBe(200);
    const [p] = await testSql()`SELECT full_name, city FROM student_profiles WHERE user_id = ${user.id}`;
    expect(p.full_name).toBe(evil);
    expect((await testSql()`SELECT count(*)::int n FROM users`)[0].n).toBeGreaterThan(0);
  });

  test('SQL metacharacters in login / forgot / option filters do not break out', async () => {
    const c = await ctx();
    const r = await c.post('/api/auth/login', { data: { email: "' OR 1=1 --", password: 'x' } });
    expect(r.status()).toBe(401);
    expect((await c.post('/api/auth/forgot-password', { data: { email: "a'@b.test" } })).status()).toBe(200);
  });

  test('CRLF in a text field cannot inject mail headers (e.g. Bcc)', async () => {
    const peer = await seedUser();
    const uni = `Crlf University ${Date.now()}`;
    await seedProfile(peer.id, { university: uni, country: 'Poland' });
    const s = await newUnregisteredStudent();
    await s.api.post('/api/student/register', { multipart: registerForm({ fields: { country_of_education: 'Poland', university_name: uni, full_name: 'Crlf Tester\r\nBcc: sneaky@example.test' } }) });
    const [p] = await testSql()`SELECT id FROM student_profiles WHERE user_id = ${s.user.id}`;
    await (await adminCtx()).post(`/api/admin/students/${p.id}/review`, { data: { action: 'approve', course_start_date: daysFromNow(30) } });
    await waitForMail(s.user.email, '');
    expect(await mailFor('sneaky@example.test')).toHaveLength(0);
  });
});

test.describe('stored XSS in transactional email (names are interpolated into HTML)', () => {
  const marker = () => `m${Date.now().toString(36)}`;
  const payload = (m: string) => `<img/src=x/onerror=alert('${m}')>`; // no spaces: only the first token survives split(' ')
  const hasRawPayload = (html: string, m: string) => html.includes(`<img/src=x/onerror=alert('${m}')>`);

  test('registration acknowledgement to the student', async () => {
    finding('F-21', 'email templates interpolate name / university without escapeHtml (ack, approval, rejection, expiry, new-peer, admin alert) - HTML injection into mail sent to students and admins');
    const m = marker();
    const s = await newUnregisteredStudent();
    await s.api.post('/api/student/register', { multipart: registerForm({ fields: { full_name: payload(m) } }) });
    const mails = await htmlsFor(s.user.email);
    expect(mails.some(x => hasRawPayload(x.html, m))).toBe(false);
  });

  test('admin registration alert (full name, sent to every ADMIN_EMAIL)', async () => {
    finding('F-21', 'email templates interpolate name / university without escapeHtml (ack, approval, rejection, expiry, new-peer, admin alert) - HTML injection into mail sent to students and admins');
    const m = marker();
    const s = await newUnregisteredStudent();
    await s.api.post('/api/student/register', { multipart: registerForm({ fields: { full_name: `${payload(m)} Smith` } }) });
    await new Promise(r => setTimeout(r, 2000));
    const mails = await htmlsFor('admin@unimate.test');
    expect(mails.some(x => x.html.includes(payload(m)))).toBe(false);
  });

  test('approval + rejection emails', async () => {
    finding('F-21', 'email templates interpolate name / university without escapeHtml (ack, approval, rejection, expiry, new-peer, admin alert) - HTML injection into mail sent to students and admins');
    const admin = await adminCtx();
    const m1 = marker(), m2 = marker() + 'r';
    const a = await newUnregisteredStudent();
    const b = await newUnregisteredStudent();
    await a.api.post('/api/student/register', { multipart: registerForm({ fields: { full_name: payload(m1) } }) });
    await b.api.post('/api/student/register', { multipart: registerForm({ fields: { full_name: payload(m2) } }) });
    const pid = async (id: number) => (await testSql()`SELECT id FROM student_profiles WHERE user_id = ${id}`)[0].id;
    await admin.post(`/api/admin/students/${await pid(a.user.id)}/review`, { data: { action: 'approve', course_start_date: daysFromNow(30) } });
    await admin.post(`/api/admin/students/${await pid(b.user.id)}/review`, { data: { action: 'reject', rejection_reason: 'nope' } });
    const all = [...(await htmlsFor(a.user.email)), ...(await htmlsFor(b.user.email))];
    expect(all.some(x => hasRawPayload(x.html, m1) || hasRawPayload(x.html, m2))).toBe(false);
  });

  test('new-peer notification (name + university in body and subject)', async () => {
    finding('F-21', 'email templates interpolate name / university without escapeHtml (ack, approval, rejection, expiry, new-peer, admin alert) - HTML injection into mail sent to students and admins');
    const m = marker();
    const uni = `Uni ${payload(m)}`;
    const peer = await seedUser();
    await seedProfile(peer.id, { university: uni, country: 'Portugal' });
    const s = await newUnregisteredStudent();
    await s.api.post('/api/student/register', { multipart: registerForm({ fields: { country_of_education: 'Portugal', university_name: uni, full_name: payload(m) } }) });
    const [p] = await testSql()`SELECT id FROM student_profiles WHERE user_id = ${s.user.id}`;
    await (await adminCtx()).post(`/api/admin/students/${p.id}/review`, { data: { action: 'approve', course_start_date: daysFromNow(30) } });
    const mails = await htmlsFor(peer.email);
    expect(mails.some(x => x.html.includes(`<img/src=x/onerror=alert('${m}')>`))).toBe(false);
  });

  test('account-expired email', async () => {
    finding('F-21', 'email templates interpolate name / university without escapeHtml (ack, approval, rejection, expiry, new-peer, admin alert) - HTML injection into mail sent to students and admins');
    const m = marker();
    const t = await studentCtx({ name: payload(m), expiry: daysFromNow(-3), courseStart: daysFromNow(-40) });
    await (await adminCtx()).post('/api/admin/students/archive-expired');
    const mails = await htmlsFor(t.user.email);
    expect(mails.some(x => hasRawPayload(x.html, m))).toBe(false);
  });

  test('control: revoke + peer-invite emails do escape', async () => {
    const m = marker();
    const t = await studentCtx({ name: payload(m) });
    await (await adminCtx()).post(`/api/admin/students/${t.profileId}/revoke`, { data: { action: 'revoke', reason: payload(m) } });
    const mails = await htmlsFor(t.user.email);
    expect(mails.length).toBeGreaterThan(0);
    expect(mails.some(x => hasRawPayload(x.html, m))).toBe(false);
  });
});

test.describe('uploads', () => {
  test('a hostile filename never reaches the filesystem path', async () => {
    const { user, api } = await newUnregisteredStudent();
    const bytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100)]);
    const r = await api.post('/api/student/register', { multipart: registerForm({ files: { passport: { name: '../../../../tmp/pwned.pdf', mimeType: 'application/pdf', buffer: bytes } } }) });
    expect(r.status()).toBe(200);
    const [p] = await testSql()`SELECT passport_url FROM student_profiles WHERE user_id = ${user.id}`;
    expect(p.passport_url).toMatch(/^\/__test_uploads\/\d+_passport_\d+\.pdf$/);
    expect(fs.existsSync('/tmp/pwned.pdf')).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'public', p.passport_url))).toBe(true);
  });

  test('PDF-magic polyglot with embedded script is accepted (content beyond the header is not inspected)', async () => {
    finding('F-22', 'uploads are validated by the first 4-8 magic bytes only; a polyglot (valid %PDF header + HTML/JS body) is stored and served from the app origin in test mode / public Blob URL in production');
    const { api } = await newUnregisteredStudent();
    const poly = Buffer.from('%PDF-1.4\n<script>alert(1)</script>\n<html><body onload=alert(1)>');
    const r = await api.post('/api/student/register', { multipart: registerForm({ files: { passport: { name: 'p.pdf', mimeType: 'application/pdf', buffer: poly } } }) });
    expect(r.status()).toBe(400);
  });

  test('an oversized (30 MB) upload is refused with a client error, not a 500', async () => {
    finding('F-29', 'bodies over the 10 MB framework buffer fail inside request.formData() ("expected boundary after body") and surface as an unhandled 500 instead of a 400/413 (Vercel would return 413 earlier)');
    const { api } = await newUnregisteredStudent();
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(30 * 1024 * 1024)]);
    const r = await api.post('/api/student/register', { multipart: registerForm({ files: { passport: { name: 'p.pdf', mimeType: 'application/pdf', buffer: big } } }) });
    expect((await (await ctx()).get('/login')).status()).toBe(200); // server survives
    expect([400, 413]).toContain(r.status());
  });

  test('legitimate maximum submission (2 MB + 2 MB + 1 MB) fits under the Vercel 4.5 MB request-body limit', async () => {
    finding('F-23', 'ANALYSIS: the per-file caps allow 2+2+1 = 5 MB (+ multipart overhead) but Vercel Functions reject request bodies over 4.5 MB (HTTP 413) - not reproducible locally; verify on a preview deployment');
    const total = 2 * 1024 * 1024 + 2 * 1024 * 1024 + 1024 * 1024;
    expect(total).toBeLessThan(4.5 * 1024 * 1024);
  });
});

test.describe('enumeration + timing', () => {
  test('signup distinguishes existing from new emails (documented: 409 vs 200)', async () => {
    finding('F-24', 'signup returns 409 "already exists" - an attacker can enumerate registered emails (forgot-password and login are uniform)');
    const u = await seedUser();
    const r = await (await ctx()).post('/api/auth/signup', { data: { email: u.email, password: PASSWORD } });
    expect(r.status()).toBe(200);
  });

  test('login timing does not reveal whether an email exists', async () => {
    finding('F-25', 'login skips bcrypt for unknown emails, so wrong-password (cost 12, ~250 ms) is measurably slower than unknown-email: a timing oracle for account existence');
    const sql = testSql();
    const hash = await bcrypt.hash('RealPass123!', 12); // production cost; reused so only the request is timed
    const known = Array.from({ length: 9 }, () => emailFor('timing'));
    for (const e of known) await sql`INSERT INTO users (email, password_hash, email_verified, role) VALUES (${e}, ${hash}, true, 'student')`;
    const c = await ctx();
    const time = async (e: string) => { const t = performance.now(); await c.post('/api/auth/login', { data: { email: e, password: 'WrongPass123!' } }); return performance.now() - t; };
    const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const knownT: number[] = [], unknownT: number[] = [];
    await time(known[0]);
    for (let i = 1; i < 8; i++) { knownT.push(await time(known[i])); unknownT.push(await time(emailFor('nobody'))); }
    expect(Math.abs(median(knownT) - median(unknownT))).toBeLessThan(60);
  });

  test('control: password-reset and login errors are uniform', async () => {
    const c = await ctx();
    const a = await c.post('/api/auth/forgot-password', { data: { email: emailFor('x') } });
    const b = await c.post('/api/auth/forgot-password', { data: { email: (await seedUser()).email } });
    expect(a.status()).toBe(b.status());
    expect(await a.json()).toEqual(await b.json());
  });
});

test.describe('headers + config', () => {
  test('security headers are present on pages and API responses', async () => {
    const c = await ctx();
    for (const p of ['/login', '/api/auth/me']) {
      const h = (await c.get(p, { maxRedirects: 0 })).headers();
      expect(h['x-frame-options'], p).toBe('DENY');
      expect(h['x-content-type-options'], p).toBe('nosniff');
      expect(h['referrer-policy'], p).toBe('strict-origin-when-cross-origin');
      expect(h['permissions-policy'], p).toContain('camera=()');
    }
  });

  test('a Content-Security-Policy is set', async () => {
    finding('F-26', 'no Content-Security-Policy header (and no HSTS from the app): XSS impact is not limited by CSP');
    expect((await (await ctx()).get('/login')).headers()['content-security-policy']).toBeTruthy();
  });

  test('the public-path allowlist matches whole path segments only', async () => {
    finding('F-27', 'middleware uses startsWith: /api/authXYZ and /loginXYZ are treated as public, and any URL ending .png/.txt/.xml/... skips auth entirely (no API route is affected today)');
    const r = await (await ctx()).get('/api/authzzz', { maxRedirects: 0 });
    expect(redirectsToLogin(r)).toBe(true);
  });

  test('admin pages are not served to students', async () => {
    const { api } = await studentCtx();
    const r = await api.get('/admin', { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(new URL(r.headers()['location'], BASE_URL).pathname).toBe('/');
  });

  test('/register requires a verified-email session', async () => {
    const r = await (await ctx()).get('/register', { maxRedirects: 0 });
    expect(redirectsToLogin(r)).toBe(true);
    const unverified = await withToken(await forgeToken({ userId: 999999, email: 'x@example.test', role: 'student', emailVerified: false }));
    expect(redirectsToLogin(await unverified.get('/register', { maxRedirects: 0 }))).toBe(true);
  });

  test('error responses do not leak stack traces or SQL', async () => {
    const r = await (await ctx()).post('/api/auth/login', { data: {} });
    const t = await r.text();
    expect(t).not.toMatch(/at .*\.(ts|js):\d+|SELECT |neon|postgres/i);
  });

  test('weak passwords are accepted (policy is length-only)', async () => {
    finding('F-28', 'password policy is "at least 8 characters" - 11111111 is accepted at signup and reset');
    const r = await (await ctx()).post('/api/auth/signup', { data: { email: emailFor('weak'), password: '11111111' } });
    expect(r.status()).toBe(400);
  });

  test('BASE_URL is the isolated test server', () => {
    expect(BASE_URL).toBe('http://localhost:3100');
    void mailHtml;
  });
});
