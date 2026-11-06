import { test, expect, type Page } from '@playwright/test';
import { PASSWORD, seedUser, seedProfile } from '../helpers/api';
import { testSql } from '../helpers/db';
import { uiLogin } from '../helpers/ui';

async function newStudent(opts: { onboarded: boolean; country?: string }) {
  const u = await seedUser();
  await seedProfile(u.id, { onboarded: opts.onboarded, country: opts.country ?? 'Canada', university: 'University of Toronto', city: 'Toronto' });
  return u;
}

const login = async (page: Page, email: string) => {
  await uiLogin(page, email, PASSWORD);
  await expect(page.getByText('Verified Student · CoE confirmed')).toBeVisible({ timeout: 15000 });
};
const dialog = (page: Page) => page.getByRole('dialog');
const flag = async (userId: number) =>
  (await testSql()`SELECT onboarded_at FROM student_profiles WHERE user_id = ${userId}`)[0].onboarded_at as Date | null;

test.describe('first-visit dashboard tour', () => {
  test('walks every step, saves the flag once finished, and does not return after reload', async ({ page }) => {
    const u = await newStudent({ onboarded: false });
    await login(page, u.email);

    await expect(dialog(page).getByRole('heading', { name: /Welcome to UniMate/ })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Start tour' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Your boarding pass' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Next' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Add your flight details' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Back' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Your boarding pass' })).toBeVisible();

    // No peers in this seeded set up -> "Say hello" step is skipped; the rest are present.
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      seen.push(await dialog(page).getByRole('heading').innerText());
      const done = dialog(page).getByRole('button', { name: 'Got it' });
      if (await done.isVisible()) { await done.click(); break; }
      await dialog(page).getByRole('button', { name: 'Next' }).click();
    }
    expect(seen).toEqual(expect.arrayContaining(['Your boarding pass', 'Add your flight details', 'Your FlyMates', 'Share your number, your choice', 'Bring friends along', "You're ready to go"]));
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => flag(u.id)).not.toBeNull();

    await page.reload();
    await expect(page.getByText('Verified Student · CoE confirmed')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('Skip closes the tour, persists, and Escape also skips', async ({ page }) => {
    const u = await newStudent({ onboarded: false });
    await login(page, u.email);
    await dialog(page).getByRole('button', { name: 'Skip' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => flag(u.id)).not.toBeNull();
    const [log] = await testSql()`SELECT event FROM student_error_logs WHERE user_id = ${u.id} AND event LIKE 'tour_%'`;
    expect(log.event).toBe('tour_skipped');

    const u2 = await newStudent({ onboarded: false });
    await page.context().clearCookies();
    await login(page, u2.email);
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => flag(u2.id)).not.toBeNull();
  });

  test('students who already saw it get no tour, and can replay it without changing the flag', async ({ page }) => {
    const u = await newStudent({ onboarded: true });
    const before = await flag(u.id);
    await login(page, u.email);
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Replay the dashboard tour' }).click();
    await expect(dialog(page).getByRole('heading', { name: /Welcome to UniMate/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    expect(await flag(u.id)).toEqual(before);
    const logs = await testSql()`SELECT 1 FROM student_error_logs WHERE user_id = ${u.id} AND event LIKE 'tour_%'`;
    expect(logs).toHaveLength(0);
  });

  test('phone: steps appear as a bottom card and the filter step points at the Filters button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const u = await newStudent({ onboarded: false });
    await login(page, u.email);

    const d = dialog(page);
    await expect(d).toBeVisible();
    // The card slides up on entry; wait for it to settle before measuring.
    await expect.poll(async () => { const b = await d.boundingBox(); return b ? Math.round(b.y + b.height) : 0; }).toBe(844);
    expect((await d.boundingBox())!.width).toBeCloseTo(390, 0);

    await d.getByRole('button', { name: 'Start tour' }).click();
    for (let i = 0; i < 12; i++) {
      if (await d.getByRole('heading', { name: 'Find people like you' }).isVisible()) break;
      await d.getByRole('button', { name: 'Next' }).click();
    }
    await expect(d.getByText(/Tap Filters/)).toBeVisible();
    // the highlighted target (Filters button bar) sits above the card, not under it
    const target = await page.locator('[data-tour="filters"]:visible').first().boundingBox();
    expect(target!.y + target!.height).toBeLessThanOrEqual((await d.boundingBox())!.y);
  });
});
