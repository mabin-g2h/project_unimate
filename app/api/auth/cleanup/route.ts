import { sql } from '@/lib/db';

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const deleted = await sql`
    WITH removed AS (
      DELETE FROM users
      WHERE email_verified = false AND verification_expires < NOW()
      RETURNING id
    )
    SELECT COUNT(*)::int AS n FROM removed
  `;

  return Response.json({ deleted: deleted[0]?.n ?? 0 });
}
