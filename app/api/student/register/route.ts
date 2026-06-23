import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendRegistrationAcknowledgement, sendAdminRegistrationNotification } from '@/lib/email';
import { put } from '@vercel/blob';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // If rejected before, allow re-apply by deleting old profile
  await sql`DELETE FROM student_profiles WHERE user_id = ${session.userId} AND status = 'rejected'`;

  const [existing] = await sql`SELECT id FROM student_profiles WHERE user_id = ${session.userId}`;
  if (existing) {
    log({ level: 'warn', event: 'registration_failed', message: 'Registration attempted after already submitting', email: session.email, userId: session.userId, route: '/api/student/register', metadata: { http_status: 409 } });
    return NextResponse.json({ error: 'You have already submitted a registration.' }, { status: 409 });
  }

  const formData = await request.formData();

  const allConsentsAccepted = formData.get('consents_accepted') === 'true';
  if (!allConsentsAccepted) {
    log({ level: 'warn', event: 'registration_failed', message: 'Registration submitted without consent', email: session.email, userId: session.userId, route: '/api/student/register', metadata: { http_status: 400, reason: 'missing_consent' } });
    return NextResponse.json({ error: 'Please accept all four consent declarations before submitting.' }, { status: 400 });
  }

  // Required field validation (course is now free text — must not be blank).
  // Friendly labels so the user sees "Country of education", not "country_of_education".
  const FIELD_LABELS: Record<string, string> = {
    full_name: 'Full name',
    country_of_origin: 'Country of origin',
    country_of_education: 'Country of education',
    university_name: 'University / institution name',
    degree_level: 'Degree level',
    course_name: 'Course / programme name',
    intake_month: 'Intake month',
    intake_year: 'Intake year',
    city: 'City',
    gender: 'Gender',
  };
  for (const field of Object.keys(FIELD_LABELS)) {
    if (!((formData.get(field) as string) ?? '').trim()) {
      log({ level: 'warn', event: 'registration_failed', message: `Registration failed — missing required field: ${field}`, email: session.email, userId: session.userId, route: '/api/student/register', metadata: { http_status: 400, reason: 'missing_field', field } });
      return NextResponse.json({ error: `${FIELD_LABELS[field]} is required — please fill it in.` }, { status: 400 });
    }
  }
  const courseName = ((formData.get('course_name') as string) ?? '').trim().replace(/\s+/g, ' ');

  // Validate + normalise phone to E.164 (format-only check, no SMS/OTP)
  const parsedPhone = parsePhoneNumberFromString(((formData.get('phone') as string) ?? '').trim());
  if (!parsedPhone || !parsedPhone.isValid()) {
    log({ level: 'warn', event: 'registration_failed', message: 'Registration failed — invalid phone number', email: session.email, userId: session.userId, route: '/api/student/register', metadata: { http_status: 400, reason: 'invalid_phone' } });
    return NextResponse.json({ error: 'Please enter a valid phone number, including the country code.' }, { status: 400 });
  }
  const phoneE164 = parsedPhone.number;

  const PDF_MAX = 2 * 1024 * 1024; // 2 MB
  const IMG_MAX = 1 * 1024 * 1024; // 1 MB

  // Detect the real file format from its magic bytes — extension/MIME can be
  // spoofed (a renamed .docx still claims .pdf), so we sniff the header.
  async function sniff(file: File): Promise<'pdf' | 'jpeg' | 'png' | 'unknown'> {
    const buf = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const starts = (sig: number[]) => sig.every((b, i) => buf[i] === b);
    if (starts([0x25, 0x50, 0x44, 0x46])) return 'pdf';  // %PDF
    if (starts([0xff, 0xd8, 0xff])) return 'jpeg';
    if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    return 'unknown';
  }

  // Validate presence + size + real content for one upload. Returns { file, kind }
  // on success, or a 400 NextResponse on failure. Logs all failures.
  // kind is reused by saveFile so sniff() is never called twice on the same file.
  async function validateFile(
    field: string,
    label: string,
    maxBytes: number,
    maxLabel: string,
    accept: Array<'pdf' | 'jpeg' | 'png'>,
    formatLabel: string,
  ): Promise<{ file: File; kind: 'pdf' | 'jpeg' | 'png' } | NextResponse> {
    const file = formData.get(field) as File | null;
    if (!file || file.size === 0) {
      log({ level: 'warn', event: 'registration_failed', message: `Registration failed — required file missing: ${field}`, email: session!.email, userId: session!.userId, route: '/api/student/register', metadata: { http_status: 400, reason: 'file_missing', field } });
      return NextResponse.json({ error: `${label} is required — please attach it before submitting (${formatLabel}, max ${maxLabel}).` }, { status: 400 });
    }
    if (file.size > maxBytes) {
      const actualMB = (file.size / (1024 * 1024)).toFixed(1);
      log({ level: 'warn', event: 'registration_failed', message: `Registration failed — file too large: ${field} (${actualMB} MB)`, email: session!.email, userId: session!.userId, route: '/api/student/register', metadata: { http_status: 400, reason: 'file_too_large', field, actual_mb: actualMB, max_label: maxLabel } });
      return NextResponse.json({ error: `${label} is ${actualMB} MB, which is over the ${maxLabel} limit. Please upload a smaller file.` }, { status: 400 });
    }
    const kind = await sniff(file);
    if (kind === 'unknown' || !accept.includes(kind)) {
      log({ level: 'warn', event: 'registration_failed', message: `Registration failed — invalid file format: ${field} (detected: ${kind})`, email: session!.email, userId: session!.userId, route: '/api/student/register', metadata: { http_status: 400, reason: 'invalid_file_format', field, detected_kind: kind, expected: formatLabel } });
      return NextResponse.json({ error: `${label} must be a valid ${formatLabel}. The file you uploaded isn't a genuine ${formatLabel} — it may have been renamed or is corrupted. Please re-export and upload it again.` }, { status: 400 });
    }
    return { file, kind };
  }

  // Validate all files up front so a bad upload fails fast without leaving
  // orphaned blobs.
  const passportResult  = await validateFile('passport',         'Passport',        PDF_MAX, '2 MB', ['pdf'],          'PDF');
  if (passportResult instanceof NextResponse) return passportResult;
  const admissionResult = await validateFile('admission_letter', 'Admission letter', PDF_MAX, '2 MB', ['pdf'],          'PDF');
  if (admissionResult instanceof NextResponse) return admissionResult;
  const profileResult   = await validateFile('profile_picture',  'Profile photo',    IMG_MAX, '1 MB', ['jpeg', 'png'], 'JPEG or PNG image');
  if (profileResult instanceof NextResponse) return profileResult;

  async function saveFile(field: string, file: File, ext: string): Promise<string> {
    const filename = `${session!.userId}_${field}_${Date.now()}.${ext}`;
    const { url } = await put(filename, file, { access: 'public' });
    return url;
  }

  const passportFile  = await saveFile('passport',         passportResult.file,  'pdf');
  const admissionFile = await saveFile('admission_letter', admissionResult.file, 'pdf');
  const profileFile   = await saveFile('profile_picture',  profileResult.file,   profileResult.kind === 'png' ? 'png' : 'jpg');

  const fullName = formData.get('full_name') as string;

  try {
    await sql`
      INSERT INTO student_profiles (
        user_id, full_name, phone, country_of_origin, country_of_education,
        university_name, degree_level, course_name, intake_month, intake_year,
        city, gender, passport_url, admission_letter_url, profile_picture_url, consented_at
      ) VALUES (
        ${session.userId},
        ${fullName},
        ${phoneE164},
        ${formData.get('country_of_origin') as string},
        ${formData.get('country_of_education') as string},
        ${formData.get('university_name') as string},
        ${formData.get('degree_level') as string},
        ${courseName},
        ${formData.get('intake_month') as string},
        ${parseInt(formData.get('intake_year') as string, 10)},
        ${formData.get('city') as string},
        ${formData.get('gender') as string},
        ${passportFile},
        ${admissionFile},
        ${profileFile},
        NOW()
      )
    `;
  } catch (err) {
    log({ level: 'error', event: 'registration_error', message: 'Registration failed — server error during DB insert', email: session.email, userId: session.userId, route: '/api/student/register', metadata: { http_status: 500, error: String(err) } });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  // Form submitted — clear the 48-hour registration deadline so the account is
  // never purged by the abandoned-account cleanup.
  await sql`UPDATE users SET verification_expires = NULL WHERE id = ${session.userId}`;

  await sendRegistrationAcknowledgement(session.email, fullName);

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    sendAdminRegistrationNotification(adminEmail, fullName, session.email).catch(() => {});
  }

  return NextResponse.json({ message: 'Registration submitted successfully.' });
}
