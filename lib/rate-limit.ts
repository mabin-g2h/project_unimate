import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Fixed-window counters in the `rate_limits` table (one row per key). Postgres keeps the
// counters, so the limits hold across serverless instances. A window starts at the first
// hit and resets once `windowSec` has passed.

// RATE_LIMIT_IP_MAX (test harness only) replaces every per-IP maximum, because all test
// requests share one IP.
export function ipMax(max: number): number {
  const override = Number(process.env.RATE_LIMIT_IP_MAX);
  return override > 0 ? override : max;
}

// Vercel sets x-forwarded-for / x-real-ip and overwrites client-supplied values.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Seconds until the key is allowed again, or 0 if it is under the limit.
export async function retryAfter(key: string, max: number, windowSec: number): Promise<number> {
  const [row] = await sql`
    SELECT count, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => ${windowSec}) - NOW())))::int AS wait
    FROM rate_limits WHERE key = ${key}
  `;
  if (!row || row.count < max || row.wait <= 0) return 0;
  return row.wait;
}

export async function recordHit(key: string, windowSec: number): Promise<void> {
  await sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES (${key}, 1, NOW())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => ${windowSec}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => ${windowSec}) THEN NOW() ELSE rate_limits.window_start END
  `;
}

export async function clearLimit(key: string): Promise<void> {
  await sql`DELETE FROM rate_limits WHERE key = ${key}`;
}

// Count this attempt for every key, then return the longest wait if any key is over its limit.
// The attempt is recorded first, so `max` attempts are allowed and the (max + 1)th is refused.
export async function hitAndCheck(limits: { key: string; max: number; windowSec: number }[]): Promise<number> {
  await Promise.all(limits.map(l => recordHit(l.key, l.windowSec)));
  const waits = await Promise.all(limits.map(l => retryAfter(l.key, l.max + 1, l.windowSec)));
  return Math.max(0, ...waits);
}

export function tooMany(waitSec: number): NextResponse {
  const minutes = Math.max(1, Math.ceil(waitSec / 60));
  return NextResponse.json(
    { error: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` },
    { status: 429, headers: { 'Retry-After': String(waitSec) } },
  );
}

// Daily housekeeping, called from the cleanup cron.
export async function pruneRateLimits(): Promise<number> {
  const rows = await sql`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day' RETURNING 1`;
  return rows.length;
}
