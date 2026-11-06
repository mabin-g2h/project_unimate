import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendSupportRequestEmail } from '@/lib/email';
import { clientIp, hitAndCheck, ipMax, tooMany } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

const MAX_LEN = 2000;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let message = '';
  try {
    const body = (await req.json()) as { message?: unknown };
    message = typeof body.message === 'string' ? body.message.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Please describe your issue.' }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: 'Please describe your issue.' }, { status: 400 });
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `Please keep your message under ${MAX_LEN} characters.` }, { status: 400 });
  }

  const profile = await sql`
    SELECT full_name, university_name, country_of_education
    FROM student_profiles
    WHERE user_id = ${session.userId} AND status = 'approved'
    LIMIT 1
  `;
  if (profile.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const wait = await hitAndCheck([
    { key: `support:user:${session.userId}`, max: 5, windowSec: 3600 },
    { key: `support:ip:${clientIp(req)}`, max: ipMax(20), windowSec: 3600 },
  ]);
  if (wait > 0) return tooMany(wait);

  try {
    await sendSupportRequestEmail({
      name: profile[0].full_name,
      email: session.email,
      university: profile[0].university_name ?? null,
      country: profile[0].country_of_education ?? null,
      message,
    });
  } catch {
    await log({ level: 'error', event: 'support_request_failed', category: 'dashboard', message: 'Help request could not be emailed', email: session.email, userId: session.userId, route: '/api/students/support' });
    return NextResponse.json(
      { error: "We couldn't send your message right now. Please try again in a few minutes." },
      { status: 502 },
    );
  }

  // Length only — the message text is never logged or stored.
  await log({ level: 'info', event: 'support_request_sent', category: 'dashboard', message: 'Help request sent to support', email: session.email, userId: session.userId, route: '/api/students/support', metadata: { length: message.length } });
  return NextResponse.json({ ok: true });
}
