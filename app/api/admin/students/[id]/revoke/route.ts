import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendRevokeEmail, sendUnrevokeEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, reason } = await request.json();
  if (!['revoke', 'unrevoke'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (action === 'revoke' && !reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required to revoke access.' }, { status: 400 });
  }
  const sanitisedReason = action === 'revoke' ? (reason as string).trim().slice(0, 500) : null;

  const { id } = await params;
  const profileId = parseInt(id, 10);

  const expectedStatus = action === 'revoke' ? 'approved' : 'revoked';
  const newStatus = action === 'revoke' ? 'revoked' : 'approved';

  const result = action === 'revoke'
    ? await sql`
        UPDATE student_profiles
        SET status = 'revoked', revoke_reason = ${sanitisedReason}
        WHERE id = ${profileId} AND status = ${expectedStatus}
        RETURNING id, user_id
      `
    : await sql`
        UPDATE student_profiles
        SET status = 'approved', revoke_reason = NULL
        WHERE id = ${profileId} AND status = ${expectedStatus}
        RETURNING id, user_id
      `;

  if (!result.length) {
    return NextResponse.json({ error: 'Student not found or not in expected state.' }, { status: 400 });
  }

  const [student] = await sql`
    SELECT u.email, sp.full_name
    FROM users u JOIN student_profiles sp ON sp.user_id = u.id
    WHERE u.id = ${result[0].user_id as number}
  `;

  if (student?.email && student?.full_name) {
    if (action === 'revoke') {
      try { await sendRevokeEmail(student.email as string, student.full_name as string, sanitisedReason!); } catch { /* email failure doesn't block the revoke */ }
    } else {
      try { await sendUnrevokeEmail(student.email as string, student.full_name as string); } catch { /* email failure doesn't block the unrevoke */ }
    }
  }

  return NextResponse.json({ ok: true, newStatus });
}
