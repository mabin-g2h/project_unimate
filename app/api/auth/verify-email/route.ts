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
    return NextResponse.redirect(new URL('/verify-email?error=expired', request.url));
  }

  await sql`
    UPDATE users
    SET email_verified = true, verification_token = NULL, verification_expires = NULL
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
