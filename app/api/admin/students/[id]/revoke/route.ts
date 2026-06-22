import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action } = await request.json();
  if (!['revoke', 'unrevoke'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { id } = await params;
  const profileId = parseInt(id, 10);

  const expectedStatus = action === 'revoke' ? 'approved' : 'revoked';
  const newStatus = action === 'revoke' ? 'revoked' : 'approved';

  const result = await sql`
    UPDATE student_profiles
    SET status = ${newStatus}
    WHERE id = ${profileId} AND status = ${expectedStatus}
    RETURNING id
  `;

  if (!result.length) {
    return NextResponse.json({ error: 'Student not found or not in expected state.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, newStatus });
}
