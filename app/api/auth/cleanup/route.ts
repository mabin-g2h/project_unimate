import { timingSafeEqual } from 'crypto';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const incoming = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  const valid =
    incoming.length === expected.length &&
    timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Purge abandoned student accounts: an expired verification link (never
  // verified) OR a verified account that never submitted the registration form
  // within its 48-hour window. Submitted profiles + admins have
  // verification_expires = NULL, so they never match.
  const deleted = await sql`
    WITH removed AS (
      DELETE FROM users
      WHERE role = 'student'
        AND verification_expires IS NOT NULL
        AND verification_expires < NOW()
        AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = users.id)
      RETURNING id
    )
    SELECT COUNT(*)::int AS n FROM removed
  `;

  return Response.json({ deleted: deleted[0]?.n ?? 0 });
}
