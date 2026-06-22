import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { archiveExpiredStudents } from '@/lib/archive';

export const runtime = 'nodejs';

// Admin-triggered sweep: archive every approved student whose access has expired.
// Same logic the daily cron runs — exposed as a button so admins can act on demand.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const archived = await archiveExpiredStudents();
  return NextResponse.json({ archived });
}
