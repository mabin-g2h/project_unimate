import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendRegistrationAcknowledgement } from '@/lib/email';
import path from 'path';
import fs from 'fs/promises';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // If rejected before, allow re-apply by deleting old profile
  await sql`DELETE FROM student_profiles WHERE user_id = ${session.userId} AND status = 'rejected'`;

  const [existing] = await sql`SELECT id FROM student_profiles WHERE user_id = ${session.userId}`;
  if (existing) return NextResponse.json({ error: 'You have already submitted a registration.' }, { status: 409 });

  const formData = await request.formData();
  const uploadDir = path.join(process.cwd(), 'private_uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  async function saveFile(field: string, allowed: string[]): Promise<string | null> {
    const file = formData.get(field) as File | null;
    if (!file || file.size === 0) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed.includes(ext)) return null;
    const filename = `${session!.userId}_${field}_${Date.now()}.${ext}`;
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
    return filename;
  }

  const passportFile = await saveFile('passport', ['pdf']);
  const admissionFile = await saveFile('admission_letter', ['pdf']);
  const profileFile = await saveFile('profile_picture', ['jpg', 'jpeg', 'png']);

  const fullName = formData.get('full_name') as string;

  await sql`
    INSERT INTO student_profiles (
      user_id, full_name, phone, country_of_origin, country_of_education,
      university_name, degree_level, course_name, intake_month, intake_year,
      passport_url, admission_letter_url, profile_picture_url
    ) VALUES (
      ${session.userId},
      ${fullName},
      ${formData.get('phone') as string},
      ${formData.get('country_of_origin') as string},
      ${formData.get('country_of_education') as string},
      ${formData.get('university_name') as string},
      ${formData.get('degree_level') as string},
      ${formData.get('course_name') as string},
      ${formData.get('intake_month') as string},
      ${parseInt(formData.get('intake_year') as string, 10)},
      ${passportFile},
      ${admissionFile},
      ${profileFile}
    )
  `;

  await sendRegistrationAcknowledgement(session.email, fullName);

  return NextResponse.json({ message: 'Registration submitted successfully.' });
}
