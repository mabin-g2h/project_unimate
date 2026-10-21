import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

const EVENT_CAP = 500;

// Everything an admin needs to answer "what happened to this student?":
// a snapshot from the live tables (works even for students who pre-date the
// activity log) plus the chronological log trail for that exact email.
// Never returns password hashes, tokens or document URLs.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email is required.' }, { status: 400 });

  const [summary] = await sql`
    SELECT u.email, u.role, u.email_verified, u.created_at AS account_created_at,
           sp.id AS profile_id, sp.full_name, sp.status, sp.submitted_at, sp.consented_at,
           sp.reviewed_at, sp.rejection_reason, sp.revoke_reason,
           sp.university_name, sp.country_of_education,
           sp.course_start_date, sp.expiry_date, sp.archived_at
    FROM users u
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    WHERE LOWER(u.email) = ${email}
  `;

  // Oldest first, capped to the most recent EVENT_CAP entries.
  const events = await sql`
    SELECT * FROM (
      SELECT id, level, event, message, email, actor_email, route, metadata, created_at,
             COALESCE(category, CASE
               WHEN event IN ('login_failed','login_unverified_email','signup_email_exists','verification_link_invalid','verification_link_expired') THEN 'auth'
               WHEN event IN ('registration_failed','registration_error') THEN 'registration'
               WHEN event = 'email_send_failed' THEN 'email'
               ELSE 'dashboard' END) AS category
      FROM student_error_logs
      WHERE LOWER(email) = ${email}
      ORDER BY created_at DESC
      LIMIT ${EVENT_CAP}
    ) recent
    ORDER BY created_at ASC
  `;

  return NextResponse.json({ summary: summary ?? null, events });
}
