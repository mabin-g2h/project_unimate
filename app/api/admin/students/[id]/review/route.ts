import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendApprovalEmail, sendRejectionEmail, sendNewPeerNotificationEmail } from '@/lib/email';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';

// Best-effort: add an approved student's (admin-confirmed) university/city to the
// reference tables so the country-scoped dropdowns grow accurately over time.
// Case-insensitive, country-scoped existence check prevents near-duplicate rows;
// ON CONFLICT guards the exact-match race. Never throws — directory growth is a
// secondary effect and must not block an approval.
async function ensureUniversity(value: string, country: string) {
  const name = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!name || !country?.trim()) return;
  try {
    const existing = await sql`
      SELECT 1 FROM universities WHERE LOWER(name) = LOWER(${name}) AND country = ${country} LIMIT 1
    `;
    if (existing.length) return;
    await sql`
      INSERT INTO universities (name, country) VALUES (${name}, ${country})
      ON CONFLICT (name, country) DO NOTHING
    `;
  } catch { /* best-effort */ }
}

async function ensureCity(value: string, country: string) {
  const label = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!label || !country?.trim()) return;
  try {
    const existing = await sql`
      SELECT 1 FROM cities WHERE LOWER(label) = LOWER(${label}) AND country = ${country} LIMIT 1
    `;
    if (existing.length) return;
    await sql`
      INSERT INTO cities (label, country) VALUES (${label}, ${country})
      ON CONFLICT (label, country) DO NOTHING
    `;
  } catch { /* best-effort */ }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, rejection_reason } = await request.json();
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (action === 'reject' && !rejection_reason?.trim()) {
    return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
  }

  const { id } = await params;
  const profileId = parseInt(id, 10);

  const [profile] = await sql`
    SELECT sp.*, u.email
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
    WHERE sp.id = ${profileId}
  `;
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const status = action === 'approve' ? 'approved' : 'rejected';
  await sql`
    UPDATE student_profiles
    SET status = ${status},
        reviewed_at = NOW(),
        reviewed_by = ${session.userId},
        rejection_reason = ${rejection_reason ?? null}
    WHERE id = ${profileId}
  `;

  // Delete sensitive documents from Vercel Blob; profile picture is retained for peer directory
  const toDelete = [profile.passport_url, profile.admission_letter_url].filter(Boolean) as string[];
  if (toDelete.length) {
    try { await del(toDelete); } catch { /* already gone */ }
  }

  if (action === 'approve') {
    // Grow the reference directory from the admin-confirmed values (best-effort).
    await ensureUniversity(profile.university_name, profile.country_of_education);
    await ensureCity(profile.city, profile.country_of_education);

    await sendApprovalEmail(profile.email, profile.full_name);

    const peers = await sql`
      SELECT u.email
      FROM student_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.university_name = ${profile.university_name}
        AND sp.status = 'approved'
        AND sp.user_id != ${profile.user_id}
    `;
    await Promise.allSettled(
      peers.map(p => sendNewPeerNotificationEmail(p.email, profile.full_name, profile.university_name))
    );
  } else {
    await sendRejectionEmail(profile.email, profile.full_name, rejection_reason);
  }

  return NextResponse.json({ message: `Student ${status} successfully.` });
}
