import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { sql } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

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

      // fire-and-forget
      sendPasswordResetEmail(email, token).catch(() => {});
    }

    // Always return 200 to prevent email enumeration
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Forgot-password error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
