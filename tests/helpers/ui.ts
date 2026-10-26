import { expect, type Page, type Locator } from '@playwright/test';
import { ADMIN } from './env';
import { pdf } from './api';

// A real, decodable 1x1 PNG: the form resizes the photo client-side, so header-only bytes are not enough.
export const REAL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Labels in the registration form are plain <label> siblings (no htmlFor), so controls are
// located relative to the label text.
export const sel = (page: Page, label: string): Locator =>
  page.locator(`xpath=//label[contains(normalize-space(.),"${label}")]/following-sibling::select[1]`);
export const txt = (page: Page, label: string): Locator =>
  page.locator(`xpath=//label[contains(normalize-space(.),"${label}")]/following-sibling::input[1]`);

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button.um-submit').click();
}

export async function uiAdminLogin(page: Page) {
  await uiLogin(page, ADMIN.email, ADMIN.password);
  await page.waitForURL('**/admin');
}

export interface FormOpts { name?: string; university?: string | { other: string }; city?: string | { other: string }; country?: string; course?: string }

export async function fillRegistration(page: Page, o: FormOpts = {}) {
  const country = o.country ?? 'Australia';
  await txt(page, 'Full name').fill(o.name ?? 'Meera Nair');
  await page.locator('input.PhoneInputInput').fill('+91 98765 43210');
  await sel(page, 'Country of origin').selectOption('India');
  await sel(page, 'Gender').selectOption('Female');

  // University / City are disabled until a destination country is chosen.
  await expect(sel(page, 'University / institution name')).toBeDisabled();
  await sel(page, 'Country of education').selectOption(country);
  const uni = o.university ?? 'University of Melbourne';
  if (typeof uni === 'string') {
    await expect(sel(page, 'University / institution name').locator('option', { hasText: uni })).toHaveCount(1);
    await sel(page, 'University / institution name').selectOption({ label: uni });
  } else {
    await sel(page, 'University / institution name').selectOption({ label: '✏️ Other — type it in yourself' });
    await page.getByPlaceholder('Type your university name').fill(uni.other);
  }
  const city = o.city ?? 'Melbourne';
  if (typeof city === 'string') {
    await expect(sel(page, 'City').locator('option', { hasText: city })).toHaveCount(1);
    await sel(page, 'City').selectOption({ label: city });
  } else {
    await sel(page, 'City').selectOption({ label: '✏️ Other — type it in yourself' });
    await page.getByPlaceholder('Type your city').fill(city.other);
  }
  await sel(page, 'Degree level').selectOption("Master's Degree");
  await txt(page, 'Course / programme name').fill(o.course ?? 'Master of Data Science');
  await sel(page, 'Intake month').selectOption('July');
  await sel(page, 'Intake year').selectOption({ index: 1 });

  const files = page.locator('input[type=file]');
  await files.nth(0).setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await files.nth(1).setInputFiles({ name: 'admission.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await files.nth(2).setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: REAL_PNG });
  await page.getByLabel(/I confirm this is my final/).check();
}

export async function submitRegistrationAndConsent(page: Page) {
  await page.getByRole('button', { name: /Continue to Review/ }).click();
  await page.waitForURL('**/register/consent');
  for (const n of [1, 2, 3, 4]) await page.getByText(new RegExp(`^${n}\\. `)).click();
  await page.getByRole('button', { name: 'Submit Application' }).click();
  await page.waitForURL('**/pending');
}

export function acceptDialogs(page: Page) {
  page.on('dialog', d => d.accept());
}
