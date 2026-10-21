'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface LogRow {
  id: string;
  level: 'error' | 'warn' | 'info';
  event: string;
  category: string;
  message: string;
  email: string | null;
  actor_email: string | null;
  user_id: number | null;
  route: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Summary {
  email: string;
  role: string;
  email_verified: boolean;
  account_created_at: string;
  profile_id: number | null;
  full_name: string | null;
  status: string | null;
  submitted_at: string | null;
  consented_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  revoke_reason: string | null;
  university_name: string | null;
  country_of_education: string | null;
  course_start_date: string | null;
  expiry_date: string | null;
  archived_at: string | null;
}

interface Filters { email: string; level: string; category: string; event: string; from: string; to: string }

const EMPTY: Filters = { email: '', level: '', category: '', event: '', from: '', to: '' };
const PAGE_SIZE = 25;

const LEVELS = ['error', 'warn', 'info'];
const CATEGORIES = ['auth', 'registration', 'email', 'admin', 'dashboard', 'system'];
const EVENTS = [
  'signup_success', 'email_verified', 'login_success', 'login_failed', 'login_unverified_email',
  'signup_email_exists', 'verification_link_invalid', 'verification_link_expired',
  'password_reset_requested', 'password_reset_completed', 'admin_invite_accepted',
  'registration_submitted', 'registration_failed', 'registration_error',
  'email_sent', 'email_send_failed',
  'student_approved', 'student_rejected', 'student_revoked', 'student_unrevoked', 'student_archived',
  'profile_edited_by_admin', 'admin_invited', 'admin_removed', 'invite_revoked',
  'option_added', 'option_removed', 'account_purged',
  'flight_save_failed', 'flight_fetch_failed', 'phone_toggle_failed', 'peers_fetch_failed',
];

const levelStyle = (level: string) => ({
  bg:    level === 'error' ? 'var(--coral-tint, #FBE2D8)' : level === 'warn' ? '#FEF3C7' : '#EFF6FF',
  color: level === 'error' ? 'var(--coral-deep, #C9421F)' : level === 'warn' ? '#92400E' : '#1D4ED8',
});

function fmtDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const emailType = (log: LogRow) => (log.metadata?.type ? String(log.metadata.type) : null);

const btn: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--cream-2)', color: 'var(--ink-soft)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.86rem', cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { ...btn, border: 'none', background: 'var(--teal)', color: '#fff' };
const field: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '.86rem', color: 'var(--ink)', background: 'var(--cream-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', outline: 'none' };

function Spinner() {
  return <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'logs-spin .8s linear infinite' }}>
    <style>{`@keyframes logs-spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

function LevelChip({ log }: { log: LogRow }) {
  const s = levelStyle(log.level);
  return (
    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.76rem', fontWeight: 700, background: s.bg, color: s.color, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {log.event}
    </span>
  );
}

function EmailPill({ log }: { log: LogRow }) {
  if (log.category !== 'email') return null;
  const ok = log.event === 'email_sent';
  const subject = log.metadata?.subject ? String(log.metadata.subject) : '';
  return (
    <span title={subject} style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ok ? '#E3F5EA' : 'var(--coral-tint, #FBE2D8)', color: ok ? '#1F7A45' : 'var(--coral-deep, #C9421F)', whiteSpace: 'nowrap' }}>
      {ok ? '✉ Sent' : '✉ Failed'}{emailType(log) ? ` · ${emailType(log)}` : ''}
    </span>
  );
}

// Right-hand sheet. Closes on backdrop click, × button or Escape.
function Sheet({ title, width = 480, onClose, children }: { title: string; width?: number; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={title}
        style={{ width: `min(${width}px, 100%)`, height: '100%', background: 'var(--paper)', boxShadow: 'var(--shadow)', overflowY: 'auto', padding: 'calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-.02em', margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ ...btn, padding: '4px 12px', fontSize: '1.1rem' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>{k}</div>
      <div style={{ fontSize: '.88rem', color: 'var(--ink)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

export default function LogsPanel() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [timelineEmail, setTimelineEmail] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ summary: Summary | null; events: LogRow[] } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Tracks the latest request so a slow earlier response can't overwrite newer results.
  const reqId = useRef(0);

  const load = useCallback(async (f: Filters, p: number, silent = false) => {
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    (Object.keys(f) as (keyof Filters)[]).forEach(k => { if (f[k]) params.set(k, f[k]); });
    try {
      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();
      if (id !== reqId.current) return;
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
    } finally {
      if (id === reqId.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(EMPTY, 1);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(applied, page, true), 30_000);
    return () => clearInterval(id);
  }, [applied, page, load]);

  function apply(next: Filters) {
    setDraft(next);
    setApplied(next);
    load(next, 1);
  }

  useEffect(() => {
    if (!timelineEmail) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimelineLoading(true);
    setTimeline(null);
    fetch(`/api/admin/logs/student?email=${encodeURIComponent(timelineEmail)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setTimeline({ summary: d.summary ?? null, events: d.events ?? [] }); })
      .finally(() => { if (!cancelled) setTimelineLoading(false); });
    return () => { cancelled = true; };
  }, [timelineEmail]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = (Object.keys(applied) as (keyof Filters)[]).some(k => applied[k]);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
    border: `1px solid ${active ? 'var(--teal)' : 'var(--line)'}`, background: active ? 'var(--teal)' : 'var(--cream-2)', color: active ? '#fff' : 'var(--ink-soft)',
  });

  return (
    <>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-.03em', marginBottom: 6 }}>Logs</h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginBottom: 24 }}>
        Activity and errors across sign-up, registration, emails and admin actions. Click a row for details, or search an email and open the student&apos;s timeline. Entries are kept for 90 days.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input type="text" placeholder="Search by email…" value={draft.email}
          onChange={e => setDraft({ ...draft, email: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') apply(draft); }}
          style={{ ...field, flex: '1 1 220px', maxWidth: 320 }} />
        <select value={draft.event} onChange={e => apply({ ...draft, event: e.target.value })} style={field} aria-label="Event">
          <option value="">All events</option>
          {EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <input type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} style={field} aria-label="From date" />
        <input type="date" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} style={field} aria-label="To date" />
        <button onClick={() => apply(draft)} style={primaryBtn}>Search</button>
        {hasFilters && <button onClick={() => apply(EMPTY)} style={btn}>Clear</button>}
        {applied.email.includes('@') && <button onClick={() => setTimelineEmail(applied.email.trim().toLowerCase())} style={{ ...btn, color: 'var(--teal)', borderColor: 'var(--teal)' }}>View timeline</button>}
        <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginLeft: 4 }}>{total} {total === 1 ? 'entry' : 'entries'}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: '.74rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 4 }}>Level</span>
        {LEVELS.map(l => <button key={l} style={chip(applied.level === l)} onClick={() => apply({ ...draft, level: applied.level === l ? '' : l })}>{l}</button>)}
        <span style={{ fontSize: '.74rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 4px 0 14px' }}>Category</span>
        {CATEGORIES.map(c => <button key={c} style={chip(applied.category === c)} onClick={() => apply({ ...draft, category: applied.category === c ? '' : c })}>{c}</button>)}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>No log entries</div>
          <div style={{ fontSize: '.86rem', marginTop: 6 }}>{hasFilters ? 'Nothing matches these filters.' : 'Nothing has been recorded yet.'}</div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', border: '1px solid var(--line-soft)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div className="admin-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr style={{ background: 'var(--cream-2)' }}>
                    {['Time', 'Event', 'Student', 'Details', 'By'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '.76rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} onClick={() => setSelected(log)} tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') setSelected(log); }}
                      style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--line-soft)' : 'none', cursor: 'pointer' }}>
                      <td style={{ padding: '12px 16px', fontSize: '.8rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <LevelChip log={log} />
                        <div style={{ fontSize: '.7rem', color: 'var(--ink-faint)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{log.category}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '.86rem', color: 'var(--ink)' }}>{log.email ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '.84rem', color: 'var(--ink-soft)', maxWidth: 320 }}>
                        <div title={log.message} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</div>
                        <div style={{ marginTop: 4 }}><EmailPill log={log} /></div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '.8rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{log.actor_email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: '.86rem', color: 'var(--ink-soft)' }}>
              <span>Page {page} of {pages}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => load(applied, page - 1)} disabled={page <= 1} style={{ ...btn, padding: '8px 16px', fontSize: '.82rem', color: page <= 1 ? 'var(--ink-faint)' : 'var(--ink)', cursor: page <= 1 ? 'default' : 'pointer' }}>← Prev</button>
                <button onClick={() => load(applied, page + 1)} disabled={page >= pages} style={{ ...btn, padding: '8px 16px', fontSize: '.82rem', color: page >= pages ? 'var(--ink-faint)' : 'var(--ink)', cursor: page >= pages ? 'default' : 'pointer' }}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Student timeline */}
      {timelineEmail && (
        <Sheet title="Student timeline" width={560} onClose={() => { setTimelineEmail(null); setTimeline(null); }}>
          <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 14, wordBreak: 'break-word' }}>{timelineEmail}</div>
          {timelineLoading || !timeline ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : (
            <>
              {timeline.summary ? (
                <div style={{ background: 'var(--cream-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 16, marginBottom: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2px 16px' }}>
                  <KV k="Status">{timeline.summary.status ?? (timeline.summary.role === 'admin' ? 'admin' : 'no application yet')}</KV>
                  {timeline.summary.full_name && <KV k="Name">{timeline.summary.full_name}</KV>}
                  <KV k="Email verified">{timeline.summary.email_verified ? 'Yes' : 'No'}</KV>
                  <KV k="Account created">{fmtDateTime(timeline.summary.account_created_at)}</KV>
                  {timeline.summary.submitted_at && <KV k="Application submitted">{fmtDateTime(timeline.summary.submitted_at)}</KV>}
                  {timeline.summary.reviewed_at && <KV k="Reviewed">{fmtDateTime(timeline.summary.reviewed_at)}</KV>}
                  {timeline.summary.university_name && <KV k="University">{timeline.summary.university_name}</KV>}
                  {timeline.summary.course_start_date && <KV k="Course start">{fmtDate(timeline.summary.course_start_date)}</KV>}
                  {timeline.summary.expiry_date && <KV k="Access expires">{fmtDate(timeline.summary.expiry_date)}</KV>}
                  {timeline.summary.archived_at && <KV k="Archived">{fmtDateTime(timeline.summary.archived_at)}</KV>}
                  {timeline.summary.rejection_reason && <KV k="Rejection reason">{timeline.summary.rejection_reason}</KV>}
                  {timeline.summary.revoke_reason && <KV k="Revoke reason">{timeline.summary.revoke_reason}</KV>}
                </div>
              ) : (
                <div style={{ fontSize: '.84rem', color: 'var(--ink-soft)', background: 'var(--cream-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 14, marginBottom: 22 }}>
                  No account exists for this email (never created, or removed). Showing the recorded events only.
                </div>
              )}

              {timeline.events.length === 0 ? (
                <div style={{ fontSize: '.86rem', color: 'var(--ink-soft)' }}>No log entries for this email (history before activity logging was added isn&apos;t recorded).</div>
              ) : (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: '2px solid var(--line)', marginLeft: 6 }}>
                  {timeline.events.map(ev => {
                    const s = levelStyle(ev.level);
                    return (
                      <li key={ev.id} onClick={() => setSelected(ev)} style={{ position: 'relative', padding: '0 0 18px 20px', cursor: 'pointer' }}>
                        <span style={{ position: 'absolute', left: -7, top: 3, width: 12, height: 12, borderRadius: '50%', background: s.color, border: '2px solid var(--paper)' }} />
                        <div style={{ fontSize: '.74rem', color: 'var(--ink-faint)', marginBottom: 3 }}>{fmtDateTime(ev.created_at)} · {ev.category}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <LevelChip log={ev} /><EmailPill log={ev} />
                        </div>
                        <div style={{ fontSize: '.84rem', color: 'var(--ink)', marginTop: 4 }}>{ev.message}</div>
                        {ev.actor_email && <div style={{ fontSize: '.76rem', color: 'var(--ink-soft)', marginTop: 2 }}>by {ev.actor_email}</div>}
                        {ev.metadata && typeof ev.metadata.reason === 'string' && <div style={{ fontSize: '.78rem', color: 'var(--ink-soft)', marginTop: 2 }}>Reason: {ev.metadata.reason}</div>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </Sheet>
      )}

      {/* Row detail */}
      {selected && (
        <Sheet title="Log entry" onClose={() => setSelected(null)}>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <LevelChip log={selected} /><EmailPill log={selected} />
          </div>
          <KV k="Time">{fmtDateTime(selected.created_at)}</KV>
          <KV k="Message">{selected.message}</KV>
          <KV k="Student">
            {selected.email ?? '—'}
            {selected.email && (
              <button onClick={() => { const e = selected.email!.toLowerCase(); setSelected(null); setTimelineEmail(e); }} style={{ ...btn, marginLeft: 10, padding: '4px 10px', fontSize: '.76rem', color: 'var(--teal)', borderColor: 'var(--teal)' }}>View timeline</button>
            )}
          </KV>
          {selected.actor_email && <KV k="Performed by">{selected.actor_email}</KV>}
          <KV k="Category">{selected.category}</KV>
          <KV k="Route"><span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.8rem' }}>{selected.route ?? '—'}</span></KV>
          {selected.user_id != null && <KV k="User ID">{selected.user_id}</KV>}
          {selected.metadata && (
            <KV k="Metadata">
              <pre style={{ margin: 0, padding: 12, background: 'var(--cream-2)', border: '1px solid var(--line-soft)', borderRadius: 10, fontSize: '.76rem', fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </KV>
          )}
        </Sheet>
      )}
    </>
  );
}
