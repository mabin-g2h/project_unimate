import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId))
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  if (userId === session.userId)
    return NextResponse.json({ error: 'Cannot remove your own admin role.' }, { status: 400 });

  const result = await sql`UPDATE users SET role = 'student' WHERE id = ${userId} AND role = 'admin'`;
  if (result.length === 0)
    return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
