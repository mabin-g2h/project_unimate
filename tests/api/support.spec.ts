import { test, expect } from '@playwright/test';
import { studentCtx, uniq } from '../helpers/api';
import { testSql } from '../helpers/db';
import { waitForMail, mailHtml } from '../helpers/mail';
import { loadTestEnv } from '../helpers/env';

const SUPPORT = () => loadTestEnv().GMAIL_USER as string; // support inbox = GMAIL_USER
const post = (s: Awaited<ReturnType<typeof studentCtx>>, message: unknown) =>
  s.api.post('/api/students/support', { data: { message } });

test.describe('help / support request', () => {
  test('non-approved student -> 404 (anonymous is redirected by middleware; see authz-matrix)', async () => {
    const pending = await studentCtx({ status: 'pending' });
    expect((await post(pending, 'hi')).status()).toBe(404);
  });

  test('validation: empty, whitespace, non-string and over-length -> 400', async () => {
    const s = await studentCtx();
    for (const m of ['', '   \n ', 42, 'x'.repeat(2001)]) expect((await post(s, m)).status()).toBe(400);
  });

  test('sends to the support inbox with student details + Reply-To; message is escaped, never logged', async () => {
    const name = `Helper ${uniq()}`;
    const s = await studentCtx({ name, university: 'University of Melbourne' });
    const secret = `printer on fire ${uniq()} <b>bold</b>\nsecond line`;
    const r = await post(s, `  ${secret}  `);
    expect(r.status()).toBe(200);

    const mail = await waitForMail(SUPPORT(), name);
    expect(mail.Subject).toBe(`Help request from ${name}`);
    const html = await mailHtml(mail.ID);
    expect(html).toContain(s.user.email);
    expect(html).toContain('University of Melbourne');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('<br>second line');
    const detail = await (await fetch(`${loadTestEnv().MAILPIT_API ?? 'http://127.0.0.1:8025'}/api/v1/message/${mail.ID}`)).json() as { ReplyTo: { Address: string }[] };
    expect(detail.ReplyTo[0].Address).toBe(s.user.email);

    const rows = await testSql()`SELECT event, metadata::text AS md FROM student_error_logs WHERE email = ${s.user.email} AND event LIKE 'support_request%'`;
    expect(rows.map(x => x.event)).toContain('support_request_sent');
    expect(JSON.stringify(rows)).not.toContain('printer on fire');
  });

  test('rate limit: 6th request within the hour -> 429; other students unaffected', async () => {
    const s = await studentCtx();
    const other = await studentCtx();
    for (let i = 0; i < 5; i++) expect((await post(s, `msg ${i}`)).status()).toBe(200);
    const r = await post(s, 'one too many');
    expect(r.status()).toBe(429);
    expect(r.headers()['retry-after']).toBeTruthy();
    expect((await post(other, 'still fine')).status()).toBe(200);
  });
});
