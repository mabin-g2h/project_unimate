import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Files are now served directly from Vercel Blob public URLs.
// This route is no longer used for new uploads.
export async function GET() {
  return NextResponse.json({ error: 'Gone — files are served from Vercel Blob.' }, { status: 410 });
}
