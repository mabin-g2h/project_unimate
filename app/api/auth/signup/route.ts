import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { sql } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    // Purge abandoned student accounts (expired verification link, or verified
    // but no registration form submitted within the 48-hour window) so this
    // email can register fresh. Submitted profiles + admins have
    // verification_expires = NULL, so they never match.
    await sql`
      DELETE FROM users
      WHERE role = 'student'
        AND verification_expires IS NOT NULL
        AND verification_expires < NOW()
        AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = users.id)
    `;

    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'student';

    await sql`
      INSERT INTO users (email, password_hash, verification_token, verification_expires, role)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${verificationToken}, ${verificationExpires}, ${role})
    `;

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
      // Account is created — return success but warn user to check spam or retry
    }

    return NextResponse.json({ message: 'Account created. Please check your email to verify.' });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
