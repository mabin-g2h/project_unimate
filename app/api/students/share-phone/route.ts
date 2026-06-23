import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { log } from '@/lib/logger';

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { share_phone } = await req.json() as { share_phone: boolean };

  try {
    await sql`
      UPDATE student_profiles SET share_phone = ${share_phone}
      WHERE user_id = ${session.userId}
    `;
  } catch (err) {
    log({ level: 'error', event: 'phone_toggle_failed', message: 'Failed to update phone sharing preference', userId: session.userId, route: '/api/students/share-phone', metadata: { share_phone, error: String(err) } });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
