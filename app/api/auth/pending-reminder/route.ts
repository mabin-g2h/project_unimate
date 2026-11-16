import { sql } from '@/lib/db';
import { isCronAuthorized } from '@/lib/auth';
import { sendPendingReminderEmail, type PendingApplicant } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';

// Daily cron (vercel.json, ~10:00 IST): if any application is still pending, email every admin one
// digest; if none, do nothing. Gated by CRON_SECRET like /api/auth/cleanup (so it lives under the
// public /api/auth/ prefix, which middleware lets through without a session cookie).
export async function GET(request: Request) {
  if (!isCronAuthorized(request, '/api/auth/pending-reminder')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const pending = await sql`
    SELECT full_name, university_name, country_of_education, submitted_at
    FROM student_profiles
    WHERE status = 'pending'
    ORDER BY submitted_at ASC
  `;
  if (pending.length === 0) return Response.json({ pending: 0, sent: 0, failed: 0 });

  const applicants: PendingApplicant[] = pending.map(r => ({
    name: (r.full_name as string) || 'Unnamed applicant',
    university: (r.university_name as string) || 'University not given',
    country: (r.country_of_education as string) || 'Country not given',
    submittedAt: r.submitted_at as string,
  }));

  // ADMIN_EMAIL list + every admin account (invited admins), de-duplicated.
  const admins = await sql`SELECT email FROM users WHERE role = 'admin'`;
  const recipients = [...new Set([
    ...(process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
    ...admins.map(a => String(a.email).trim().toLowerCase()),
  ])];

  // Awaited and allSettled: Vercel freezes the function after the response, and one bad
  // address must not stop the others. Failures are logged by deliver() in lib/email.ts.
  const results = await Promise.allSettled(recipients.map(to => sendPendingReminderEmail(to, applicants)));
  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.length - sent;

  await log({
    level: failed > 0 ? 'warn' : 'info',
    event: 'pending_reminder_sent',
    category: 'admin',
    message: `Pending-application reminder: ${pending.length} pending, ${sent}/${recipients.length} admins emailed`,
    route: '/api/auth/pending-reminder',
    metadata: { pending: pending.length, recipients: recipients.length, sent, failed },
  });

  return Response.json({ pending: pending.length, sent, failed });
}
