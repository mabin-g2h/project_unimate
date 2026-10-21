import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { log } from '@/lib/logger';
import { clientIp, ipMax, hitAndCheck, tooMany } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    // Token guessing guard: 10 attempts/hour per IP.
    const wait = await hitAndCheck([{ key: `reset:ip:${clientIp(request)}`, max: ipMax(10), windowSec: 3600 }]);
    if (wait > 0) return tooMany(wait);

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const [user] = await sql`
      SELECT id, email, password_reset_expires
      FROM users
      WHERE password_reset_token = ${token}
    `;

    if (!user) {
      return NextResponse.json({ error: 'This reset link is invalid or has already been used.' }, { status: 400 });
    }

    if (new Date(user.password_reset_expires) < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          password_reset_token = NULL,
          password_reset_expires = NULL,
          token_version = token_version + 1
      WHERE id = ${user.id}
    `;

    await log({ level: 'info', event: 'password_reset_completed', category: 'auth', message: 'Password changed via reset link', email: user.email, userId: user.id, route: '/api/auth/reset-password' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Reset-password error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
