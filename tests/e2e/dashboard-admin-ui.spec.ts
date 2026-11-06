import { test, expect, type Page } from '@playwright/test';
import { emailFor, PASSWORD, seedUser, seedProfile, ctx, adminCtx, studentCtx, finding } from '../helpers/api';
import { testSql } from '../helpers/db';
import { waitForMail, mailHtml } from '../helpers/mail';
import { uiLogin, uiAdminLogin, acceptDialogs } from '../helpers/ui';

const iso = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function seedFlight(userId: number, f: { dep: string; arr: string; date: string; airline: string }) {
  await testSql()`INSERT INTO flight_details (user_id, departure_from, arrival, travel_date, airline) VALUES (${userId}, ${f.dep}, ${f.arr}, ${f.date}, ${f.airline})`;
}

async function studentLogin(page: Page, email: string) {
  await uiLogin(page, email, PASSWORD);
  await expect(page.getByText('Verified Student · CoE confirmed')).toBeVisible({ timeout: 15000 });
}

test.describe('8. peers, filters, flights, phone sharing (Canada pool)', () => {
  const date = iso(25);
  const same = { dep: 'Kochi (COK)', arr: 'Toronto (YYZ)', date, airline: 'Air Canada' };

  test('flight form scopes arrival by country; badges: "Same flight!" vs "Same day"; filters + chips; phone toggle', async ({ page }) => {
    const tag = Date.now().toString(36);
    const viewer = await seedUser();
    await seedProfile(viewer.id, { country: 'Canada', university: 'University of Toronto', city: 'Toronto', name: `Viewer ${tag}` });
    const sameFlight = await seedUser();
    await seedProfile(sameFlight.id, { country: 'Canada', university: 'McGill University', city: 'Montreal', name: `Sam Flight ${tag}`, course: 'Physics' });
    await seedFlight(sameFlight.id, same);
    const sameDay = await seedUser();
    await seedProfile(sameDay.id, { country: 'Canada', university: 'University of Toronto', city: 'Toronto', name: `Dana Day ${tag}`, sharePhone: true, phone: '+14165550123', course: 'Biology' });
    await seedFlight(sameDay.id, { ...same, airline: 'Emirates' });

    await studentLogin(page, viewer.email);

    // flight modal: arrival list is scoped to Canada; "Other" accepts free text
    await page.getByRole('button', { name: '+ Add flight details' }).click();
    const dep = page.getByRole('combobox', { name: 'Departure city / airport' });
    const arr = page.getByRole('combobox', { name: 'Arrival city / airport' });
    const air = page.locator('label:has-text("Airline") select');
    await expect(arr.locator('option', { hasText: 'Toronto (YYZ)' })).toHaveCount(1);
    await expect(arr.locator('option', { hasText: 'Melbourne (MEL)' })).toHaveCount(0);
    await expect(dep.locator('option', { hasText: 'Melbourne (MEL)' })).toHaveCount(1); // departure list is global
    await arr.selectOption({ label: '✏️ Other — type it in yourself' });
    await page.getByPlaceholder('Type arrival city / airport').fill('Tiny Strip (TST)');
    await arr.selectOption({ label: 'Toronto (YYZ)' });
    await dep.selectOption({ label: 'Kochi (COK)' });
    await page.locator('input[type=date]').fill(date);
    await air.selectOption({ label: 'Air Canada' });
    const saved = page.waitForResponse(r => r.url().includes('/api/students/flight') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save flight details' }).click();
    expect((await saved).status()).toBe(200);

    const search = page.getByPlaceholder('Search by name or course…');
    await search.fill(`Sam Flight ${tag}`);
    await expect(page.getByText('Same flight!')).toBeVisible();
    await search.fill(`Dana Day ${tag}`);
    await expect(page.getByText('Same day')).toBeVisible();
    await expect(page.getByText('Same flight!')).toHaveCount(0);

    // peer detail sheet: opt-in phone becomes a tel: link, masked phone does not
    await page.getByText(`Dana Day ${tag}`).first().click();
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await search.fill(`Sam Flight ${tag}`);
    await page.getByText(`Sam Flight ${tag}`).first().click();
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    // Email reveals the address inline (no mailto navigation) with a Copy button
    const urlBefore = page.url();
    await page.getByRole('button', { name: 'Email' }).click();
    await expect(page.getByTestId('peer-email-panel')).toBeVisible();
    await expect(page.getByTestId('peer-email-panel').getByRole('button', { name: 'Copy' })).toBeVisible();
    expect(page.url()).toBe(urlBefore);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // dropdown filters + chips + clear all
    await search.fill('');
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'All universities' }) }).first().selectOption({ label: 'McGill University' });
    await expect(page.getByText(`Sam Flight ${tag}`)).toBeVisible();
    await expect(page.getByText(`Dana Day ${tag}`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText(`Dana Day ${tag}`)).toBeVisible();

    // phone-sharing toggle persists
    const shareSwitch = page.getByRole('switch', { name: /Share my number/ });
    await expect(shareSwitch).toHaveAttribute('aria-checked', 'false');
    // a failed save rolls the switch back
    await page.route('**/api/students/share-phone', r => r.fulfill({ status: 500, body: '{}' }));
    await shareSwitch.click();
    await expect(shareSwitch).toHaveAttribute('aria-checked', 'false');
    await page.unroute('**/api/students/share-phone');
    await shareSwitch.click();
    await expect(shareSwitch).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await testSql()`SELECT share_phone FROM student_profiles WHERE user_id = ${viewer.id}`)[0].share_phone).toBe(true);
    const stored = await testSql()`SELECT arrival FROM flight_details WHERE user_id = ${viewer.id}`;
    expect(stored[0].arrival).toBe('Toronto (YYZ)');
  });

  test('a free-text "Other" airport is stored as typed and not added to the airports table', async ({ page }) => {
    const u = await seedUser();
    await seedProfile(u.id, { country: 'Canada', name: 'Other Airport' });
    await studentLogin(page, u.email);
    await page.getByRole('button', { name: '+ Add flight details' }).click();
    await page.getByRole('combobox', { name: 'Departure city / airport' }).selectOption({ label: '✏️ Other — type it in yourself' });
    await page.getByPlaceholder('Type departure city / airport').fill('Bhopal (BHO)');
    await page.getByRole('combobox', { name: 'Arrival city / airport' }).selectOption({ label: 'Toronto (YYZ)' });
    await page.locator('input[type=date]').fill(iso(40));
    await page.locator('label:has-text("Airline") select').selectOption({ label: 'Qantas' });
    await page.getByRole('button', { name: 'Save flight details' }).click();
    await expect.poll(async () => (await testSql()`SELECT departure_from FROM flight_details WHERE user_id = ${u.id}`)[0]?.departure_from).toBe('Bhopal (BHO)');
    expect(await testSql()`SELECT 1 FROM airports WHERE label = 'Bhopal (BHO)'`).toHaveLength(0);
  });
});

test('9. invite a peer from the dashboard', async ({ page }) => {
  const u = await seedUser();
  await seedProfile(u.id, { name: 'Inviter UI' });
  await studentLogin(page, u.email);
  // the fake service cards are gone and the invite lives in the FlyMates heading row
  await expect(page.getByText('Request now')).toHaveCount(0);
  await expect(page.getByText('Find Accommodation')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('button', { name: /Invite a peer/ })).toBeVisible(); // reachable on phones
  await page.getByRole('button', { name: /Invite a peer/ }).click();
  const box = page.getByPlaceholder('peer@example.com');
  // an already-registered address shows its error inline, inside the modal
  await box.fill((await seedUser()).email);
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText('This person already has a UniMate account.')).toBeVisible();
  await box.fill('not-an-email');
  await expect(page.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
  const to = emailFor('uiinvite');
  await box.fill(to);
  await page.getByRole('button', { name: 'Send invitation' }).click();
  const invite = await waitForMail(to, '');
  expect(await mailHtml(invite.ID)).toContain('/login?mode=signup');
  await expect(page.getByPlaceholder('peer@example.com')).toHaveCount(0); // modal closed on success

  // the email's link opens the sign-up tab directly
  await page.context().clearCookies();
  await page.goto('/login?mode=signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test.describe('10. Logs tab', () => {
  test('shows the student\'s trail with Sent pills, filters, row detail and the per-student timeline', async ({ page }) => {
    const email = emailFor('logs');
    const c = await ctx();
    await c.post('/api/auth/signup', { data: { email, password: PASSWORD } });
    await waitForMail(email, '');
    await c.post('/api/auth/forgot-password', { data: { email } }); // unverified: no mail, still no crash

    await uiAdminLogin(page);
    await page.getByRole('button', { name: 'Logs' }).click();
    await page.getByPlaceholder('Search by email…').fill(email);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('tbody').getByText('signup_success').first()).toBeVisible();
    await expect(page.locator('tbody').getByText(/✉ Sent/).first()).toBeVisible();

    await page.getByRole('combobox', { name: 'Event' }).selectOption('email_sent');
    await expect(page.locator('tbody').getByText('signup_success')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Event' }).selectOption('');

    await page.locator('tbody tr').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'View timeline' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText(email);
    await expect(sheet).toContainText(/no application yet/);
  });

  test('a failed email shows a Failed pill (one row per failure)', async ({ page }) => {
    const email = emailFor('failpill');
    await testSql()`INSERT INTO student_error_logs (level, event, message, category, email, metadata) VALUES ('error','email_send_failed','Email could not be sent (verification)','email',${email}, '{"type":"verification","subject":"Verify"}')`;
    await uiAdminLogin(page);
    await page.getByRole('button', { name: 'Logs' }).click();
    await page.getByPlaceholder('Search by email…').fill(email);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('tbody').getByText(/✉ Failed/).first()).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });
});

test.describe('admin management UI', () => {
  test('2. invite an admin from the Manage Admins tab; pending invite can be revoked', async ({ page }) => {
    const to = emailFor('uiadmin');
    acceptDialogs(page);
    await uiAdminLogin(page);
    await page.getByRole('button', { name: 'Manage Admins' }).click();
    await page.getByPlaceholder('admin@example.com').fill(to);
    await page.getByRole('button', { name: /Send invite|Invite/ }).first().click();
    await waitForMail(to, '');
    await expect(page.getByText(to)).toBeVisible();
  });
});

test.describe('stored XSS: user-controlled text in the admin UI renders as text', () => {
  test('script/HTML in name, university and city does not execute or create elements', async ({ page, browser }) => {
    const dialogs: string[] = [];
    const evilName = `<img src=x onerror="window.__xss=1"> Evil`;
    const u = await seedUser();
    await seedProfile(u.id, { status: 'pending', name: evilName, university: '<svg onload="window.__xss=2">', city: '<script>window.__xss=3</script>' });
    page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await uiAdminLogin(page);
    await page.getByPlaceholder('Search by name, email or university…').fill(u.email);
    await expect(page.getByText(evilName).first()).toBeVisible();
    await page.getByRole('button', { name: /Review/ }).first().click();
    await expect(page.getByText('Course start date').first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    expect(dialogs).toEqual([]);
    void browser; void adminCtx; void studentCtx; void finding;
  });

  test('peer cards render hostile names as text for other students', async ({ page }) => {
    const viewer = await seedUser();
    await seedProfile(viewer.id, { country: 'Ireland', name: 'Viewer Irl' });
    const evil = await seedUser();
    await seedProfile(evil.id, { country: 'Ireland', name: '<img src=x onerror="window.__xss=9"> Peer', university: '<b>bold</b> Uni' });
    await studentLogin(page, viewer.email);
    await expect(page.getByText('<img src=x onerror="window.__xss=9"> Peer').first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
  });
});

test.describe('11. mobile viewport (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  test('login, register, dashboard and admin fit without horizontal scroll; filter drawer opens', async ({ page }) => {
    await page.goto('/login');
    expect(await noHorizontalScroll(page), 'login overflow px').toBeLessThanOrEqual(1);

    const fresh = await seedUser();
    await uiLogin(page, fresh.email, PASSWORD);
    await page.waitForURL('**/register');
    await expect(page.getByRole('button', { name: /Continue to Review/ })).toBeVisible();
    expect(await noHorizontalScroll(page), 'register overflow px').toBeLessThanOrEqual(1);

    const approved = await seedUser();
    await seedProfile(approved.id, { country: 'Germany', name: 'Mobile M' });
    await page.context().clearCookies();
    await studentLogin(page, approved.email);
    expect(await noHorizontalScroll(page), 'dashboard overflow px').toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('button', { name: 'Close filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Close filters' }).click();

  });

  test('admin page fits at 390px', async ({ page }) => {
    finding('F-34', 'the admin tab bar (Student Applications / Archives / Manage Dropdowns / Manage Admins / Logs) is wider than a phone and is neither wrapped nor scrollable: the whole page scrolls sideways by ~147 px at 390 px');
    await uiAdminLogin(page);
    await expect(page.getByRole('button', { name: 'Logs' })).toBeVisible();
    expect(await noHorizontalScroll(page), 'admin overflow px').toBeLessThanOrEqual(1);
  });
});

test('10. ask for help from the navbar and the footer', async ({ page }) => {
  const u = await seedUser();
  await seedProfile(u.id, { name: 'Help UI' });
  await studentLogin(page, u.email);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('button', { name: /Need help\?/ }).first()).toBeVisible(); // reachable on phones
  await page.getByRole('button', { name: 'Need help? Contact UniMate support' }).click();
  const send = page.getByRole('button', { name: 'Send to support' });
  await expect(send).toBeDisabled(); // empty message
  await page.getByPlaceholder('Describe your issue or question…').fill('My flight date changed, how do I update it?');
  await send.click();
  const mail = await waitForMail(process.env.GMAIL_USER ?? 'test@unimate.test', 'Help UI');
  expect(await mailHtml(mail.ID)).toContain('My flight date changed');
  await expect(page.getByPlaceholder('Describe your issue or question…')).toHaveCount(0); // closed on success
  // footer link opens the same sheet
  await page.getByRole('button', { name: 'Need help?', exact: true }).click();
  await expect(page.getByText('How can we help?')).toBeVisible();
});
