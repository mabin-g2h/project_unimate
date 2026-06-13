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
