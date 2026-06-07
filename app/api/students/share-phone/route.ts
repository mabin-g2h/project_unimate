import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { share_phone } = await req.json() as { share_phone: boolean };

  await sql`
    UPDATE student_profiles SET share_phone = ${share_phone}
    WHERE user_id = ${session.userId}
  `;

  return NextResponse.json({ ok: true });
}
