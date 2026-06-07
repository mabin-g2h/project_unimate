import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signToken, makeSessionCookieOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password)
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });

  if (password.length < 8)
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });

  const [invite] = await sql`SELECT * FROM admin_invites WHERE token = ${token}`;
  if (!invite)
    return NextResponse.json({ error: 'Invalid or already used invitation.' }, { status: 404 });

  if (new Date(invite.expires_at) < new Date()) {
    await sql`DELETE FROM admin_invites WHERE id = ${invite.id}`;
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  const [existingUser] = await sql`SELECT id FROM users WHERE email = ${invite.email}`;
  if (existingUser)
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await sql`
    INSERT INTO users (email, password_hash, email_verified, role)
    VALUES (${invite.email}, ${passwordHash}, true, 'admin')
    RETURNING id, email, role
  `;

  await sql`DELETE FROM admin_invites WHERE id = ${invite.id}`;

  const jwtToken = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    emailVerified: true,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set('auth-token', jwtToken, makeSessionCookieOptions());
  return response;
}
