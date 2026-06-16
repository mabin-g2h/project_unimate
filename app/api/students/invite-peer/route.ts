import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendPeerInviteEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAILY_LIMIT = 10;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email } = (await req.json()) as { email?: string };
  const normalised = (email ?? '').trim().toLowerCase();

  if (!normalised || !EMAIL_RE.test(normalised)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Self-invite guard
  if (normalised === session.email.toLowerCase()) {
    return NextResponse.json({ error: "That's your own email address." }, { status: 400 });
  }

  // Existing-user guard — don't email people who already have an account
  const existing = await sql`SELECT 1 FROM users WHERE email = ${normalised} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'This person already has a UniMate account.' }, { status: 409 });
  }

  // Recent-dedup guard — don't let the same student re-spam the same address
  const recent = await sql`
    SELECT 1 FROM peer_invites
    WHERE email = ${normalised} AND invited_by = ${session.userId}
      AND created_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  `;
  if (recent.length > 0) {
    return NextResponse.json({ error: 'You already invited this peer recently.' }, { status: 409 });
  }

  // Daily cap per student
  const todays = await sql`
    SELECT COUNT(*)::int AS count FROM peer_invites
    WHERE invited_by = ${session.userId}
      AND created_at > NOW() - INTERVAL '1 day'
  `;
  if ((todays[0]?.count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `You've reached the daily limit of ${DAILY_LIMIT} invites. Try again tomorrow.` },
      { status: 429 },
    );
  }

  // Inviter identity for the email body
  const profile = await sql`
    SELECT full_name, university_name FROM student_profiles WHERE user_id = ${session.userId} LIMIT 1
  `;
  const inviterName: string = profile[0]?.full_name ?? 'A peer';
  const universityName: string | null = profile[0]?.university_name ?? null;

  await sql`INSERT INTO peer_invites (email, invited_by) VALUES (${normalised}, ${session.userId})`;

  try {
    await sendPeerInviteEmail(normalised, inviterName, universityName);
  } catch (err) {
    console.error('Failed to send peer invite email:', err);
    return NextResponse.json(
      { error: "We couldn't send the invitation right now. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
