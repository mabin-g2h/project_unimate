import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { signToken, makeSessionCookieOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/verify-email?error=invalid', request.url));
  }

  const [user] = await sql`
    SELECT id, email, role, verification_expires
    FROM users
    WHERE verification_token = ${token} AND email_verified = false
  `;

  if (!user) {
    return NextResponse.redirect(new URL('/verify-email?error=invalid', request.url));
  }

  if (new Date(user.verification_expires) < new Date()) {
    await sql`DELETE FROM users WHERE id = ${user.id}`;
    return NextResponse.redirect(new URL('/verify-email?error=expired', request.url));
  }

  // Students get a 48-hour window to complete the registration form; if they
  // never submit, the no-form account is purged (cron + inline-on-signup) so the
  // email is freed to register again. Admins never get a deadline.
  const formDeadline =
    user.role === 'student' ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null;

  await sql`
    UPDATE users
    SET email_verified = true, verification_token = NULL, verification_expires = ${formDeadline}
    WHERE id = ${user.id}
  `;

  const jwt = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    emailVerified: true,
  });

  const dest = user.role === 'admin' ? '/admin' : '/register';
  const response = NextResponse.redirect(new URL(dest, request.url));
  response.cookies.set('auth-token', jwt, makeSessionCookieOptions());
  return response;
}
