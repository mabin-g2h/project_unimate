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

  if (!travel_date || !/^\d{4}-\d{2}-\d{2}$/.test(travel_date) || isNaN(Date.parse(travel_date))) {
    return NextResponse.json({ error: 'Invalid travel date.' }, { status: 400 });
  }
  const d = new Date();
  const todayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  if (travel_date < todayStr) {
    return NextResponse.json({ error: 'Travel date must be today or in the future.' }, { status: 400 });
  }

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
