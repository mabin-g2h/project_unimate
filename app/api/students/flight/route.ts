import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { log } from '@/lib/logger';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await sql`
      SELECT departure_from, arrival, travel_date::text, airline
      FROM flight_details WHERE user_id = ${session.userId}
    `;
    return NextResponse.json({ flight: rows[0] ?? null });
  } catch (err) {
    log({ level: 'error', event: 'flight_fetch_failed', message: 'Failed to load flight details', userId: session.userId, route: '/api/students/flight', metadata: { error: String(err) } });
    return NextResponse.json({ flight: null });
  }
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
    log({ level: 'warn', event: 'flight_save_failed', message: 'Flight save failed — invalid travel date', userId: session.userId, route: '/api/students/flight', metadata: { reason: 'invalid_date', travel_date } });
    return NextResponse.json({ error: 'Invalid travel date.' }, { status: 400 });
  }
  const d = new Date();
  const todayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  if (travel_date < todayStr) {
    log({ level: 'warn', event: 'flight_save_failed', message: 'Flight save failed — travel date in the past', userId: session.userId, route: '/api/students/flight', metadata: { reason: 'date_in_past', travel_date } });
    return NextResponse.json({ error: 'Travel date must be today or in the future.' }, { status: 400 });
  }

  try {
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
  } catch (err) {
    log({ level: 'error', event: 'flight_save_failed', message: 'Failed to save flight details — server error', userId: session.userId, route: '/api/students/flight', metadata: { error: String(err) } });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
