import { test, expect } from '@playwright/test';
import { clearMail, waitForMail, mailHtml, firstLink } from '../helpers/mail';

test('signup sends a verification mail to Mailpit with a test-server link', async ({ request }) => {
  await clearMail();
  const email = `smoke-${Date.now()}@example.test`;
  const res = await request.post('/api/auth/signup', { data: { email, password: 'SmokePass123!' } });
  expect(res.status()).toBe(200);
  const mail = await waitForMail(email, '');
  const link = firstLink(await mailHtml(mail.ID), /http:\/\/localhost:3100\/api\/auth\/verify-email\?token=[a-f0-9]+/);
  expect(link).toContain('localhost:3100');
});
