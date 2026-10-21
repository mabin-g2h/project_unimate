import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { sql } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    const [user] = await sql`
      SELECT id, email_verified
      FROM users
      WHERE email = ${(email as string).toLowerCase()}
    `;

    if (user && user.email_verified) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await sql`
        UPDATE users
        SET password_reset_token = ${token}, password_reset_expires = ${expires.toISOString()}
        WHERE id = ${user.id}
      `;

      await log({ level: 'info', event: 'password_reset_requested', category: 'auth', message: 'Password reset link requested', email: (email as string).toLowerCase(), userId: user.id, route: '/api/auth/forgot-password' });

      try {
        await sendPasswordResetEmail(email, token);
      } catch {
        // failure is logged by lib/email.ts deliver(); still return 200 to avoid enumeration
      }
    }

    // Always return 200 to prevent email enumeration
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Forgot-password error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
