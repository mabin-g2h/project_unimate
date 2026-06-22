import { sql } from '@/lib/db';
import { sendAccountExpiredEmail } from '@/lib/email';

// Archive every approved student whose access has expired (expiry_date < NOW()).
// Shared by the daily cleanup cron and the admin "Archive expired students" button.
// The status='approved' guard makes this idempotent: an already-archived row never
// re-matches, so the expiry email is sent exactly once per student.
export async function archiveExpiredStudents(): Promise<number> {
  const archived = await sql`
    UPDATE student_profiles sp
    SET status = 'archived', archived_at = NOW()
    FROM users u
    WHERE u.id = sp.user_id
      AND sp.status = 'approved'
      AND sp.expiry_date IS NOT NULL
      AND sp.expiry_date < NOW()
    RETURNING u.email, sp.full_name
  `;

  if (archived.length) {
    // Secondary sends — never block on a failing mailbox.
    await Promise.allSettled(
      archived.map(r => sendAccountExpiredEmail(r.email, r.full_name ?? ''))
    );
  }

  return archived.length;
}
