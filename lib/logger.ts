import { sql } from '@/lib/db';

export type LogLevel = 'error' | 'warn' | 'info';

interface LogEntry {
  level: LogLevel;
  event: string;
  message: string;
  email?: string;
  userId?: number;
  route?: string;
  metadata?: Record<string, unknown>;
}

export function log(entry: LogEntry): void {
  sql`
    INSERT INTO student_error_logs (level, event, message, email, user_id, route, metadata)
    VALUES (
      ${entry.level},
      ${entry.event},
      ${entry.message},
      ${entry.email ?? null},
      ${entry.userId ?? null},
      ${entry.route ?? null},
      ${entry.metadata ? JSON.stringify(entry.metadata) : null}
    )
  `.catch(() => {});
}
