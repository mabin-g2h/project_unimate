import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { log } from '@/lib/logger';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const removed = await sql`DELETE FROM admin_invites WHERE id = ${id} RETURNING email`;
  if (removed.length) {
    await log({ level: 'info', event: 'invite_revoked', category: 'admin', message: 'Pending admin invitation revoked', email: removed[0].email, actorEmail: session.email, route: '/api/admin/admins/invite/[id]' });
  }
  return new NextResponse(null, { status: 204 });
}
