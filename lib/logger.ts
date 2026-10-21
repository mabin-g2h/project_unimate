import { sql } from '@/lib/db';

export type LogLevel = 'error' | 'warn' | 'info';
export type LogCategory = 'auth' | 'registration' | 'email' | 'admin' | 'dashboard' | 'system';

interface LogEntry {
  level: LogLevel;
  event: string;
  message: string;
  category?: LogCategory;
  email?: string;
  actorEmail?: string;
  userId?: number;
  route?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget by default; the returned promise never rejects, so callers that
// must finish before a serverless freeze (e.g. email sends) can safely `await` it.
export function log(entry: LogEntry): Promise<void> {
  return sql`
    INSERT INTO student_error_logs (level, event, message, category, email, actor_email, user_id, route, metadata)
    VALUES (
      ${entry.level},
      ${entry.event},
      ${entry.message},
      ${entry.category ?? null},
      ${entry.email ?? null},
      ${entry.actorEmail ?? null},
      ${entry.userId ?? null},
      ${entry.route ?? null},
      ${entry.metadata ? JSON.stringify(entry.metadata) : null}
    )
  `.then(() => {}, () => {});
}
