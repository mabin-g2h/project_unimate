import { test, expect } from '@playwright/test';
import { ctx, seedUser, seedProfile, uniq } from '../helpers/api';
import { testSql } from '../helpers/db';
import { clearMail, mailFor, mailHtml, waitForMail } from '../helpers/mail';
import { loadTestEnv } from '../helpers/env';

const cron = (secret?: string) => ctx().then(c => c.get('/api/auth/pending-reminder', { headers: secret === undefined ? {} : { authorization: `Bearer ${secret}` } }));
// Mailpit's `to:` search is a substring match (admin@x also finds boot-admin@x), so keep exact recipients only.
const digestsTo = async (addr: string) => {
  await waitForMail(addr, 'awaiting review');
  const exact = (await mailFor(addr)).filter(m => m.To.some(t => t.Address.toLowerCase() === addr.toLowerCase()));
  return Promise.all(exact.map(async m => ({ subject: m.Subject, html: await mailHtml(m.ID) })));
};
const ADMIN_EMAILS = () => (loadTestEnv().ADMIN_EMAIL ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

test.describe('cron pending-application reminder', () => {
  test('rejects missing / wrong secret', async () => {
    expect((await cron()).status()).toBe(401);
    expect((await cron('wrong-secret')).status()).toBe(401);
  });

  test('nothing pending -> 200, no email, no log row', async () => {
    const sql = testSql();
    await sql`UPDATE student_profiles SET status = 'rejected' WHERE status = 'pending'`;
    await clearMail();
    const before = (await sql`SELECT COUNT(*)::int AS n FROM student_error_logs WHERE event = 'pending_reminder_sent'`)[0].n as number;

    const r = await cron(loadTestEnv().CRON_SECRET);
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ pending: 0, sent: 0, failed: 0 });
    for (const to of ADMIN_EMAILS()) expect(await mailFor(to)).toHaveLength(0);
    expect((await sql`SELECT COUNT(*)::int AS n FROM student_error_logs WHERE event = 'pending_reminder_sent'`)[0].n).toBe(before);
  });

  test('pending present -> one digest per admin (ADMIN_EMAIL + DB admins, no dupes) listing only pending students, no contact data', async () => {
    const sql = testSql();
    await sql`UPDATE student_profiles SET status = 'rejected' WHERE status = 'pending'`;
    await clearMail();

    const tag = uniq('rem');
    const p1 = await seedUser(); await seedProfile(p1.id, { status: 'pending', name: `Old ${tag} <i>x</i>`, university: 'University of Leeds', country: 'United Kingdom', phone: '+919811122233' });
    await sql`UPDATE student_profiles SET submitted_at = NOW() - INTERVAL '53 hours' WHERE user_id = ${p1.id}`;
    const p2 = await seedUser(); await seedProfile(p2.id, { status: 'pending', name: `New ${tag}` });
    const ok = await seedUser(); await seedProfile(ok.id, { status: 'approved', name: `Approved ${tag}` });
    const extraAdmin = await seedUser({ role: 'admin' });

    const r = await cron(loadTestEnv().CRON_SECRET);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.pending).toBe(2);
    expect(body.failed).toBe(0);

    const recipients = [...new Set([...ADMIN_EMAILS(), ...(await sql`SELECT email FROM users WHERE role = 'admin'`).map(a => String(a.email).toLowerCase())])];
    expect(body.sent).toBe(recipients.length);
    expect(recipients).toContain(extraAdmin.email);

    for (const to of [extraAdmin.email, ADMIN_EMAILS()[0]]) {
      const mails = await digestsTo(to);
      expect(mails).toHaveLength(1); // a single digest, not one per student, and no duplicate to the same address
      const { subject, html } = mails[0];
      expect(subject).toBe('2 applications awaiting review — UniMate');
      expect(html).toContain(`Old ${tag} &lt;i&gt;x&lt;/i&gt;`);
      expect(html).toContain('2 days 5 hours');
      expect(html).toContain(`New ${tag}`);
      expect(html).not.toContain(`Approved ${tag}`);
      expect(html.indexOf(`Old ${tag}`)).toBeLessThan(html.indexOf(`New ${tag}`)); // oldest first
      expect(html).not.toContain('+919811122233');
      expect(html).not.toContain(p1.email);
      expect(html).not.toContain('__test_uploads');
    }

    const log = await sql`SELECT level, metadata::text AS md FROM student_error_logs WHERE event = 'pending_reminder_sent' ORDER BY created_at DESC LIMIT 1`;
    expect(log[0].level).toBe('info');
    expect(log[0].md).not.toContain(tag);
  });

  test('approving every pending student stops the reminders', async () => {
    const sql = testSql();
    await sql`UPDATE student_profiles SET status = 'rejected' WHERE status = 'pending'`;
    const u = await seedUser(); await seedProfile(u.id, { status: 'pending' });
    await sql`UPDATE student_profiles SET status = 'approved' WHERE user_id = ${u.id}`;
    await clearMail();
    const r = await cron(loadTestEnv().CRON_SECRET);
    expect((await r.json()).pending).toBe(0);
    for (const to of ADMIN_EMAILS()) expect(await mailFor(to)).toHaveLength(0);
  });
});
