import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signToken, makeSessionCookieOptions } from '@/lib/auth';
import { log } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const [user] = await sql`
      SELECT id, email, password_hash, email_verified, role
      FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (!user) {
      log({ level: 'warn', event: 'login_failed', message: 'Login attempt with unknown email', email: (email as string).toLowerCase(), route: '/api/auth/login', metadata: { http_status: 401 } });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      log({ level: 'warn', event: 'login_failed', message: 'Login failed — incorrect password', email: user.email, userId: user.id, route: '/api/auth/login', metadata: { http_status: 401 } });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.email_verified) {
      log({ level: 'warn', event: 'login_unverified_email', message: 'Login attempt with unverified email', email: user.email, userId: user.id, route: '/api/auth/login', metadata: { http_status: 403 } });
      return NextResponse.json(
        { error: 'Please verify your email before logging in.', code: 'UNVERIFIED' },
        { status: 403 }
      );
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: true,
    });

    const response = NextResponse.json({ role: user.role });
    response.cookies.set('auth-token', token, makeSessionCookieOptions());
    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
