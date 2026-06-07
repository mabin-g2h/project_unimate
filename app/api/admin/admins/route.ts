import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendAdminInviteEmail } from '@/lib/email';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [admins, invites] = await Promise.all([
    sql`SELECT id, email, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC`,
    sql`SELECT id, email, expires_at, created_at FROM admin_invites ORDER BY created_at DESC`,
  ]);

  return NextResponse.json({ admins, invites });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email } = await req.json();
  if (!email?.trim())
    return NextResponse.json({ error: 'Email required.' }, { status: 400 });

  const normalised = email.trim().toLowerCase();

  const [existing] = await sql`SELECT id, role FROM users WHERE email = ${normalised}`;
  if (existing) {
    if (existing.role === 'admin')
      return NextResponse.json({ error: 'This email is already an admin.' }, { status: 409 });
    return NextResponse.json({ error: 'This email already has a student account.' }, { status: 409 });
  }

  const [pendingInvite] = await sql`SELECT id FROM admin_invites WHERE email = ${normalised}`;
  if (pendingInvite)
    return NextResponse.json({ error: 'An invite has already been sent to this email.' }, { status: 409 });

  const token = uuid();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await sql`
    INSERT INTO admin_invites (email, token, expires_at, invited_by)
    VALUES (${normalised}, ${token}, ${expiresAt.toISOString()}, ${session.userId})
  `;

  const inviteUrl = `${process.env.APP_URL}/accept-invite?token=${token}`;
  sendAdminInviteEmail(normalised, inviteUrl).catch(console.error);

  return NextResponse.json({ ok: true }, { status: 201 });
}
