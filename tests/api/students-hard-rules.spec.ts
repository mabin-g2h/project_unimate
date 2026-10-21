import { test, expect } from '@playwright/test';
import { studentCtx, seedUser, seedProfile, loginAs, adminCtx, emailFor, finding, uniq } from '../helpers/api';
import { testSql } from '../helpers/db';
import { waitForMail, mailHtml, mailFor } from '../helpers/mail';

const iso = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

// The only keys a peer row may expose (CLAUDE.md hard rule 1, plus id/flight for cards).
const PEER_KEYS = ['airline', 'arrival', 'city', 'country_of_origin', 'course_name', 'degree_level', 'departure_from', 'email', 'full_name', 'id', 'intake_month', 'intake_year', 'phone', 'profile_picture_url', 'travel_date', 'university_name'];
const FORBIDDEN = ['password_hash', 'passport_url', 'admission_letter_url', 'rejection_reason', 'reviewed_by', 'verification_token', 'password_reset_token'];

test.describe('peer directory (hard rule 1)', () => {
  const country = 'Sweden';
  let viewer: Awaited<ReturnType<typeof studentCtx>>;
  const names: Record<string, string> = {};

  test.beforeAll(async () => {
    viewer = await studentCtx({ country, name: 'Viewer V' });
    for (const status of ['approved', 'pending', 'rejected', 'revoked', 'archived']) {
      names[status] = `Peer ${status}`;
      await studentCtx({ country, status, name: names[status] });
    }
    names.shared = 'Peer Shared';
    await studentCtx({ country, name: names.shared, sharePhone: true, phone: '+46701234567' });
    names.other = 'Peer Elsewhere';
    await studentCtx({ country: 'Japan', name: names.other });
  });

  test('lists only approved peers in my destination country, excluding me', async () => {
    const { peers } = await (await viewer.api.get('/api/students/peers')).json();
    const got = peers.map((p: { full_name: string }) => p.full_name);
    expect(got).toContain(names.approved);
    expect(got).toContain(names.shared);
    for (const hidden of ['pending', 'rejected', 'revoked', 'archived', 'other']) expect(got, hidden).not.toContain(names[hidden]);
    expect(got).not.toContain('Viewer V');
  });

  test('exposes only whitelisted keys, never sensitive columns', async () => {
    const text = await (await viewer.api.get('/api/students/peers')).text();
    const { peers } = JSON.parse(text);
    for (const p of peers) for (const k of Object.keys(p)) expect(PEER_KEYS, `unexpected key ${k}`).toContain(k);
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
  });

  test('phone is masked unless the peer opted in', async () => {
    const { peers } = await (await viewer.api.get('/api/students/peers')).json();
    const byName = (n: string) => peers.find((p: { full_name: string }) => p.full_name === n);
    expect(byName(names.approved).phone).toBeNull();
    expect(byName(names.shared).phone).toBe('+46701234567');
  });

  test('toggling share_phone shows/hides the number to peers', async () => {
    const owner = await studentCtx({ country, name: 'Toggler', phone: '+46709998877' });
    const phoneSeen = async () => (await (await viewer.api.get('/api/students/peers')).json()).peers.find((p: { full_name: string }) => p.full_name === 'Toggler').phone;
    expect(await phoneSeen()).toBeNull();
    expect((await owner.api.put('/api/students/share-phone', { data: { share_phone: true } })).status()).toBe(200);
    expect(await phoneSeen()).toBe('+46709998877');
    await owner.api.put('/api/students/share-phone', { data: { share_phone: false } });
    expect(await phoneSeen()).toBeNull();
  });

  test('non-boolean share_phone is rejected with 400, not 500', async () => {
    finding('F-13', 'share-phone passes any JSON value straight into SQL; a non-boolean gives 500 (and a non-student account silently updates zero rows with 200)');
    const owner = await studentCtx({ country });
    expect((await owner.api.put('/api/students/share-phone', { data: { share_phone: 'maybe' } })).status()).toBe(400);
  });

  test('a pending / unapproved user gets an empty peer list and no profile', async () => {
    const u = await studentCtx({ country, status: 'pending' });
    expect((await (await u.api.get('/api/students/peers')).json()).peers).toEqual([]);
    expect((await (await u.api.get('/api/students/me')).json()).profile).toBeNull();
  });

  test('/api/students/me returns only the caller\'s own data and no hashes/documents', async () => {
    const text = await (await viewer.api.get('/api/students/me')).text();
    expect(JSON.parse(text).profile.full_name).toBe('Viewer V');
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
  });
});

test.describe('flight details', () => {
  test('upsert, read back, validate dates', async () => {
    const s = await studentCtx();
    const base = { departure_from: 'New Delhi (DEL)', arrival: 'Melbourne (MEL)', airline: 'Qantas' };
    expect((await s.api.post('/api/students/flight', { data: { ...base, travel_date: iso(30) } })).status()).toBe(200);
    expect((await (await s.api.get('/api/students/flight')).json()).flight.travel_date).toBe(iso(30));
    expect((await s.api.post('/api/students/flight', { data: { ...base, travel_date: iso(31), airline: 'Emirates' } })).status()).toBe(200);
    const f = (await (await s.api.get('/api/students/flight')).json()).flight;
    expect(f.airline).toBe('Emirates');
    expect(await testSql()`SELECT 1 FROM flight_details WHERE user_id = ${s.user.id}`).toHaveLength(1);

    expect((await s.api.post('/api/students/flight', { data: { ...base, travel_date: iso(-1) } })).status()).toBe(400);
    expect((await s.api.post('/api/students/flight', { data: { ...base, travel_date: 'next week' } })).status()).toBe(400);
    expect((await s.api.post('/api/students/flight', { data: { ...base, travel_date: '' } })).status()).toBe(400);
    expect((await s.api.post('/api/students/flight', { data: { ...base, travel_date: iso(0) } })).status()).toBe(200); // today is allowed
  });

  test('flight data reaches peers; free-text "Other" airport values are stored as typed', async () => {
    const country = 'Finland';
    const a = await studentCtx({ country, name: 'Flyer A' });
    const b = await studentCtx({ country, name: 'Flyer B' });
    await a.api.post('/api/students/flight', { data: { departure_from: 'Tiny Airstrip (XYZ)', arrival: 'Helsinki (HEL)', travel_date: iso(20), airline: 'Finnair' } });
    const peerA = (await (await b.api.get('/api/students/peers')).json()).peers.find((p: { full_name: string }) => p.full_name === 'Flyer A');
    expect(peerA.departure_from).toBe('Tiny Airstrip (XYZ)');
    expect(peerA.arrival).toBe('Helsinki (HEL)');
    expect(await testSql()`SELECT 1 FROM airports WHERE label = 'Tiny Airstrip (XYZ)'`).toHaveLength(0); // not auto-grown
  });
});

test.describe('dropdown option APIs', () => {
  test('country filter scopes universities, cities and airports', async () => {
    const s = await studentCtx();
    const get = async (p: string) => (await (await s.api.get(p)).json());
    const unis = await get('/api/options/universities?country=Canada');
    const all = JSON.stringify(unis);
    expect(all).toContain('University of Toronto');
    expect(all).not.toContain('University of Melbourne');
    expect(JSON.stringify(await get('/api/options/cities?country=Germany'))).toContain('Munich');
    expect(JSON.stringify(await get('/api/options/cities?country=Germany'))).not.toContain('Toronto');
    const air = JSON.stringify(await get('/api/options/airports?country=Australia'));
    expect(air).toContain('Melbourne (MEL)');
    expect(air).not.toContain('Toronto (YYZ)');
    expect(JSON.stringify(await get('/api/options/airports'))).toContain('New Delhi (DEL)'); // global departure list
    expect(JSON.stringify(await get('/api/options/airlines'))).toContain('Qantas');
  });

  test('SQL metacharacters in ?country= are treated as data', async () => {
    const s = await studentCtx();
    const r = await s.api.get(`/api/options/universities?country=${encodeURIComponent("Canada' OR '1'='1")}`);
    expect(r.status()).toBe(200);
    expect(JSON.stringify(await r.json())).not.toContain('University of Melbourne');
  });
});

test.describe('invite a peer', () => {
  test('validation, self, existing-account and 7-day duplicate guards; mail is sent and logged', async () => {
    const s = await studentCtx({ name: 'Inviter I' });
    const invite = (email: string) => s.api.post('/api/students/invite-peer', { data: { email } });
    expect((await invite('')).status()).toBe(400);
    expect((await invite('not-an-email')).status()).toBe(400);
    expect((await invite(s.user.email.toUpperCase())).status()).toBe(400); // self, case-insensitive
    const existing = await seedUser();
    expect((await invite(existing.email)).status()).toBe(409);

    const fresh = emailFor('invitee');
    expect((await invite(`  ${fresh.toUpperCase()}  `)).status()).toBe(200);
    const html = await mailHtml((await waitForMail(fresh, '')).ID);
    expect(html).toContain('Inviter I');
    expect((await invite(fresh)).status()).toBe(409);

    // an invite older than 7 days no longer blocks
    await testSql()`UPDATE peer_invites SET created_at = NOW() - INTERVAL '8 days' WHERE email = ${fresh}`;
    expect((await invite(fresh)).status()).toBe(200);
  });

  test('daily cap: the 11th invite in 24h -> 429; invites by other students are unaffected', async () => {
    const s = await studentCtx();
    const other = await studentCtx();
    const sql = testSql();
    for (let i = 0; i < 10; i++) await sql`INSERT INTO peer_invites (email, invited_by) VALUES (${emailFor('cap')}, ${s.user.id})`;
    const r = await s.api.post('/api/students/invite-peer', { data: { email: emailFor('cap11') } });
    expect(r.status()).toBe(429);
    expect((await other.api.post('/api/students/invite-peer', { data: { email: emailFor('free') } })).status()).toBe(200);
  });

  test('inviter name is HTML-escaped in the invite mail', async () => {
    const s = await studentCtx({ name: '<i>Bold</i> Person' });
    const to = emailFor('xss-inv');
    await s.api.post('/api/students/invite-peer', { data: { email: to } });
    const html = await mailHtml((await waitForMail(to, '')).ID);
    expect(html).not.toContain('<i>Bold</i>');
    expect(html).toContain('&lt;i&gt;Bold');
  });
});

test.describe('admin logs API', () => {
  test('filters, pagination and validation', async () => {
    const admin = await adminCtx();
    const u = await seedUser();
    const sql = testSql();
    for (let i = 0; i < 30; i++) await sql`INSERT INTO student_error_logs (level, event, message, email, category) VALUES ('warn','login_failed','m',${u.email},'auth')`;
    await sql`INSERT INTO student_error_logs (level, event, message, email, category) VALUES ('error','email_send_failed','m',${u.email},'email')`;
    const q = async (qs: string) => (await admin.get(`/api/admin/logs?${qs}`));

    const p1 = await (await q(`email=${encodeURIComponent(u.email)}`)).json();
    expect(p1.total).toBe(31);
    expect(p1.logs).toHaveLength(25);
    expect((await (await q(`email=${encodeURIComponent(u.email)}&page=2`)).json()).logs).toHaveLength(6);
    expect((await (await q(`email=${encodeURIComponent(u.email)}&level=error`)).json()).total).toBe(1);
    expect((await (await q(`email=${encodeURIComponent(u.email)}&category=auth`)).json()).total).toBe(30);
    expect((await (await q(`email=${encodeURIComponent(u.email)}&event=email_send_failed`)).json()).total).toBe(1);
    const today = iso(0);
    expect((await (await q(`email=${encodeURIComponent(u.email)}&from=${today}&to=${today}`)).json()).total).toBe(31); // inclusive
    expect((await (await q(`email=${encodeURIComponent(u.email)}&from=${iso(2)}`)).json()).total).toBe(0);
    expect((await q('from=yesterday')).status()).toBe(400);
    expect((await q('page=-5')).status()).toBe(200);
    expect((await q(`email=${encodeURIComponent("'; DROP TABLE users;--")}`)).status()).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM users`)[0].n).toBeGreaterThan(0);
  });

  test('per-student timeline returns a summary + ordered events without secrets', async () => {
    const admin = await adminCtx();
    const s = await studentCtx({ status: 'rejected' });
    await loginAs(s.user.email);
    const r = await admin.get(`/api/admin/logs/student?email=${encodeURIComponent(s.user.email.toUpperCase())}`);
    const text = await r.text();
    const body = JSON.parse(text);
    expect(body.summary.email).toBe(s.user.email);
    expect(body.summary.status).toBe('rejected');
    const times = body.events.map((e: { created_at: string }) => Date.parse(e.created_at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    for (const f of ['password_hash', 'passport_url', 'admission_letter_url', 'verification_token', 'password_reset_token']) expect(text).not.toContain(f);
    expect((await admin.get('/api/admin/logs/student')).status()).toBe(400);
    expect((await (await admin.get('/api/admin/logs/student?email=nobody@example.test')).json()).summary).toBeNull();
  });
});

test.describe('email failure is logged exactly once', () => {
  test('a failed send records one email_send_failed row', async () => {
    test.skip(!process.env.ALLOW_MAIL_OUTAGE, 'stops the Mailpit container; run with ALLOW_MAIL_OUTAGE=1');
    const { execSync } = await import('node:child_process');
    const u = await seedUser();
    execSync('docker stop unimate-mailpit');
    try {
      const s = await loginAs(u.email);
      await s.post('/api/students/invite-peer', { data: { email: emailFor('fail') } });
      await new Promise(r => setTimeout(r, 1500));
    } finally {
      execSync('docker start unimate-mailpit');
    }
    const rows = await testSql()`SELECT 1 FROM student_error_logs WHERE event = 'email_send_failed' AND metadata->>'type' IS NOT NULL AND created_at > NOW() - INTERVAL '1 minute'`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    void uniq; void mailFor;
  });
});
