import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

const PAGE_SIZE = 25;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const email    = searchParams.get('email')?.trim() || null;
  const level    = searchParams.get('level')?.trim() || null;
  const category = searchParams.get('category')?.trim() || null;
  const event    = searchParams.get('event')?.trim() || null;
  const from     = searchParams.get('from')?.trim() || null; // YYYY-MM-DD, inclusive
  const to       = searchParams.get('to')?.trim() || null;   // YYYY-MM-DD, inclusive
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
  }

  const emailPattern = email ? '%' + email + '%' : null;

  // Every filter is a no-op when its param is NULL, so one parameterised query
  // serves all combinations. Rows written before the `category` column existed
  // have it NULL, so the inner select derives one from the event name.
  const rows = await sql`
    SELECT *, COUNT(*) OVER()::int AS total FROM (
      SELECT id, level, event, message, email, actor_email, user_id, route, metadata, created_at,
             COALESCE(category, CASE
               WHEN event IN ('login_failed','login_unverified_email','signup_email_exists','verification_link_invalid','verification_link_expired') THEN 'auth'
               WHEN event IN ('registration_failed','registration_error') THEN 'registration'
               WHEN event = 'email_send_failed' THEN 'email'
               ELSE 'dashboard' END) AS category
      FROM student_error_logs
    ) t
    WHERE (${emailPattern}::text IS NULL OR email ILIKE ${emailPattern})
      AND (${level}::text IS NULL OR level = ${level})
      AND (${category}::text IS NULL OR category = ${category})
      AND (${event}::text IS NULL OR event = ${event})
      AND (${from}::text IS NULL OR created_at >= ${from}::date)
      AND (${to}::text IS NULL OR created_at < ${to}::date + 1)
    ORDER BY created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const total = rows[0]?.total ?? 0;
  const logs = rows.map(row => {
    const copy = { ...row };
    delete copy.total;
    return copy;
  });
  return NextResponse.json({ logs, total, page });
}
