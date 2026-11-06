import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { log } from '@/lib/logger';

// POST — mark the first-visit dashboard tour as seen (finished or skipped).
// Idempotent: the first call stamps onboarded_at, later calls keep the original time.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { outcome?: unknown; step?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const outcome = body.outcome;
  if (outcome !== 'completed' && outcome !== 'skipped') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const step = typeof body.step === 'number' && Number.isInteger(body.step) && body.step >= 0 && body.step <= 50 ? body.step : null;

  try {
    const rows = await sql`
      UPDATE student_profiles SET onboarded_at = COALESCE(onboarded_at, NOW())
      WHERE user_id = ${session.userId} AND status = 'approved'
      RETURNING id
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  } catch (err) {
    await log({ level: 'error', event: 'tour_save_failed', message: 'Failed to save dashboard tour progress', category: 'dashboard', email: session.email, userId: session.userId, route: '/api/students/onboarded', metadata: { outcome, error: String(err) } });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  await log({
    level: 'info',
    event: outcome === 'completed' ? 'tour_completed' : 'tour_skipped',
    message: outcome === 'completed' ? 'Student finished the dashboard tour' : 'Student skipped the dashboard tour',
    category: 'dashboard',
    email: session.email,
    userId: session.userId,
    route: '/api/students/onboarded',
    metadata: { outcome, step },
  });
  return NextResponse.json({ ok: true });
}
