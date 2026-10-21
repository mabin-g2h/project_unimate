import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signToken, makeSessionCookieOptions } from '@/lib/auth';
import { log } from '@/lib/logger';
import { clientIp, ipMax, retryAfter, recordHit, clearLimit, tooMany } from '@/lib/rate-limit';

// Failed attempts only: 5 per email and 20 per IP in 15 minutes. Checked before bcrypt.
const WINDOW = 15 * 60;
const EMAIL_MAX = 5;
const IP_MAX = 20;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const emailKey = `login:email:${(email as string).toLowerCase()}`;
    const ipKey = `login:ip:${clientIp(request)}`;
    const wait = Math.max(await retryAfter(emailKey, EMAIL_MAX, WINDOW), await retryAfter(ipKey, ipMax(IP_MAX), WINDOW));
    if (wait > 0) {
      log({ level: 'warn', event: 'login_rate_limited', category: 'auth', message: 'Login blocked - too many failed attempts', email: (email as string).toLowerCase(), route: '/api/auth/login', metadata: { http_status: 429, retry_after: wait } });
      return tooMany(wait);
    }

    const [user] = await sql`
      SELECT id, email, password_hash, email_verified, role, token_version
      FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (!user) {
      await Promise.all([recordHit(emailKey, WINDOW), recordHit(ipKey, WINDOW)]);
      log({ level: 'warn', event: 'login_failed', category: 'auth', message: 'Login attempt with unknown email', email: (email as string).toLowerCase(), route: '/api/auth/login', metadata: { http_status: 401 } });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await Promise.all([recordHit(emailKey, WINDOW), recordHit(ipKey, WINDOW)]);
      log({ level: 'warn', event: 'login_failed', category: 'auth', message: 'Login failed — incorrect password', email: user.email, userId: user.id, route: '/api/auth/login', metadata: { http_status: 401 } });
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.email_verified) {
      log({ level: 'warn', event: 'login_unverified_email', category: 'auth', message: 'Login attempt with unverified email', email: user.email, userId: user.id, route: '/api/auth/login', metadata: { http_status: 403 } });
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
      tv: user.token_version,
    });
    await clearLimit(emailKey);

    await log({ level: 'info', event: 'login_success', category: 'auth', message: 'Logged in', email: user.email, userId: user.id, route: '/api/auth/login', metadata: { role: user.role } });

    const response = NextResponse.json({ role: user.role });
    response.cookies.set('auth-token', token, makeSessionCookieOptions());
    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
