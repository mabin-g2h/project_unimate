import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const profileId = parseInt(id, 10);
  if (isNaN(profileId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json();

  await sql`
    UPDATE student_profiles
    SET
      full_name            = ${body.full_name ?? null},
      phone                = ${body.phone ?? null},
      country_of_origin    = ${body.country_of_origin ?? null},
      country_of_education = ${body.country_of_education ?? null},
      university_name      = ${body.university_name ?? null},
      degree_level         = ${body.degree_level ?? null},
      course_name          = ${body.course_name ?? null},
      intake_month         = ${body.intake_month ?? null},
      intake_year          = ${body.intake_year ? parseInt(body.intake_year, 10) : null},
      city                 = ${body.city ?? null}
    WHERE id = ${profileId}
  `;

  const [updated] = await sql`
    SELECT id AS profile_id, full_name, phone, country_of_origin, country_of_education,
           university_name, degree_level, course_name, intake_month, intake_year, city, status
    FROM student_profiles
    WHERE id = ${profileId}
  `;
  if (!updated) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  return NextResponse.json({ profile: updated });
}
