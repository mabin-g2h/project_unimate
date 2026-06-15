import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const students = await sql`
    SELECT
      u.id AS user_id, u.email, u.created_at,
      sp.id AS profile_id, sp.full_name, sp.phone,
      sp.country_of_origin, sp.country_of_education,
      sp.university_name, sp.degree_level, sp.course_name,
      sp.intake_month, sp.intake_year,
      sp.passport_url, sp.admission_letter_url, sp.profile_picture_url,
      sp.status, sp.submitted_at, sp.rejection_reason, sp.city, sp.gender
    FROM users u
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    WHERE u.role = 'student'
    ORDER BY
      CASE sp.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      sp.submitted_at DESC NULLS LAST
  `;

  return NextResponse.json({ students });
}
