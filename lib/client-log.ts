// Browser-side failure reporting for the registration flow. Client-safe: no server imports,
// so the route (`/api/student/client-log`) shares the event whitelist with the pages that send.
//
// A failure that happens before the request reaches our server (dropped connection, unreadable
// file) leaves no server trace, so the page reports it here. If the network is down when we try to
// report, the entry waits in localStorage and is sent when the student is back online.

import type { LogLevel } from '@/lib/logger';

// Every event the endpoint accepts, with the level and message it is stored under.
export const CLIENT_EVENTS = {
  client_submit_network_error: { level: 'warn',  message: 'Submit failed — no response from the server' },
  client_submit_retry:         { level: 'info',  message: 'Submit retried after a network failure' },
  client_submit_recovered:     { level: 'info',  message: 'Submit succeeded after a retry' },
  client_submit_duplicate_ok:  { level: 'info',  message: 'Retry found the application already saved' },
  client_submit_gave_up:       { level: 'error', message: 'Submit failed after all retries' },
  client_submit_http_error:    { level: 'warn',  message: 'Submit rejected before reaching the registration route' },
  client_file_rejected:        { level: 'warn',  message: 'Document rejected when picked' },
  client_file_unreadable:      { level: 'warn',  message: 'Picked file could not be read' },
  client_photo_failed:         { level: 'warn',  message: 'Profile photo could not be processed' },
  client_validation_error:     { level: 'info',  message: 'Form validation blocked the student' },
  client_load_failed:          { level: 'error', message: 'Registration page data failed to load' },
} as const satisfies Record<string, { level: LogLevel; message: string }>;

export type ClientEvent = keyof typeof CLIENT_EVENTS;

// The only metadata keys stored, and the type each must have. Never phone numbers, tokens,
// URLs, file names or form values.
export const CLIENT_META_KEYS = {
  step: 'string', field: 'string', reason: 'string', error_name: 'string', error_message: 'string',
  visibility: 'string', net_type: 'string', user_agent: 'string',
  attempt: 'number', status: 'number', elapsed_ms: 'number', delayed_s: 'number', file_bytes: 'number',
  total_bytes: 'number', passport_bytes: 'number', admission_bytes: 'number', photo_bytes: 'number',
  downlink: 'number', rtt: 'number',
  online: 'boolean', was_hidden: 'boolean', save_data: 'boolean',
} as const;

export type ClientMeta = { -readonly [K in keyof typeof CLIENT_META_KEYS]?: (typeof CLIENT_META_KEYS)[K] extends 'string' ? string : (typeof CLIENT_META_KEYS)[K] extends 'number' ? number : boolean };

export const CLIENT_LOG_ENDPOINT = '/api/student/client-log';
export const QUEUE_KEY = 'unimate:client-log-queue';
export const QUEUE_MAX = 20;

interface QueuedEntry { event: ClientEvent; metadata: ClientMeta; at: number }

function readQueue(): QueuedEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeQueue(queue: QueuedEntry[]): void {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_MAX)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch { /* storage unavailable (private mode, blocked) */ }
}

function enqueue(entry: QueuedEntry): void {
  writeQueue([...readQueue(), entry]);
}

// Connection details help tell "weak mobile data" from "app switched away" from "offline".
function context(): ClientMeta {
  const nav = typeof navigator === 'undefined' ? undefined : navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const conn = nav?.connection;
  const ctx: ClientMeta = {};
  if (nav) {
    ctx.online = nav.onLine;
    ctx.user_agent = nav.userAgent;
  }
  if (typeof document !== 'undefined') ctx.visibility = document.visibilityState;
  if (conn?.effectiveType) ctx.net_type = conn.effectiveType;
  if (typeof conn?.downlink === 'number') ctx.downlink = conn.downlink;
  if (typeof conn?.rtt === 'number') ctx.rtt = conn.rtt;
  if (typeof conn?.saveData === 'boolean') ctx.save_data = conn.saveData;
  return ctx;
}

// true = delivered, or pointless to retry (no session); false = try again later.
async function send(entry: QueuedEntry): Promise<boolean> {
  try {
    const delayed = Math.round((Date.now() - entry.at) / 1000);
    const res = await fetch(CLIENT_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: entry.event, metadata: { ...entry.metadata, ...(delayed > 5 ? { delayed_s: delayed } : {}) } }),
      keepalive: true,
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

// Fire-and-forget: never throws, never blocks the UI.
export function reportClient(event: ClientEvent, metadata: ClientMeta = {}): void {
  const entry: QueuedEntry = { event, metadata: { ...context(), ...metadata }, at: Date.now() };
  void send(entry).then(ok => { if (!ok) enqueue(entry); }, () => enqueue(entry));
}

// Report a given situation once per page visit (e.g. the same missing field on every Continue click).
const seen = new Set<string>();
export function reportClientOnce(key: string, event: ClientEvent, metadata: ClientMeta = {}): void {
  if (seen.has(key)) return;
  seen.add(key);
  reportClient(event, metadata);
}

// Send whatever an earlier offline period left behind. Entries that still fail go back in the queue.
export async function flushClientLogQueue(): Promise<void> {
  const queue = readQueue();
  if (!queue.length) return;
  writeQueue([]);
  const failed: QueuedEntry[] = [];
  for (const entry of queue) {
    if (!(await send(entry))) failed.push(entry);
  }
  if (failed.length) writeQueue([...failed, ...readQueue()]);
}

export function errorInfo(err: unknown): Pick<ClientMeta, 'error_name' | 'error_message'> {
  if (err instanceof Error) return { error_name: err.name, error_message: err.message };
  return { error_name: typeof err, error_message: String(err) };
}
