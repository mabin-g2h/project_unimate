import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signToken, makeSessionCookieOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const [user] = await sql`
      SELECT id, email, password_hash, email_verified, role
      FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (!user.email_verified) {
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
