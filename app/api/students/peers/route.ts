import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const meRows = await sql`
    SELECT country_of_education FROM student_profiles
    WHERE user_id = ${session.userId} AND status = 'approved'
  `;
  const me = meRows[0];
  if (!me) return NextResponse.json({ peers: [] });

  // Candidate pool: every approved student heading to my destination country.
  // All narrowing (university / city / course / intake / degree) happens client-side.
  const peers = await sql`
    SELECT sp.id, sp.full_name, sp.course_name, sp.degree_level,
           sp.intake_month, sp.intake_year, sp.country_of_origin,
           sp.university_name, sp.city, sp.profile_picture_url, u.email,
           CASE WHEN sp.share_phone THEN sp.phone ELSE NULL END AS phone,
           fd.departure_from, fd.arrival, fd.travel_date::text, fd.airline
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
    LEFT JOIN flight_details fd ON fd.user_id = sp.user_id
    WHERE sp.status = 'approved'
      AND sp.user_id != ${session.userId}
      AND sp.country_of_education = ${me.country_of_education}
    ORDER BY sp.full_name ASC
  `;

  return NextResponse.json({ peers });
}
