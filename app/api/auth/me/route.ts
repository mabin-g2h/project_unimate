import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const [user] = await sql`
    SELECT u.id, u.email, u.role, u.email_verified,
           sp.id        AS profile_id,
           sp.status    AS registration_status,
           sp.full_name,
           sp.rejection_reason
    FROM users u
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    WHERE u.id = ${session.userId}
  `;

  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
