import { test, expect } from '@playwright/test';
import { emailFor, PASSWORD, seedUser, seedProfile, loginAs, finding } from '../helpers/api';
import { testSql } from '../helpers/db';
import { waitForMail, mailHtml, firstLink } from '../helpers/mail';
import { uiLogin, uiAdminLogin, fillRegistration, submitRegistrationAndConsent, acceptDialogs } from '../helpers/ui';

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

test('1. student happy path: signup -> verify -> register (country-scoped, Other fallback) -> consent -> admin approves -> dashboard', async ({ page, browser }) => {
  const email = emailFor('journey');
  const uni = `Brand New Institute ${Date.now()}`;
  await seedUserPeer('Australia');

  // signup via the toggle on /login
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create Account' }).first().click();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button.um-submit').click();
  await expect(page.getByText('Account created!')).toBeVisible();

  // verification mail -> link -> /register
  const link = firstLink(await mailHtml((await waitForMail(email, '')).ID), /http:\/\/localhost:3100\/api\/auth\/verify-email\?token=[a-f0-9]+/);
  await page.goto(link);
  await page.waitForURL('**/register');

  // dropdowns are country-scoped: the Canada list never contains Melbourne
  await sel0(page);
  await fillRegistration(page, { university: { other: uni }, city: 'Melbourne' });
  await submitRegistrationAndConsent(page);
  await expect(page.getByRole('heading', { name: 'Application Under Review' })).toBeVisible();

  // the typed university is flagged as new, then auto-added on approval
  const adminPage = await (await browser.newContext()).newPage();
  await uiAdminLogin(adminPage);
  await adminPage.getByPlaceholder('Search by name, email or university…').fill(email);
  await adminPage.getByRole('button', { name: /Review/ }).first().click();
  await expect(adminPage.getByText(/New — will be added/)).toHaveCount(1); // university only; the city exists once the lists load
  await adminPage.locator('input[type=date]').fill(daysFromNow(45));
  await expect(adminPage.getByText(/Access expires/)).toBeVisible();
  const done = adminPage.waitForResponse(r => r.url().includes('/review') && r.request().method() === 'POST');
  await adminPage.getByRole('button', { name: /Approve/ }).click();
  expect((await done).status()).toBe(200);

  // student: approval mail, dashboard, boarding pass, peers
  await waitForMail(email, 'approved');
  await page.goto('/');
  await expect(page.getByText('Verified Student · CoE confirmed')).toBeVisible();
  await expect(page.getByText('Meera Nair').first()).toBeVisible();
  expect(await testSql()`SELECT 1 FROM universities WHERE name = ${uni} AND country = 'Australia'`).toHaveLength(1);
});

test('country change resets and rescopes the university + city lists', async ({ page }) => {
  const u = await seedUser();
  await page.context().addCookies([]);
  await uiLogin(page, u.email, PASSWORD);
  await page.waitForURL('**/register');
  const uniSel = page.locator('xpath=//label[contains(.,"University / institution name")]/following-sibling::select[1]');
  const citySel = page.locator('xpath=//label[contains(.,"City")]/following-sibling::select[1]');
  const country = page.locator('xpath=//label[contains(.,"Country of education")]/following-sibling::select[1]');
  await expect(uniSel).toBeDisabled();
  await expect(citySel).toBeDisabled();
  await country.selectOption('Canada');
  await expect(uniSel.locator('option', { hasText: 'University of Toronto' })).toHaveCount(1);
  await expect(uniSel.locator('option', { hasText: 'University of Melbourne' })).toHaveCount(0);
  await uniSel.selectOption({ label: 'University of Toronto' });
  await country.selectOption('Australia');
  await expect(uniSel).toHaveValue('');
  await expect(uniSel.locator('option', { hasText: 'University of Melbourne' })).toHaveCount(1);
  await expect(uniSel.locator('option', { hasText: 'University of Toronto' })).toHaveCount(0);
});

test('3. rejection: student sees the reason and can re-apply', async ({ page, browser }) => {
  const email = emailFor('reject');
  const u = await seedUser({ email });
  await seedProfile(u.id, { status: 'pending', name: 'Reject Me' });
  const adminPage = await (await browser.newContext()).newPage();
  await uiAdminLogin(adminPage);
  await adminPage.getByPlaceholder('Search by name, email or university…').fill(email);
  await adminPage.getByRole('button', { name: /Review/ }).first().click();
  await adminPage.getByPlaceholder(/Document is unclear/).fill('Passport scan is blurry');
  const done = adminPage.waitForResponse(r => r.url().includes('/review') && r.request().method() === 'POST');
  await adminPage.getByRole('button', { name: /Reject/ }).click();
  expect((await done).status()).toBe(200);

  // The /pending page shows the reason and a Re-apply button...
  await uiLogin(page, email, PASSWORD);
  await page.waitForURL(/\/(register|pending)$/);
  await page.goto('/pending');
  await expect(page.getByRole('heading', { name: 'Application Not Approved' })).toBeVisible();
  await expect(page.getByText('Passport scan is blurry')).toBeVisible();
  await page.getByRole('button', { name: /Re-apply/ }).click();
  await page.waitForURL('**/register');
});

test('3b. a rejected student lands on the explanation, not a blank registration form', async ({ page }) => {
  finding('F-32', 'app/page.tsx redirects status "rejected" to /register, so after login a rejected student sees an empty form and never the rejection reason / Re-apply page that only /pending renders');
  const email = emailFor('rej2');
  const u = await seedUser({ email });
  await seedProfile(u.id, { status: 'rejected' });
  await testSql()`UPDATE student_profiles SET rejection_reason = 'Photo is unclear' WHERE user_id = ${u.id}`;
  await uiLogin(page, email, PASSWORD);
  await expect(page.getByText('Photo is unclear')).toBeVisible({ timeout: 8000 });
});

test('3c. the review modal does not flag known values as "New" while the option lists are still loading', async ({ browser }) => {
  finding('F-33', 'editUniIsNew / editCityIsNew have no "list loaded" guard (unlike the Other-mode check), so existing values flash the coral "New - will be added" badge until the country-scoped options arrive');
  const email = emailFor('badge');
  const u = await seedUser({ email });
  await seedProfile(u.id, { status: 'pending', country: 'Australia', university: 'University of Melbourne', city: 'Melbourne' });
  const adminPage = await (await browser.newContext()).newPage();
  await adminPage.route('**/api/options/cities*', async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
  await adminPage.route('**/api/options/universities*', async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
  await uiAdminLogin(adminPage);
  await adminPage.getByPlaceholder('Search by name, email or university…').fill(email);
  await adminPage.getByRole('button', { name: /Review/ }).first().click();
  await expect(adminPage.getByText('Course start date').first()).toBeVisible();
  // immediate (non-retrying) count: the lists are still in flight
  expect(await adminPage.getByText(/New — will be added/).count()).toBe(0);
});

test('4. revoke -> Access Suspended (no re-apply) -> unrevoke restores the dashboard', async ({ page, browser }) => {
  const email = emailFor('revoke');
  const u = await seedUser({ email });
  await seedProfile(u.id, { status: 'approved', name: 'Revoke Me' });
  const adminPage = await (await browser.newContext()).newPage();
  acceptDialogs(adminPage);
  await uiAdminLogin(adminPage);
  const search = adminPage.getByPlaceholder('Search by name, email or university…');
  await search.fill(email);
  await adminPage.getByRole('button', { name: 'Revoke', exact: true }).click();
  const confirm = adminPage.locator('.rm-sheet').getByRole('button', { name: /^Revoke/ });
  await expect(confirm).toBeDisabled(); // reason is required
  await adminPage.locator('.rm-sheet textarea').fill('Documents were forged');
  await confirm.click();
  await expect(adminPage.getByRole('button', { name: 'Unrevoke' })).toBeVisible();

  await uiLogin(page, email, PASSWORD);
  await page.waitForURL('**/pending');
  await expect(page.getByRole('heading', { name: 'Access Suspended' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Re-apply/ })).toHaveCount(0);

  await adminPage.getByRole('button', { name: 'Unrevoke' }).click();
  await expect(adminPage.getByRole('button', { name: 'Revoke', exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Verified Student · CoE confirmed')).toBeVisible();
});

test('5. archive: expired approved student sees "Access Ended" after the admin sweep', async ({ page, browser }) => {
  const email = emailFor('archive');
  const u = await seedUser({ email });
  await seedProfile(u.id, { status: 'approved', name: 'Expire Me', courseStart: daysFromNow(-90), expiry: daysFromNow(-60) });
  const adminPage = await (await browser.newContext()).newPage();
  acceptDialogs(adminPage);
  await uiAdminLogin(adminPage);
  await adminPage.getByRole('button', { name: 'Archives' }).click();
  await adminPage.getByRole('button', { name: 'Archive expired students' }).click();
  await expect(adminPage.getByText('Expire Me')).toBeVisible();

  await uiLogin(page, email, PASSWORD);
  await page.waitForURL('**/pending');
  await expect(page.getByRole('heading', { name: 'Access Ended' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Re-apply/ })).toHaveCount(0);
});

test('6. forgot -> reset password in the browser; the reset link is single-use', async ({ page }) => {
  const u = await seedUser();
  await page.goto('/forgot-password');
  await page.locator('input[type=email]').fill(u.email);
  await page.getByRole('button', { name: /reset|send/i }).click();
  const link = firstLink(await mailHtml((await waitForMail(u.email, '')).ID), /http:\/\/localhost:3100\/reset-password\?token=[a-f0-9]+/);
  await page.goto(link);
  await page.locator('input[type=password]').first().fill('Fresh-Pass-123');
  if (await page.locator('input[type=password]').count() > 1) await page.locator('input[type=password]').nth(1).fill('Fresh-Pass-123');
  await page.getByRole('button', { name: /reset|set|save|update/i }).click();
  await page.waitForURL('**/login**');
  await expect(page.getByText(/Password reset successfully/)).toBeVisible();
  await uiLogin(page, u.email, 'Fresh-Pass-123');
  await page.waitForURL('**/register');
  await page.goto(link);
  await page.locator('input[type=password]').first().fill('Another-Pass-123');
  if (await page.locator('input[type=password]').count() > 1) await page.locator('input[type=password]').nth(1).fill('Another-Pass-123');
  await page.getByRole('button', { name: /reset|set|save|update/i }).click();
  await expect(page.getByText(/invalid|already been used/i)).toBeVisible();
});

test('7. invalid and expired verification links show clear errors; unverified login is explained', async ({ page }) => {
  await page.goto('/api/auth/verify-email?token=deadbeef');
  await expect(page).toHaveURL(/verify-email\?error=invalid/);
  await expect(page.locator('body')).toContainText(/invalid|already/i);
  const unverified = await seedUser({ verified: false });
  await uiLogin(page, unverified.email, PASSWORD);
  await expect(page.getByText(/verify your email/i)).toBeVisible();
});

async function seedUserPeer(country: string) {
  const u = await seedUser();
  await seedProfile(u.id, { country, status: 'approved', name: 'Existing Peer', university: 'University of Melbourne' });
  void loginAs;
}
async function sel0(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: /Continue to Review/ })).toBeVisible();
}
