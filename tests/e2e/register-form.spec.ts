import { test, expect, type Page } from '@playwright/test';
import { PASSWORD, seedUser, pdf, png } from '../helpers/api';
import { uiLogin, fillRegistration, sel, txt } from '../helpers/ui';
import { testSql } from '../helpers/db';

async function openRegisterForm(page: Page) {
  const u = await seedUser();
  await uiLogin(page, u.email, PASSWORD);
  await page.waitForURL('**/register');
  await expect(txt(page, 'Full name')).toBeVisible();
  return u;
}

test.describe('register form: document checks and recovery', () => {
  test('an oversized PDF is rejected inline when picked and is not attached', async ({ page }) => {
    await openRegisterForm(page);
    const input = page.locator('input[type=file]').nth(0);
    await input.setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: pdf(2 * 1024 * 1024 + 1024) });
    await expect(page.locator('p[role=alert]')).toContainText('over the 2 MB limit');
    await expect(page.getByText('Click to upload passport PDF')).toBeVisible();
  });

  test('a renamed non-PDF is rejected inline, a valid PDF clears the error', async ({ page }) => {
    await openRegisterForm(page);
    const input = page.locator('input[type=file]').nth(1);
    await input.setInputFiles({ name: 'admission.pdf', mimeType: 'application/pdf', buffer: png() });
    await expect(page.locator('p[role=alert]')).toContainText('must be a PDF');
    await input.setInputFiles({ name: 'admission.pdf', mimeType: 'application/pdf', buffer: pdf() });
    await expect(page.locator('p[role=alert]')).toHaveCount(0);
    await expect(page.getByText('admission.pdf')).toBeVisible();
  });

  test('a missing document shows the error in view, next to the field', async ({ page }) => {
    await openRegisterForm(page);
    await fillRegistration(page);
    await page.locator('input[type=file]').nth(0).setInputFiles([]);
    await page.getByRole('button', { name: /Continue to Review/ }).click();
    await expect(page.locator('p[role=alert]')).toHaveText('Please upload your passport (PDF).');
    await expect(page.getByText('Please upload your passport (PDF).').first()).toBeInViewport();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('typed details survive a reload; documents are asked for again', async ({ page }) => {
    await openRegisterForm(page);
    await fillRegistration(page, { name: 'Draft Student', course: 'Master of Draft Studies' });
    await page.reload();
    await expect(txt(page, 'Full name')).toHaveValue('Draft Student');
    await expect(txt(page, 'Course / programme name')).toHaveValue('Master of Draft Studies');
    await expect(sel(page, 'Country of education')).toHaveValue('Australia');
    await expect(sel(page, 'University / institution name')).toHaveValue('University of Melbourne');
    await expect(page.getByText('we restored your details')).toBeVisible();
    await expect(page.getByText('Click to upload passport PDF')).toBeVisible();
  });
});

test.describe('consent submit never hangs', () => {
  async function toConsent(page: Page) {
    const u = await openRegisterForm(page);
    await fillRegistration(page);
    await page.getByRole('button', { name: /Continue to Review/ }).click();
    await page.waitForURL('**/register/consent');
    for (const n of [1, 2, 3, 4]) await page.getByText(new RegExp(`^${n}\\. `)).click();
    return u;
  }

  const logged = async (email: string) =>
    (await testSql()`SELECT event, metadata FROM student_error_logs WHERE email = ${email} AND event LIKE 'client_%' ORDER BY created_at`)
      .map(r => r.event as string);

  test('a 413 plain-text response shows a clear error and re-enables the button', async ({ page }) => {
    await toConsent(page);
    await page.route('**/api/student/register', r => r.fulfill({ status: 413, contentType: 'text/plain', body: 'Request Entity Too Large' }));
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await expect(page.getByText(/files are too large/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeEnabled();
  });

  test('a dropped connection is retried, then reported and the button re-enabled', async ({ page }) => {
    const u = await toConsent(page);
    let attempts = 0;
    await page.route('**/api/student/register', r => { attempts++; return r.abort('failed'); });
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await expect(page.getByText(/Connection problem — retrying \(2 of 3\)/)).toBeVisible();
    await expect(page.getByText(/could not reach the server after 3 tries/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeEnabled();
    expect(attempts).toBe(3);
    // The last error and the give-up are sent together, so their insert order is not fixed.
    await expect.poll(async () => (await logged(u.email)).sort(), { timeout: 10_000 }).toEqual([
      'client_submit_gave_up', 'client_submit_network_error', 'client_submit_network_error',
      'client_submit_network_error', 'client_submit_retry', 'client_submit_retry',
    ]);
  });

  test('a network failure on the first try recovers on the retry and lands on /pending', async ({ page }) => {
    const u = await toConsent(page);
    let attempts = 0;
    await page.route('**/api/student/register', r => (++attempts === 1 ? r.abort('failed') : r.continue()));
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await page.waitForURL('**/pending', { timeout: 20_000 });
    expect(attempts).toBe(2);
    const sql = testSql();
    expect(await sql`SELECT 1 FROM student_profiles WHERE user_id = ${u.id}`).toHaveLength(1);
    await expect.poll(() => logged(u.email), { timeout: 10_000 }).toEqual([
      'client_submit_network_error', 'client_submit_retry', 'client_submit_recovered',
    ]);
  });

  test('a lost response after the server saved the application is confirmed, not shown as a 409', async ({ page }) => {
    const u = await toConsent(page);
    let attempts = 0;
    await page.route('**/api/student/register', async r => {
      if (++attempts === 1) { await r.fetch(); return r.abort('failed'); } // server saved it, reply lost
      return r.continue();
    });
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await page.waitForURL('**/pending', { timeout: 20_000 });
    expect(attempts).toBe(2);
    expect(await testSql()`SELECT 1 FROM student_profiles WHERE user_id = ${u.id}`).toHaveLength(1);
    await expect.poll(() => logged(u.email), { timeout: 10_000 }).toEqual([
      'client_submit_network_error', 'client_submit_retry', 'client_submit_duplicate_ok',
    ]);
  });

  test('a 409 on the first try is shown as before and never retried', async ({ page }) => {
    await toConsent(page);
    let attempts = 0;
    await page.route('**/api/student/register', r => { attempts++; return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'You have already submitted a registration.' }) }); });
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await expect(page.getByText('You have already submitted a registration.')).toBeVisible();
    expect(attempts).toBe(1);
  });

  test('a non-JSON 500 shows the generic error instead of hanging', async ({ page }) => {
    await toConsent(page);
    await page.route('**/api/student/register', r => r.fulfill({ status: 500, contentType: 'text/html', body: '<h1>Internal Server Error</h1>' }));
    await page.getByRole('button', { name: 'Submit Application' }).click();
    await expect(page.getByText('Submission failed. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Application' })).toBeEnabled();
  });
});

test.describe('final admission document guidance', () => {
  const confirmBox = (page: Page) => page.getByLabel(/I confirm this is my final/);

  test('before a country is chosen the guide lists all five documents', async ({ page }) => {
    await openRegisterForm(page);
    await expect(page.getByText('Upload your FINAL letter of acceptance — not your offer letter.')).toBeVisible();
    await expect(page.getByText('CoE (Australia), CAS (UK), LOA (Canada), I-20 (USA), IPA (Singapore). For Germany and other countries, upload your final admission letter.')).toBeVisible();
    await expect(page.getByText('Final admission document (CoE / CAS / LOA / I-20 / IPA) (PDF)')).toBeVisible();
    await expect(page.getByText('conditional offer letters, offer emails and fee receipts')).toBeVisible();
  });

  test('the label and tip follow the destination country', async ({ page }) => {
    await openRegisterForm(page);
    const country = sel(page, 'Country of education');
    await country.selectOption('Australia');
    await expect(page.getByText('Confirmation of Enrolment (CoE) (PDF)')).toBeVisible();
    await expect(confirmBox(page)).toBeVisible();
    await country.selectOption('United Kingdom');
    await expect(page.getByText('Confirmation of Acceptance for Studies (CAS) (PDF)')).toBeVisible();
    await country.selectOption('Germany');
    await expect(page.getByText('Final admission letter (PDF)')).toBeVisible();
    await expect(page.getByText(/your final admission letter \(the document confirming your seat/)).toBeVisible();
  });

  test('Continue is blocked until the student confirms it is the final letter, and the tick survives Back to edit', async ({ page }) => {
    await openRegisterForm(page);
    await fillRegistration(page);
    await confirmBox(page).uncheck();
    await page.getByRole('button', { name: /Continue to Review/ }).click();
    await expect(page.locator('p[role=alert]')).toContainText('not an offer letter');
    await expect(page.locator('p[role=alert]')).toBeInViewport();
    await expect(page).toHaveURL(/\/register$/);

    await confirmBox(page).check();
    await expect(page.locator('p[role=alert]')).toHaveCount(0);
    await page.getByRole('button', { name: /Continue to Review/ }).click();
    await page.waitForURL('**/register/consent');
    await expect(page.getByText('Passport, Final admission document, Photo')).toBeVisible();
    await page.getByRole('button', { name: /Back to edit/ }).click();
    await page.waitForURL('**/register');
    await expect(confirmBox(page)).toBeChecked();
  });

  test('a file named like an offer letter gets a warning but is still attached', async ({ page }) => {
    await openRegisterForm(page);
    await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'Offer_Letter.pdf', mimeType: 'application/pdf', buffer: pdf() });
    await expect(page.getByText(/This file name says/)).toBeVisible();
    await expect(page.getByText('Offer_Letter.pdf', { exact: true })).toBeVisible();
  });
});
