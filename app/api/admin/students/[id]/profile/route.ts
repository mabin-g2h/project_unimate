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

  const VALID_DEGREES = ["Bachelor's Degree","Postgraduate Certificate","Postgraduate Diploma","Master's Degree","PhD / Doctorate","Professional Degree","Other"];
  const VALID_MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const VALID_GENDERS = ['Male','Female'];

  if (body.degree_level && !VALID_DEGREES.includes(body.degree_level))
    return NextResponse.json({ error: 'Invalid degree level.' }, { status: 400 });
  if (body.intake_month && !VALID_MONTHS.includes(body.intake_month))
    return NextResponse.json({ error: 'Invalid intake month.' }, { status: 400 });
  if (body.gender && !VALID_GENDERS.includes(body.gender))
    return NextResponse.json({ error: 'Invalid gender.' }, { status: 400 });
  if (body.intake_year) {
    const yr = parseInt(body.intake_year, 10);
    if (isNaN(yr) || yr < 2024 || yr > 2035)
      return NextResponse.json({ error: 'Intake year must be between 2024 and 2035.' }, { status: 400 });
  }

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
      city                 = ${body.city ?? null},
      gender               = ${body.gender ?? null}
    WHERE id = ${profileId}
  `;

  const [updated] = await sql`
    SELECT id AS profile_id, full_name, phone, country_of_origin, country_of_education,
           university_name, degree_level, course_name, intake_month, intake_year, city, gender, status
    FROM student_profiles
    WHERE id = ${profileId}
  `;
  if (!updated) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  return NextResponse.json({ profile: updated });
}
