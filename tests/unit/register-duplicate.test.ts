import { describe, it, expect, vi, beforeEach } from 'vitest';

// The race the unique index (migration 021) exists for: the up-front "already submitted?" check
// passes, but a concurrent request inserts the profile first, so OUR insert hits the index.
const sqlMock = vi.fn();
const putFile = vi.fn();
const delFiles = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/db', () => ({ sql: (strings: TemplateStringsArray, ...v: unknown[]) => sqlMock(strings.join('?'), v) }));
vi.mock('@/lib/auth', () => ({ getSession: async () => ({ userId: 7, email: 'racer@example.test', role: 'student', emailVerified: true }) }));
vi.mock('@/lib/storage', () => ({ putFile: (...a: unknown[]) => putFile(...a), delFiles: (...a: unknown[]) => delFiles(...a) }));
vi.mock('@/lib/logger', () => ({ log: (...a: unknown[]) => { logMock(...a); return Promise.resolve(); } }));
vi.mock('@/lib/email', () => ({ sendRegistrationAcknowledgement: vi.fn(), sendAdminRegistrationNotification: vi.fn() }));

const pdf = () => new File([Buffer.from('%PDF-1.4\n')], 'a.pdf', { type: 'application/pdf' });
const jpg = () => new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1])], 'a.jpg', { type: 'image/jpeg' });

function request() {
  const fd = new FormData();
  const fields: Record<string, string> = {
    consents_accepted: 'true', full_name: 'Race Student', phone: '+919876543210', country_of_origin: 'India',
    country_of_education: 'Australia', university_name: 'University of Melbourne', degree_level: "Master's Degree",
    course_name: 'Course', intake_month: 'February', intake_year: '2027', city: 'Melbourne', gender: 'Female',
  };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('passport', pdf()); fd.append('admission_letter', pdf()); fd.append('profile_picture', jpg());
  return new Request('http://localhost/api/student/register', { method: 'POST', body: fd });
}

beforeEach(() => {
  vi.resetModules();
  [sqlMock, putFile, delFiles, logMock].forEach(m => m.mockReset());
  putFile.mockImplementation(async (name: string) => `/__blob__/${name}`);
  delFiles.mockResolvedValue(undefined);
  sqlMock.mockImplementation(async (text: string) => {
    if (text.includes('INSERT INTO student_profiles')) throw Object.assign(new Error('duplicate key value violates unique constraint "student_profiles_user_id_key"'), { code: '23505' });
    if (text.includes('SELECT id FROM student_profiles')) return [];   // the up-front check passes
    return [];
  });
});

const load = async () => (await import('@/app/api/student/register/route')).POST;

describe('register: concurrent duplicate submit blocked by the unique index', () => {
  it('answers 409, deletes the orphaned uploads (incl. the passport) and logs it as a warning', async () => {
    const res = await (await load())(request() as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('You have already submitted a registration.');
    const uploaded = putFile.mock.calls.map(c => `/__blob__/${c[0]}`);
    expect(uploaded).toHaveLength(3);
    expect(delFiles).toHaveBeenCalledTimes(1);
    expect([...delFiles.mock.calls[0][0]].sort()).toEqual([...uploaded].sort());
    expect(logMock.mock.calls[0][0]).toMatchObject({ level: 'warn', event: 'registration_failed', metadata: { http_status: 409, reason: 'duplicate_submission' } });
  });

  it('does not clear the form deadline or send mail for the losing request', async () => {
    await (await load())(request() as never);
    expect(sqlMock.mock.calls.some(c => String(c[0]).includes('UPDATE users SET verification_expires'))).toBe(false);
  });

  it('other insert failures still return 500 and keep the uploads (not a duplicate)', async () => {
    sqlMock.mockImplementation(async (text: string) => {
      if (text.includes('INSERT INTO student_profiles')) throw new Error('connection reset');
      return [];
    });
    const res = await (await load())(request() as never);
    expect(res.status).toBe(500);
    expect(delFiles).not.toHaveBeenCalled();
    expect(logMock.mock.calls[0][0]).toMatchObject({ level: 'error', event: 'registration_error' });
  });

  it('file names carry a random suffix so concurrent requests never share one', async () => {
    await (await load())(request() as never);
    await (await load())(request() as never);
    const names = putFile.mock.calls.map(c => c[0] as string);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every(n => /^7_(passport|admission_letter|profile_picture)_\d+_[0-9a-f]{8}\.(pdf|jpg)$/.test(n))).toBe(true);
  });
});
