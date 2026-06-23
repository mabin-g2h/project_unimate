import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const email = searchParams.get('email')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const [{ count }] = email
    ? await sql`SELECT COUNT(*)::int AS count FROM student_error_logs WHERE email ILIKE ${'%' + email + '%'}`
    : await sql`SELECT COUNT(*)::int AS count FROM student_error_logs`;

  const logs = email
    ? await sql`
        SELECT id, level, event, message, email, route, metadata, created_at
        FROM student_error_logs
        WHERE email ILIKE ${'%' + email + '%'}
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
    : await sql`
        SELECT id, level, event, message, email, route, metadata, created_at
        FROM student_error_logs
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;

  return NextResponse.json({ logs, total: count, page });
}
