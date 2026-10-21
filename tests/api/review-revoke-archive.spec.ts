import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { adminCtx, newUnregisteredStudent, registerForm, seedUser, seedProfile, studentCtx, loginAs, finding, uniq } from '../helpers/api';
import { testSql } from '../helpers/db';
import { waitForMail, mailHtml, mailFor } from '../helpers/mail';
import { ROOT } from '../helpers/env';

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const review = async (profileId: number, body: unknown) => (await adminCtx()).post(`/api/admin/students/${profileId}/review`, { data: body as never });
const revoke = async (profileId: number, body: unknown) => (await adminCtx()).post(`/api/admin/students/${profileId}/revoke`, { data: body as never });

async function registered(country = 'Australia', university = 'University of Melbourne') {
  const s = await newUnregisteredStudent();
  const r = await s.api.post('/api/student/register', { multipart: registerForm({ fields: { country_of_education: country, university_name: university } }) });
  expect(r.status()).toBe(200);
  const [p] = await testSql()`SELECT * FROM student_profiles WHERE user_id = ${s.user.id}`;
  return { ...s, profileId: p.id as number, profile: p };
}

test.describe('review: validation', () => {
  test('invalid action -> 400', async () => {
    expect((await review(999999, { action: 'maybe' })).status()).toBe(400);
  });
  test('reject without reason -> 400', async () => {
    const { profileId } = await registered();
    expect((await review(profileId, { action: 'reject', rejection_reason: '   ' })).status()).toBe(400);
  });
  for (const bad of [undefined, '', 'tomorrow', '2026-13-45', '01/02/2027', 20270101]) {
    test(`approve with course_start_date=${JSON.stringify(bad)} -> 400`, async () => {
      const { profileId } = await registered();
      expect((await review(profileId, { action: 'approve', course_start_date: bad })).status()).toBe(400);
    });
  }
  test('an impossible calendar date (2026-02-31) is rejected with 400, not 500', async () => {
    finding('F-11', 'isValidDateString accepts impossible dates such as 2026-02-31; Postgres then rejects the DATE and the route returns 500');
    const { profileId } = await registered();
    expect((await review(profileId, { action: 'approve', course_start_date: '2026-02-31' })).status()).toBe(400);
  });
  test('unknown profile -> 404', async () => {
    expect((await review(987654, { action: 'approve', course_start_date: daysFromNow(30) })).status()).toBe(404);
  });
});

test.describe('review: approve / reject', () => {
  test('approve sets dates, reviewer, deletes passport + admission letter, keeps photo, sends mail', async () => {
    const { user, profileId, profile } = await registered();
    const start = daysFromNow(60);
    const r = await review(profileId, { action: 'approve', course_start_date: start });
    expect(r.status()).toBe(200);
    const [p] = await testSql()`SELECT status, course_start_date::text, expiry_date::text, reviewed_by, reviewed_at FROM student_profiles WHERE id = ${profileId}`;
    expect(p.status).toBe('approved');
    expect(p.course_start_date).toBe(start);
    expect(p.expiry_date).toBe(daysFromNow(90));
    expect(p.reviewed_by).not.toBeNull();
    const onDisk = (u: string) => fs.existsSync(path.join(ROOT, 'public', u));
    expect(onDisk(profile.passport_url)).toBe(false);
    expect(onDisk(profile.admission_letter_url)).toBe(false);
    expect(onDisk(profile.profile_picture_url)).toBe(true);
    await waitForMail(user.email, 'approved');
  });

  test('document URLs are cleared from the DB once the files are deleted', async () => {
    finding('F-06', 'passport_url / admission_letter_url stay populated after the blobs are deleted (dangling links)');
    const { profileId } = await registered();
    await review(profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    const [p] = await testSql()`SELECT passport_url, admission_letter_url FROM student_profiles WHERE id = ${profileId}`;
    expect(p.passport_url).toBeNull();
    expect(p.admission_letter_url).toBeNull();
  });

  test('reject stores the reason, deletes documents and emails the reason', async () => {
    const { user, profileId, profile } = await registered();
    const r = await review(profileId, { action: 'reject', rejection_reason: 'Passport photo unreadable' });
    expect(r.status()).toBe(200);
    const [p] = await testSql()`SELECT status, rejection_reason, course_start_date, expiry_date FROM student_profiles WHERE id = ${profileId}`;
    expect(p.status).toBe('rejected');
    expect(p.rejection_reason).toBe('Passport photo unreadable');
    expect(p.expiry_date).toBeNull();
    expect(fs.existsSync(path.join(ROOT, 'public', profile.passport_url))).toBe(false);
    const html = await mailHtml((await waitForMail(user.email, '')).ID);
    expect(html).toContain('Passport photo unreadable');
    const mine = await (await loginAs(user.email)).get('/api/auth/me');
    expect((await mine.json()).user.registration_status).toBe('rejected');
  });

  test('approving a student grows the directory without duplicating case variants', async () => {
    const sql = testSql();
    const novel = `Novel Institute ${uniq('n')}`;
    const a = await registered('Canada', novel);
    await review(a.profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    const b = await registered('Canada', 'UNIVERSITY OF TORONTO');
    await review(b.profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    const added = await sql`SELECT 1 FROM universities WHERE name = ${novel} AND country = 'Canada'`;
    expect(added).toHaveLength(1);
    const dup = await sql`SELECT 1 FROM universities WHERE LOWER(name) = 'university of toronto' AND country = 'Canada'`;
    expect(dup).toHaveLength(1);
  });

  test('existing approved peers at the same university are notified of a new approval', async () => {
    const uni = `Peerville University ${uniq('p')}`;
    const peer = await seedUser();
    await seedProfile(peer.id, { status: 'approved', university: uni, country: 'Ireland' });
    const s = await registered('Ireland', uni);
    await review(s.profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    await waitForMail(peer.email, '');
  });

  test('double approve is refused (state machine)', async () => {
    finding('F-07', 'review has no status guard: an already-approved profile is re-approved, re-emailed and re-notified to peers');
    const { user, profileId } = await registered();
    expect((await review(profileId, { action: 'approve', course_start_date: daysFromNow(30) })).status()).toBe(200);
    const second = await review(profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    expect(second.status()).toBeGreaterThanOrEqual(400);
    expect(await mailFor(user.email)).toHaveLength(2); // registration ack + one approval
  });

  test('review cannot silently lift a revoke', async () => {
    finding('F-08', 'approving a revoked profile through /review flips it to approved and leaves a stale revoke_reason');
    const { profileId } = await registered();
    await review(profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    await revoke(profileId, { action: 'revoke', reason: 'policy' });
    const r = await review(profileId, { action: 'approve', course_start_date: daysFromNow(30) });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('revoke / unrevoke', () => {
  test('revoke requires a reason; pending cannot be revoked; unrevoke needs revoked', async () => {
    const { profileId } = await registered();
    expect((await revoke(profileId, { action: 'revoke', reason: '' })).status()).toBe(400);
    expect((await revoke(profileId, { action: 'revoke', reason: 'x' })).status()).toBe(400); // still pending
    expect((await revoke(profileId, { action: 'unrevoke' })).status()).toBe(400);
    expect((await revoke(profileId, { action: 'nope' })).status()).toBe(400);
  });

  test('full cycle: hidden from peers + data while revoked, restored on unrevoke, mails carry the reason', async () => {
    const country = `Germany`;
    const uni = `Cycle University ${uniq('c')}`;
    const viewer = await studentCtx({ country, university: uni, city: 'Munich' });
    const target = await studentCtx({ country, university: uni, city: 'Munich', name: 'Target Person' });
    const seen = async () => (await (await viewer.api.get('/api/students/peers')).json()).peers.map((p: { full_name: string }) => p.full_name);
    expect(await seen()).toContain('Target Person');

    const r = await revoke(target.profileId, { action: 'revoke', reason: 'Fake documents <b>x</b>' });
    expect(r.status()).toBe(200);
    expect((await r.json()).newStatus).toBe('revoked');
    expect(await seen()).not.toContain('Target Person');
    expect((await (await target.api.get('/api/students/me')).json()).profile).toBeNull();
    const me = (await (await target.api.get('/api/auth/me')).json()).user;
    expect(me.registration_status).toBe('revoked');
    const html = await mailHtml((await waitForMail(target.user.email, '')).ID);
    expect(html).toContain('Fake documents');
    expect(html).not.toContain('<b>x</b>'); // reason is HTML-escaped

    expect((await revoke(target.profileId, { action: 'revoke', reason: 'again' })).status()).toBe(400);
    expect((await revoke(target.profileId, { action: 'unrevoke' })).status()).toBe(200);
    const [p] = await testSql()`SELECT status, revoke_reason FROM student_profiles WHERE id = ${target.profileId}`;
    expect(p.status).toBe('approved');
    expect(p.revoke_reason).toBeNull();
    expect(await seen()).toContain('Target Person');
  });

  test('reason is truncated to 500 characters', async () => {
    const t = await studentCtx();
    await revoke(t.profileId, { action: 'revoke', reason: 'r'.repeat(900) });
    const [p] = await testSql()`SELECT revoke_reason FROM student_profiles WHERE id = ${t.profileId}`;
    expect(p.revoke_reason).toHaveLength(500);
  });

  test('a revoked student can still log in and sees status via /api/auth/me', async () => {
    const t = await studentCtx();
    await revoke(t.profileId, { action: 'revoke', reason: 'x1' });
    const again = await loginAs(t.user.email);
    expect((await (await again.get('/api/auth/me')).json()).user.registration_status).toBe('revoked');
  });

  test('revoked / archived / pending users are blocked from write endpoints', async () => {
    finding('F-09', '/api/students/flight, share-phone and invite-peer only check "has a session" - revoked, pending and archived users can still write and send invites');
    const t = await studentCtx();
    await revoke(t.profileId, { action: 'revoke', reason: 'abuse' });
    const r = await t.api.post('/api/students/invite-peer', { data: { email: `${uniq('inv')}@example.test` } });
    expect([401, 403]).toContain(r.status());
  });
});

test.describe('admin profile edit (PATCH)', () => {
  test('rejects invalid enums', async () => {
    const t = await studentCtx();
    const admin = await adminCtx();
    for (const body of [{ degree_level: 'Wizard' }, { intake_month: 'Smarch' }, { gender: 'Other' }, { intake_year: '1999' }, { intake_year: 'abc' }, { course_start_date: 'soon' }]) {
      expect((await admin.patch(`/api/admin/students/${t.profileId}/profile`, { data: body })).status(), JSON.stringify(body)).toBe(400);
    }
  });

  test('changing course_start_date re-snapshots expiry_date', async () => {
    const t = await studentCtx({ courseStart: daysFromNow(10), expiry: daysFromNow(40) });
    const admin = await adminCtx();
    const full = { full_name: 'Keep Me', phone: '+919876543210', country_of_origin: 'India', country_of_education: 'Australia', university_name: 'University of Melbourne', degree_level: "Master's Degree", course_name: 'CS', intake_month: 'July', intake_year: '2027', city: 'Melbourne', gender: 'Male' };
    const r = await admin.patch(`/api/admin/students/${t.profileId}/profile`, { data: { ...full, course_start_date: daysFromNow(100) } });
    expect(r.status()).toBe(200);
    const [p] = await testSql()`SELECT expiry_date::text FROM student_profiles WHERE id = ${t.profileId}`;
    expect(p.expiry_date).toBe(daysFromNow(130));
  });

  test('a partial PATCH does not wipe other fields or the expiry date', async () => {
    finding('F-10', 'PATCH writes `body.x ?? null` for every column: omitting a field NULLs it, including expiry_date (stops the archive sweep) and, via NOT-NULL-free columns, full_name');
    const t = await studentCtx({ courseStart: daysFromNow(10), expiry: daysFromNow(40), name: 'Keep Me' });
    const admin = await adminCtx();
    await admin.patch(`/api/admin/students/${t.profileId}/profile`, { data: { city: 'Sydney' } });
    const [p] = await testSql()`SELECT full_name, expiry_date::text FROM student_profiles WHERE id = ${t.profileId}`;
    expect(p.full_name).toBe('Keep Me');
    expect(p.expiry_date).toBe(daysFromNow(40));
  });
});

test.describe('archive sweep (admin button)', () => {
  test('archives only approved + expired, stamps archived_at, emails once, hides from peers', async () => {
    const sql = testSql();
    const expired = await studentCtx({ courseStart: daysFromNow(-90), expiry: daysFromNow(-60), country: 'Norway' });
    const future = await studentCtx({ courseStart: daysFromNow(10), expiry: daysFromNow(40), country: 'Norway' });
    const noExpiry = await studentCtx({ country: 'Norway' });
    const revokedExpired = await studentCtx({ status: 'revoked', expiry: daysFromNow(-5), country: 'Norway' });

    const admin = await adminCtx();
    const first = await admin.post('/api/admin/students/archive-expired');
    expect(first.status()).toBe(200);
    expect((await first.json()).archived).toBeGreaterThanOrEqual(1);
    const status = async (id: number) => (await sql`SELECT status, archived_at FROM student_profiles WHERE id = ${id}`)[0];
    expect((await status(expired.profileId)).status).toBe('archived');
    expect((await status(expired.profileId)).archived_at).not.toBeNull();
    expect((await status(future.profileId)).status).toBe('approved');
    expect((await status(noExpiry.profileId)).status).toBe('approved');
    expect((await status(revokedExpired.profileId)).status).toBe('revoked');

    await waitForMail(expired.user.email, '');
    const second = await admin.post('/api/admin/students/archive-expired');
    expect((await second.json()).archived).toBe(0); // idempotent
    expect(await mailFor(expired.user.email)).toHaveLength(1);

    expect((await (await expired.api.get('/api/students/me')).json()).profile).toBeNull();
    expect((await (await expired.api.get('/api/auth/me')).json()).user.registration_status).toBe('archived');
    const peers = (await (await future.api.get('/api/students/peers')).json()).peers.map((p: { id: number }) => p.id);
    expect(peers).not.toContain(expired.profileId);
  });
});
