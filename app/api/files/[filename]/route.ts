import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs/promises';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { filename } = await params;

  // Admin can view all; profile pictures are visible to any authenticated student (peer directory);
  // all other files (passport, admission letter) are owner-only.
  if (session.role !== 'admin') {
    const isProfilePicture = filename.includes('_profile_picture_');
    if (!isProfilePicture) {
      const ownerId = filename.split('_')[0];
      if (ownerId !== String(session.userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  const filePath = path.join(process.cwd(), 'private_uploads', filename);
  try {
    const buffer = await fs.readFile(filePath);
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'pdf' ? 'application/pdf' :
      ext === 'png' ? 'image/png' : 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
