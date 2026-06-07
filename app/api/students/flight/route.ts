import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT departure_from, arrival, travel_date::text, airline
    FROM flight_details WHERE user_id = ${session.userId}
  `;

  return NextResponse.json({ flight: rows[0] ?? null });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { departure_from, arrival, travel_date, airline } = await req.json() as {
    departure_from: string;
    arrival: string;
    travel_date: string;
    airline: string;
  };

  await sql`
    INSERT INTO flight_details (user_id, departure_from, arrival, travel_date, airline)
    VALUES (${session.userId}, ${departure_from}, ${arrival}, ${travel_date}, ${airline})
    ON CONFLICT (user_id) DO UPDATE SET
      departure_from = EXCLUDED.departure_from,
      arrival        = EXCLUDED.arrival,
      travel_date    = EXCLUDED.travel_date,
      airline        = EXCLUDED.airline,
      updated_at     = NOW()
  `;

  return NextResponse.json({ ok: true });
}
