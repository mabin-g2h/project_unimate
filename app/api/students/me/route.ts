import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT sp.full_name, sp.university_name, sp.degree_level, sp.course_name,
           sp.intake_month, sp.intake_year, sp.country_of_origin,
           sp.country_of_education, sp.city,
           sp.profile_picture_url, sp.phone, sp.share_phone,
           fd.departure_from, fd.arrival, fd.travel_date::text, fd.airline
    FROM student_profiles sp
    LEFT JOIN flight_details fd ON fd.user_id = sp.user_id
    WHERE sp.user_id = ${session.userId} AND sp.status = 'approved'
  `;

  const profile = rows[0] ?? null;
  return NextResponse.json({ profile });
}
