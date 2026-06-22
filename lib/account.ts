// Account lifespan: an approved student loses dashboard access ACCOUNT_LIFESPAN_DAYS
// after their course starts. Configurable via env (per-environment) with a 30-day default.
// Changing the window only affects FUTURE approvals — expiry_date is snapshotted in the DB.
export const ACCOUNT_LIFESPAN_DAYS = Number(process.env.ACCOUNT_LIFESPAN_DAYS) || 30;

// Matches a date-only string (YYYY-MM-DD), as produced by an <input type="date">.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return !isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

// expiry = course_start_date + ACCOUNT_LIFESPAN_DAYS, returned as a YYYY-MM-DD string.
// UTC date math keeps it timezone-stable for a DATE column.
export function computeExpiry(courseStart: string | Date): string {
  const base = courseStart instanceof Date
    ? new Date(courseStart.getTime())
    : new Date(`${courseStart}T00:00:00Z`);
  if (isNaN(base.getTime())) throw new Error('Invalid course start date');
  base.setUTCDate(base.getUTCDate() + ACCOUNT_LIFESPAN_DAYS);
  return base.toISOString().slice(0, 10);
}
