import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { log } from '@/lib/logger';
import { clientIp, ipMax, hitAndCheck } from '@/lib/rate-limit';
import { CLIENT_EVENTS, CLIENT_META_KEYS, type ClientEvent } from '@/lib/client-log';

export const runtime = 'nodejs';

const MAX_BODY = 4096;
const MAX_STRING = 300;
const USER_MAX = 40;  // events per student per hour
const IP_MAX = 120;   // per IP per hour (a campus or hostel can share one)
const WINDOW_SEC = 3600;

// Keep only whitelisted keys of the right type; clamp strings. Anything else is dropped.
function cleanMetadata(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, type] of Object.entries(CLIENT_META_KEYS)) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== type) continue;
    if (type === 'number' && !Number.isFinite(value)) continue;
    out[key] = type === 'string' ? (value as string).slice(0, MAX_STRING) : (value as number | boolean);
  }
  return out;
}

// Registration-flow failures that happen in the browser (and so never reach our other routes).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large' }, { status: 400 });

  let body: { event?: unknown; metadata?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const event = typeof body.event === 'string' && Object.hasOwn(CLIENT_EVENTS, body.event) ? body.event as ClientEvent : null;
  if (!event) return NextResponse.json({ error: 'Unknown event' }, { status: 400 });

  // Over the limit: answer normally and skip the insert, so a failing client never sees an error loop.
  const wait = await hitAndCheck([
    { key: `clientlog:user:${session.userId}`, max: USER_MAX, windowSec: WINDOW_SEC },
    { key: `clientlog:ip:${clientIp(request)}`, max: ipMax(IP_MAX), windowSec: WINDOW_SEC },
  ]);
  if (wait > 0) return new NextResponse(null, { status: 204 });

  const { level, message } = CLIENT_EVENTS[event];
  await log({
    level, event, message, category: 'registration',
    email: session.email, userId: session.userId, route: '/api/student/client-log',
    metadata: cleanMetadata(body.metadata),
  });
  return new NextResponse(null, { status: 204 });
}
