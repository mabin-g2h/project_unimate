import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendRegistrationAcknowledgement, sendAdminRegistrationNotification } from '@/lib/email';
import { put } from '@vercel/blob';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // If rejected before, allow re-apply by deleting old profile
  await sql`DELETE FROM student_profiles WHERE user_id = ${session.userId} AND status = 'rejected'`;

  const [existing] = await sql`SELECT id FROM student_profiles WHERE user_id = ${session.userId}`;
  if (existing) return NextResponse.json({ error: 'You have already submitted a registration.' }, { status: 409 });

  const formData = await request.formData();

  const allConsentsAccepted = formData.get('consents_accepted') === 'true';
  if (!allConsentsAccepted) {
    return NextResponse.json({ error: 'All consents are required.' }, { status: 400 });
  }

  // Required field validation (course is now free text — must not be blank)
  const required = [
    'full_name', 'country_of_origin', 'country_of_education',
    'university_name', 'degree_level', 'course_name',
    'intake_month', 'intake_year', 'city', 'gender',
  ];
  for (const field of required) {
    if (!((formData.get(field) as string) ?? '').trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }
  const courseName = ((formData.get('course_name') as string) ?? '').trim().replace(/\s+/g, ' ');

  // Validate + normalise phone to E.164 (format-only check, no SMS/OTP)
  const parsedPhone = parsePhoneNumberFromString(((formData.get('phone') as string) ?? '').trim());
  if (!parsedPhone || !parsedPhone.isValid()) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 });
  }
  const phoneE164 = parsedPhone.number;

  const PDF_MAX = 2 * 1024 * 1024; // 2 MB
  const IMG_MAX = 1 * 1024 * 1024; // 1 MB

  async function saveFile(field: string, allowed: string[], maxBytes: number): Promise<string | null> {
    const file = formData.get(field) as File | null;
    if (!file || file.size === 0) return null;
    if (file.size > maxBytes) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed.includes(ext)) return null;
    const filename = `${session!.userId}_${field}_${Date.now()}.${ext}`;
    const { url } = await put(filename, file, { access: 'public' });
    return url;
  }

  // Enforce size limits before uploading
  const passportRaw  = formData.get('passport')        as File | null;
  const admissionRaw = formData.get('admission_letter') as File | null;
  const profileRaw   = formData.get('profile_picture')  as File | null;
  if (passportRaw  && passportRaw.size  > PDF_MAX) return NextResponse.json({ error: 'Passport PDF must be 2 MB or smaller.' },        { status: 400 });
  if (admissionRaw && admissionRaw.size > PDF_MAX) return NextResponse.json({ error: 'Admission letter PDF must be 2 MB or smaller.' }, { status: 400 });
  if (profileRaw   && profileRaw.size   > IMG_MAX) return NextResponse.json({ error: 'Profile photo must be 1 MB or smaller.' },        { status: 400 });

  const passportFile = await saveFile('passport',        ['pdf'],              PDF_MAX);
  const admissionFile = await saveFile('admission_letter', ['pdf'],            PDF_MAX);
  const profileFile  = await saveFile('profile_picture', ['jpg','jpeg','png'], IMG_MAX);

  const fullName = formData.get('full_name') as string;

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

  await sendRegistrationAcknowledgement(session.email, fullName);

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    sendAdminRegistrationNotification(adminEmail, fullName, session.email).catch(() => {});
  }

  return NextResponse.json({ message: 'Registration submitted successfully.' });
}
