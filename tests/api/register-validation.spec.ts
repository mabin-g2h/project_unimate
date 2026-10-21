import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { newUnregisteredStudent, registerForm, pdf, png, jpg, seedProfile, finding } from '../helpers/api';
import { testSql } from '../helpers/db';
import { ROOT } from '../helpers/env';

const post = (api: Awaited<ReturnType<typeof newUnregisteredStudent>>['api'], multipart: ReturnType<typeof registerForm>) =>
  api.post('/api/student/register', { multipart });

test.describe('register: validation', () => {
  test('happy path stores a normalised profile, clears the form deadline, writes files', async () => {
    const { user, api } = await newUnregisteredStudent();
    const sql = testSql();
    await sql`UPDATE users SET verification_expires = NOW() + INTERVAL '48 hours' WHERE id = ${user.id}`;
    const r = await post(api, registerForm({ fields: { course_name: '  Data    Science  ', phone: '+91 98765 43210' } }));
    expect(r.status()).toBe(200);
    const [p] = await sql`SELECT * FROM student_profiles WHERE user_id = ${user.id}`;
    expect(p.status).toBe('pending');
    expect(p.course_name).toBe('Data Science');
    expect(p.phone).toBe('+919876543210');
    expect(p.consented_at).not.toBeNull();
    const [u] = await sql`SELECT verification_expires FROM users WHERE id = ${user.id}`;
    expect(u.verification_expires).toBeNull();
    for (const col of ['passport_url', 'admission_letter_url', 'profile_picture_url']) {
      expect(p[col]).toMatch(/^\/__test_uploads\//);
      expect(fs.existsSync(path.join(ROOT, 'public', p[col]))).toBe(true);
    }
  });

  test('second submission -> 409', async () => {
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm())).status()).toBe(200);
    expect((await post(api, registerForm())).status()).toBe(409);
  });

  test('consent not accepted -> 400', async () => {
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm({ fields: { consents_accepted: 'false' } }))).status()).toBe(400);
  });

  for (const field of ['full_name', 'country_of_origin', 'country_of_education', 'university_name', 'degree_level', 'course_name', 'intake_month', 'intake_year', 'city', 'gender']) {
    test(`blank ${field} -> 400`, async () => {
      const { api } = await newUnregisteredStudent();
      const r = await post(api, registerForm({ fields: { [field]: '   ' } }));
      expect(r.status()).toBe(400);
    });
  }

  for (const phone of ['12345', 'not-a-phone', '+1 555', '']) {
    test(`invalid phone "${phone}" -> 400`, async () => {
      const { api } = await newUnregisteredStudent();
      expect((await post(api, registerForm({ fields: { phone } }))).status()).toBe(400);
    });
  }

  test('phone without country code is rejected', async () => {
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm({ fields: { phone: '9876543210' } }))).status()).toBe(400);
  });
});

test.describe('register: uploads', () => {
  const cases: [string, Parameters<typeof registerForm>[0], number][] = [
    ['text file renamed .pdf as passport', { files: { passport: { name: 'p.pdf', mimeType: 'application/pdf', buffer: Buffer.from('hello world, not a pdf') } } }, 400],
    ['exe as admission letter', { files: { admission_letter: { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]) } } }, 400],
    ['PNG sent as passport', { files: { passport: { name: 'p.pdf', mimeType: 'application/pdf', buffer: png() } } }, 400],
    ['PDF sent as profile picture', { files: { profile_picture: { name: 'x.png', mimeType: 'image/png', buffer: pdf() } } }, 400],
    ['JPEG accepted as profile picture', { files: { profile_picture: { name: 'x.jpg', mimeType: 'image/jpeg', buffer: jpg() } } }, 200],
    ['passport exactly 2 MB accepted', { files: { passport: { name: 'p.pdf', mimeType: 'application/pdf', buffer: pdf(2 * 1024 * 1024) } } }, 200],
    ['passport 2 MB + 1 byte rejected', { files: { passport: { name: 'p.pdf', mimeType: 'application/pdf', buffer: pdf(2 * 1024 * 1024 + 1) } } }, 400],
    ['profile picture 1 MB + 1 byte rejected', { files: { profile_picture: { name: 'x.png', mimeType: 'image/png', buffer: png(1024 * 1024 + 1) } } }, 400],
    ['missing passport', { files: { passport: null } }, 400],
    ['missing profile picture', { files: { profile_picture: null } }, 400],
    ['wrong extension but real PDF bytes accepted (content, not name, decides)', { files: { passport: { name: 'passport.exe', mimeType: 'application/x-msdownload', buffer: pdf() } } }, 200],
  ];
  for (const [name, overrides, status] of cases) {
    test(name, async () => {
      const { api } = await newUnregisteredStudent();
      expect((await post(api, registerForm(overrides))).status()).toBe(status);
    });
  }
});

test.describe('register: input hardening (expected-correct behaviour)', () => {
  test('non-numeric intake_year is rejected with 400, not 500', async () => {
    finding('F-01', 'intake_year is not validated; parseInt gives NaN and the INSERT fails with 500');
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm({ fields: { intake_year: 'abc' } }))).status()).toBe(400);
  });

  test('over-long gender is rejected with 400, not 500', async () => {
    finding('F-02', 'gender is not whitelisted; VARCHAR(10) overflow gives 500');
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm({ fields: { gender: 'x'.repeat(40) } }))).status()).toBe(400);
  });

  test('over-long full_name is rejected with 400, not 500', async () => {
    finding('F-03', 'no max-length validation; VARCHAR(255) overflow gives 500 (documented gap in CLAUDE.md)');
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm({ fields: { full_name: 'A'.repeat(300) } }))).status()).toBe(400);
  });

  test('country_of_education outside the canonical list is rejected', async () => {
    finding('F-04', 'country_of_education is free text server-side; any string is stored');
    const { api } = await newUnregisteredStudent();
    expect((await post(api, registerForm({ fields: { country_of_education: 'Atlantis' } }))).status()).toBe(400);
  });

  test('an invalid resubmission must not destroy the rejected profile', async () => {
    finding('F-05', 'the rejected profile is DELETEd before the form is validated');
    const { user, api } = await newUnregisteredStudent();
    await seedProfile(user.id, { status: 'rejected' });
    const r = await post(api, registerForm({ fields: { city: '' } }));
    expect(r.status()).toBe(400);
    const rows = await testSql()`SELECT 1 FROM student_profiles WHERE user_id = ${user.id}`;
    expect(rows.length).toBe(1);
  });

  test('a rejected student can re-apply with a valid form', async () => {
    const { user, api } = await newUnregisteredStudent();
    await seedProfile(user.id, { status: 'rejected' });
    expect((await post(api, registerForm())).status()).toBe(200);
    const rows = await testSql()`SELECT status FROM student_profiles WHERE user_id = ${user.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });
});
