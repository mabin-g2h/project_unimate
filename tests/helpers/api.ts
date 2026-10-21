import { request, type APIRequestContext } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { testSql } from './db';
import { BASE_URL, loadTestEnv, ADMIN } from './env';

export const PASSWORD = 'TestPass123!';
let counter = 0;
export const uniq = (p = 'u') => `${p}-${Date.now().toString(36)}-${++counter}`;
export const emailFor = (p = 'u') => `${uniq(p)}@example.test`;

export interface SeedUser { id: number; email: string }

export async function seedUser(opts: { email?: string; role?: 'student' | 'admin'; verified?: boolean } = {}): Promise<SeedUser> {
  const sql = testSql();
  const email = (opts.email ?? emailFor()).toLowerCase();
  const hash = await bcrypt.hash(PASSWORD, 4);
  const [u] = await sql`INSERT INTO users (email, password_hash, email_verified, role)
    VALUES (${email}, ${hash}, ${opts.verified ?? true}, ${opts.role ?? 'student'}) RETURNING id`;
  return { id: u.id as number, email };
}

export interface ProfileOpts {
  status?: string; country?: string; university?: string; city?: string; course?: string;
  degree?: string; month?: string; year?: number; phone?: string; sharePhone?: boolean; name?: string;
  expiry?: string | null; courseStart?: string | null;
}

export async function seedProfile(userId: number, o: ProfileOpts = {}): Promise<number> {
  const sql = testSql();
  const [p] = await sql`INSERT INTO student_profiles
    (user_id, full_name, phone, country_of_origin, country_of_education, university_name, degree_level, course_name,
     intake_month, intake_year, passport_url, admission_letter_url, profile_picture_url, status, share_phone, consented_at,
     city, gender, course_start_date, expiry_date)
    VALUES (${userId}, ${o.name ?? 'Test Student'}, ${o.phone ?? '+919876543210'}, 'India', ${o.country ?? 'Australia'},
     ${o.university ?? 'University of Melbourne'}, ${o.degree ?? "Master's Degree"}, ${o.course ?? 'Computer Science'},
     ${o.month ?? 'July'}, ${o.year ?? 2027}, '/__test_uploads/seed_passport.pdf', '/__test_uploads/seed_admission.pdf',
     '/__test_uploads/seed_photo.png', ${o.status ?? 'approved'}, ${o.sharePhone ?? false}, NOW(),
     ${o.city ?? 'Melbourne'}, 'Male', ${o.courseStart ?? null}, ${o.expiry ?? null}) RETURNING id`;
  return p.id as number;
}

export async function ctx(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL });
}

export async function loginAs(email: string, password = PASSWORD): Promise<APIRequestContext> {
  const c = await ctx();
  const r = await c.post('/api/auth/login', { data: { email, password } });
  if (!r.ok()) throw new Error(`login failed for ${email}: ${r.status()} ${await r.text()}`);
  return c;
}

export const adminCtx = () => loginAs(ADMIN.email, ADMIN.password);

export async function studentCtx(p: ProfileOpts = {}) {
  const user = await seedUser();
  const profileId = await seedProfile(user.id, p);
  return { user, profileId, api: await loginAs(user.email) };
}

// Forge a JWT with the test secret (for tamper / expiry / role-claim tests).
export async function forgeToken(claims: Record<string, unknown>, opts: { secret?: string; exp?: string | number; alg?: string } = {}) {
  const secret = new TextEncoder().encode(opts.secret ?? loadTestEnv().JWT_SECRET);
  const jwt = new SignJWT(claims).setProtectedHeader({ alg: opts.alg ?? 'HS256' });
  if (opts.exp !== undefined) jwt.setExpirationTime(opts.exp); else jwt.setExpirationTime('7d');
  return jwt.sign(secret);
}

export async function withToken(token: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { cookie: `auth-token=${token}` } });
}

// ── upload fixtures (only the magic bytes + padding are checked by the app) ──
export const pdf = (size = 2048) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(Math.max(0, size - 9), 0x20)]);
export const png = (size = 2048) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(Math.max(0, size - 8), 0)]);
export const jpg = (size = 2048) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.max(0, size - 4), 0)]);

export interface RegisterOverrides { fields?: Record<string, string>; files?: Record<string, { name: string; mimeType: string; buffer: Buffer } | null> }

export function registerForm(o: RegisterOverrides = {}) {
  const fields: Record<string, string> = {
    full_name: 'Asha Menon', phone: '+919876543210', country_of_origin: 'India', country_of_education: 'Australia',
    university_name: 'University of Melbourne', degree_level: "Master's Degree", course_name: 'Data Science',
    intake_month: 'July', intake_year: '2027', city: 'Melbourne', gender: 'Female', consents_accepted: 'true',
    ...o.fields,
  };
  const files: Record<string, { name: string; mimeType: string; buffer: Buffer } | null> = {
    passport: { name: 'passport.pdf', mimeType: 'application/pdf', buffer: pdf() },
    admission_letter: { name: 'admission.pdf', mimeType: 'application/pdf', buffer: pdf() },
    profile_picture: { name: 'me.png', mimeType: 'image/png', buffer: png() },
    ...o.files,
  };
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = { ...fields };
  for (const [k, v] of Object.entries(files)) if (v) multipart[k] = v;
  return multipart;
}

export async function newUnregisteredStudent() {
  const user = await seedUser();
  return { user, api: await loginAs(user.email) };
}

// Marks a test as a known, documented finding: it asserts the expected-correct behaviour and is
// expected to fail today (test.fail). Run with RAW_FINDINGS=1 to see the real failure messages.
import { test } from '@playwright/test';
export function finding(id: string, reason: string) {
  if (!process.env.RAW_FINDINGS) test.fail(true, `${id}: ${reason}`);
  else test.info().annotations.push({ type: 'finding', description: `${id}: ${reason}` });
}
