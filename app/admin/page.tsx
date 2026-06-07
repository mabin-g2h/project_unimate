"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Student {
  user_id: number; email: string; created_at: string;
  profile_id: number | null; full_name: string | null; phone: string | null;
  country_of_origin: string | null; country_of_education: string | null;
  university_name: string | null; degree_level: string | null;
  course_name: string | null; intake_month: string | null; intake_year: number | null;
  passport_url: string | null; admission_letter_url: string | null; profile_picture_url: string | null;
  status: string | null; submitted_at: string | null; rejection_reason: string | null;
}

interface Course { id: number; name: string; }
interface University { id: number; name: string; courses: Course[]; }
interface Airport { id: number; label: string; }
interface Airline { id: number; name: string; }
interface AdminUser { id: number; email: string; created_at: string; }
interface AdminInvite { id: string; email: string; expires_at: string; created_at: string; }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#FEF3C7', color: '#92400E' },
  approved: { bg: '#D1FAE5', color: '#065F46' },
  rejected: { bg: '#FBE2D8', color: '#C9421F' },
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'students' | 'dropdowns' | 'admins'>('students');

  // ── Students tab state ────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');

  // ── Dropdowns tab state ───────────────────────────────────────────────────
  const [universities, setUniversities] = useState<University[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);
  const [expandedUni, setExpandedUni] = useState<number | null>(null);

  const [newUni, setNewUni] = useState('');
  const [newCourse, setNewCourse] = useState<Record<number, string>>({});
  const [newAirport, setNewAirport] = useState('');
  const [newAirline, setNewAirline] = useState('');
  const [ddError, setDdError] = useState('');

  // ── Admins tab state ──────────────────────────────────────────────────────
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/students');
    if (res.status === 401) { router.replace('/login'); return; }
    const { students } = await res.json();
    setStudents(students ?? []);
    setLoading(false);
  }, [router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const loadDropdowns = useCallback(async () => {
    setDropdownsLoading(true);
    const [ur, ar, al] = await Promise.all([
      fetch('/api/options/universities').then(r => r.json()),
      fetch('/api/options/airports').then(r => r.json()),
      fetch('/api/options/airlines').then(r => r.json()),
    ]);
    setUniversities(ur.universities ?? []);
    setAirports(ar.airports ?? []);
    setAirlines(al.airlines ?? []);
    setDropdownsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'dropdowns') loadDropdowns();
  }, [tab, loadDropdowns]);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    const res = await fetch('/api/admin/admins');
    const data = await res.json();
    setAdminUsers(data.admins ?? []);
    setAdminInvites(data.invites ?? []);
    setAdminsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'admins') loadAdmins();
  }, [tab, loadAdmins]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.id) setCurrentUserId(d.user.id);
    }).catch(() => {});
  }, []);

  // ── Student review actions ────────────────────────────────────────────────
  async function handleReview(action: 'approve' | 'reject') {
    if (!selected?.profile_id) return;
    if (action === 'reject' && !rejectionReason.trim()) {
      setActionError('Please enter a rejection reason.'); return;
    }
    setActionLoading(true); setActionError('');
    const res = await fetch(`/api/admin/students/${selected.profile_id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejection_reason: rejectionReason }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) { setActionError(data.error ?? 'Failed'); return; }
    setSelected(null); setRejectionReason('');
    load();
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // ── Dropdown management actions ───────────────────────────────────────────
  async function addUniversity() {
    if (!newUni.trim()) return;
    setDdError('');
    const res = await fetch('/api/admin/options/universities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newUni.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setDdError(data.error ?? 'Failed'); return; }
    setNewUni('');
    loadDropdowns();
  }

  async function deleteUniversity(id: number) {
    await fetch(`/api/admin/options/universities/${id}`, { method: 'DELETE' });
    if (expandedUni === id) setExpandedUni(null);
    loadDropdowns();
  }

  async function addCourse(uniId: number) {
    const name = newCourse[uniId]?.trim();
    if (!name) return;
    setDdError('');
    const res = await fetch(`/api/admin/options/universities/${uniId}/courses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) { setDdError(data.error ?? 'Failed'); return; }
    setNewCourse(prev => ({ ...prev, [uniId]: '' }));
    loadDropdowns();
  }

  async function deleteCourse(id: number) {
    await fetch(`/api/admin/options/courses/${id}`, { method: 'DELETE' });
    loadDropdowns();
  }

  async function addAirport() {
    if (!newAirport.trim()) return;
    setDdError('');
    const res = await fetch('/api/admin/options/airports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newAirport.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setDdError(data.error ?? 'Failed'); return; }
    setNewAirport('');
    loadDropdowns();
  }

  async function deleteAirport(id: number) {
    await fetch(`/api/admin/options/airports/${id}`, { method: 'DELETE' });
    loadDropdowns();
  }

  async function addAirline() {
    if (!newAirline.trim()) return;
    setDdError('');
    const res = await fetch('/api/admin/options/airlines', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAirline.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setDdError(data.error ?? 'Failed'); return; }
    setNewAirline('');
    loadDropdowns();
  }

  async function deleteAirline(id: number) {
    await fetch(`/api/admin/options/airlines/${id}`, { method: 'DELETE' });
    loadDropdowns();
  }

  // ── Admin management actions ──────────────────────────────────────────────
  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteError(''); setInviteSuccess('');
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setInviteError(data.error ?? 'Failed to send invite.'); return; }
    setInviteEmail('');
    setInviteSuccess('Invite sent successfully.');
    loadAdmins();
  }

  async function removeAdmin(id: number) {
    await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
    loadAdmins();
  }

  async function revokeInvite(id: string) {
    await fetch(`/api/admin/admins/invite/${id}`, { method: 'DELETE' });
    loadAdmins();
  }

  const filtered = students.filter(s => {
    if (filter !== 'all' && (s.status ?? 'no_profile') !== filter) return false;
    if (search) {
      const hay = `${s.full_name ?? ''} ${s.email} ${s.university_name ?? ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const counts = {
    all: students.length,
    pending: students.filter(s => s.status === 'pending').length,
    approved: students.filter(s => s.status === 'approved').length,
    rejected: students.filter(s => s.status === 'rejected').length,
  };

  return (
    <>
      {/* Review modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,28,.6)', zIndex: 50, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', background: 'var(--paper)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--line)', background: 'var(--cream-2)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>
                {selected.full_name ?? 'No profile submitted'}
              </div>
              <button onClick={() => { setSelected(null); setRejectionReason(''); setActionError(''); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-soft)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {selected.profile_picture_url && (
                <div style={{ marginBottom: 20 }}>
                  <img src={selected.profile_picture_url!} alt="Profile"
                    style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', border: '2px solid var(--line)' }} />
                </div>
              )}

              {selected.profile_id ? (
                <>
                  <Grid>
                    <Detail label="Email" value={selected.email} />
                    <Detail label="Phone" value={selected.phone ?? '—'} />
                    <Detail label="Country of origin" value={selected.country_of_origin ?? '—'} />
                    <Detail label="Country of education" value={selected.country_of_education ?? '—'} />
                    <Detail label="University" value={selected.university_name ?? '—'} />
                    <Detail label="Degree" value={selected.degree_level ?? '—'} />
                    <Detail label="Course" value={selected.course_name ?? '—'} />
                    <Detail label="Intake" value={selected.intake_month && selected.intake_year ? `${selected.intake_month} ${selected.intake_year}` : '—'} />
                    <Detail label="Submitted" value={selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                    <Detail label="Status" value={
                      <span style={{ ...badge, ...(STATUS_COLORS[selected.status ?? ''] ?? {}) }}>
                        {selected.status ?? 'no profile'}
                      </span>
                    } />
                  </Grid>

                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--line-soft)' }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Documents</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {selected.passport_url && (
                        <a href={selected.passport_url!} target="_blank" rel="noreferrer" style={docBtn}>📄 View Passport</a>
                      )}
                      {selected.admission_letter_url && (
                        <a href={selected.admission_letter_url!} target="_blank" rel="noreferrer" style={docBtn}>📋 Admission Letter</a>
                      )}
                      {!selected.passport_url && !selected.admission_letter_url && (
                        <span style={{ color: 'var(--ink-faint)', fontSize: '.86rem' }}>Documents deleted after review</span>
                      )}
                    </div>
                  </div>

                  {selected.status === 'pending' && (
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line-soft)' }}>
                      {actionError && (
                        <div style={{ background: 'var(--coral-tint)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, color: 'var(--coral-deep)', fontSize: '.84rem' }}>{actionError}</div>
                      )}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontWeight: 700, fontSize: '.82rem', marginBottom: 6 }}>Rejection reason (required to reject)</label>
                        <textarea
                          value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                          placeholder="e.g. Document is unclear or not legible. Please re-upload a clear scan."
                          rows={3}
                          style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: '.88rem', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: 'var(--cream-2)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => handleReview('approve')} disabled={actionLoading}
                          style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
                          {actionLoading ? '…' : '✓ Approve'}
                        </button>
                        <button onClick={() => handleReview('reject')} disabled={actionLoading}
                          style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--coral)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
                          {actionLoading ? '…' : '✕ Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem' }}>This student has not submitted a registration form yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Nav bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--teal)', display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)', boxShadow: '0 4px 10px -3px rgba(14,110,98,.5)' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-.02em', lineHeight: 1 }}>Uni Mate</div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--coral)' }}>Admin Portal</div>
            </div>
          </div>
          <button onClick={handleLogout}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.84rem' }}>
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--line-soft)', paddingBottom: 0 }}>
          {([['students', 'Student Applications'], ['dropdowns', 'Manage Dropdowns'], ['admins', 'Manage Admins']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px', fontFamily: 'var(--font-body)', fontWeight: 700,
                fontSize: '.9rem', borderBottom: tab === key ? '2px solid var(--teal)' : '2px solid transparent',
                color: tab === key ? 'var(--teal-deep)' : 'var(--ink-soft)',
                marginBottom: -1, transition: '.15s',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Students tab ── */}
        {tab === 'students' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-.03em', marginBottom: 6 }}>Student Applications</h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginBottom: 24 }}>Review submitted profiles and approve or reject students.</p>

            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
              {([['all','Total',undefined],['pending','Pending','#92400E'],['approved','Approved','var(--green)'],['rejected','Rejected','var(--coral-deep)']] as const).map(([k, label, color]) => (
                <div key={k} style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', cursor: 'pointer', boxShadow: filter === k ? 'var(--shadow)' : 'none', borderColor: filter === k ? 'var(--teal)' : 'var(--line-soft)', transition: '.18s' }}
                  onClick={() => setFilter(k)}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', color: color ?? 'var(--teal)', lineHeight: 1 }}>{counts[k]}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--ink-soft)', fontWeight: 600, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', marginBottom: 18 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--ink-faint)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email or university…"
                style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: '.9rem', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px 11px 40px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>No students found</div>
              </div>
            ) : (
              <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', border: '1px solid var(--line-soft)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                <div className="admin-table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: 'var(--cream-2)' }}>
                      {['Name', 'Email', 'University', 'Course', 'Submitted', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '.76rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid var(--line)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={s.user_id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--line-soft)' : 'none', transition: '.15s', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '.9rem' }}>{s.full_name ?? <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontWeight: 400 }}>No form yet</span>}</td>
                        <td style={{ padding: '14px 16px', fontSize: '.86rem', color: 'var(--ink-soft)' }}>{s.email}</td>
                        <td style={{ padding: '14px 16px', fontSize: '.86rem' }}>{s.university_name ?? '—'}</td>
                        <td style={{ padding: '14px 16px', fontSize: '.84rem', color: 'var(--ink-soft)' }}>{s.course_name ?? '—'}</td>
                        <td style={{ padding: '14px 16px', fontSize: '.82rem', color: 'var(--ink-soft)' }}>
                          {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ ...badge, ...(STATUS_COLORS[s.status ?? ''] ?? { bg: '#F3F4F6', color: '#6B7280' }) }}>
                            {s.status ?? 'no form'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button onClick={() => { setSelected(s); setRejectionReason(''); setActionError(''); }}
                            style={{ background: 'var(--teal-tint)', color: 'var(--teal-deep)', border: 'none', borderRadius: 8, padding: '7px 14px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer' }}>
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Manage Admins tab ── */}
        {tab === 'admins' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-.03em', marginBottom: 6 }}>Manage Admins</h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginBottom: 24 }}>Invite new admins by email and manage existing admin accounts.</p>

            {adminsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Invite new admin */}
                <DdSection title="Invite New Admin" hint="Enter an email address to send an admin invitation link (valid for 48 hours).">
                  {inviteError && (
                    <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '10px 14px', color: 'var(--coral-deep)', fontSize: '.86rem', fontWeight: 600 }}>{inviteError}</div>
                  )}
                  {inviteSuccess && (
                    <div style={{ background: 'var(--teal-tint)', border: '1px solid var(--teal)', borderRadius: 10, padding: '10px 14px', color: 'var(--teal-deep)', fontSize: '.86rem', fontWeight: 600 }}>{inviteSuccess}</div>
                  )}
                  <AddRow
                    placeholder="admin@example.com"
                    value={inviteEmail}
                    onChange={v => { setInviteEmail(v); setInviteError(''); setInviteSuccess(''); }}
                    onAdd={sendInvite}
                    label="Send Invite"
                  />
                </DdSection>

                {/* Current admins */}
                <DdSection title="Current Admins" hint="Removing admin access demotes the user to a student account.">
                  {adminUsers.length === 0 && <EmptyHint>No admins found.</EmptyHint>}
                  {adminUsers.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: 'var(--cream-2)', borderRadius: 8, gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{a.email}</div>
                        <div style={{ fontSize: '.76rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                          Joined {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {a.id === currentUserId && <span style={{ marginLeft: 8, color: 'var(--teal)', fontWeight: 700 }}>(you)</span>}
                        </div>
                      </div>
                      {a.id !== currentUserId && (
                        <button
                          onClick={() => removeAdmin(a.id)}
                          style={{ background: 'none', border: '1px solid var(--coral)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', color: 'var(--coral)', fontWeight: 700, fontSize: '.8rem', fontFamily: 'var(--font-body)' }}>
                          Remove admin
                        </button>
                      )}
                    </div>
                  ))}
                </DdSection>

                {/* Pending invites */}
                <DdSection title="Pending Invites" hint="Invites expire after 48 hours.">
                  {adminInvites.length === 0 && <EmptyHint>No pending invites.</EmptyHint>}
                  {adminInvites.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: 'var(--cream-2)', borderRadius: 8, gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{inv.email}</div>
                        <div style={{ fontSize: '.76rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                          Sent {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          Expires {new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <DeleteBtn onClick={() => revokeInvite(inv.id)} />
                    </div>
                  ))}
                </DdSection>

              </div>
            )}
          </>
        )}

        {/* ── Manage Dropdowns tab ── */}
        {tab === 'dropdowns' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', letterSpacing: '-.03em', marginBottom: 6 }}>Manage Dropdowns</h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginBottom: 24 }}>Add or remove values for university, course, airport, and airline dropdowns shown to students.</p>

            {ddError && (
              <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, color: 'var(--coral-deep)', fontSize: '.86rem', fontWeight: 600 }}>
                {ddError}
              </div>
            )}

            {dropdownsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Universities & Courses */}
                <DdSection title="Universities & Courses" hint="Add a university, then expand it to add its courses.">
                  <AddRow
                    placeholder="e.g. University of Melbourne"
                    value={newUni}
                    onChange={setNewUni}
                    onAdd={addUniversity}
                    label="Add university"
                  />
                  {universities.length === 0 && <EmptyHint>No universities yet.</EmptyHint>}
                  {universities.map(u => (
                    <div key={u.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', background: 'var(--cream-2)', gap: 10 }}>
                        <button
                          onClick={() => setExpandedUni(expandedUni === u.id ? null : u.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--teal-deep)', fontWeight: 700, fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ display: 'inline-block', transition: '.2s', transform: expandedUni === u.id ? 'rotate(90deg)' : 'none' }}>▶</span>
                          {u.name}
                          <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>({u.courses.length} {u.courses.length === 1 ? 'course' : 'courses'})</span>
                        </button>
                        <div style={{ flex: 1 }} />
                        <DeleteBtn onClick={() => deleteUniversity(u.id)} />
                      </div>

                      {expandedUni === u.id && (
                        <div style={{ padding: '14px', background: 'var(--paper)' }}>
                          <AddRow
                            placeholder="e.g. MSc Information Technology"
                            value={newCourse[u.id] ?? ''}
                            onChange={v => setNewCourse(prev => ({ ...prev, [u.id]: v }))}
                            onAdd={() => addCourse(u.id)}
                            label="Add course"
                            small
                          />
                          {u.courses.length === 0 && <EmptyHint>No courses yet — add one above.</EmptyHint>}
                          {u.courses.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--line-soft)' }}>
                              <span style={{ flex: 1, fontSize: '.88rem' }}>{c.name}</span>
                              <DeleteBtn onClick={() => deleteCourse(c.id)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </DdSection>

                {/* Airports */}
                <DdSection title="Airports / Cities" hint="Used in the departure and arrival dropdowns in flight details.">
                  <AddRow
                    placeholder='e.g. New Delhi (DEL)'
                    value={newAirport}
                    onChange={setNewAirport}
                    onAdd={addAirport}
                    label="Add airport"
                  />
                  {airports.length === 0 && <EmptyHint>No airports yet.</EmptyHint>}
                  {airports.map(a => (
                    <ItemRow key={a.id} label={a.label} onDelete={() => deleteAirport(a.id)} />
                  ))}
                </DdSection>

                {/* Airlines */}
                <DdSection title="Airlines" hint="Used in the airline dropdown in flight details.">
                  <AddRow
                    placeholder='e.g. Emirates'
                    value={newAirline}
                    onChange={setNewAirline}
                    onAdd={addAirline}
                    label="Add airline"
                  />
                  {airlines.length === 0 && <EmptyHint>No airlines yet.</EmptyHint>}
                  {airlines.map(a => (
                    <ItemRow key={a.id} label={a.name} onDelete={() => deleteAirline(a.id)} />
                  ))}
                </DdSection>

              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Dropdown management sub-components ─────────────────────────────────────

function DdSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)', padding: '22px 24px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginBottom: 16 }}>{hint}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function AddRow({ placeholder, value, onChange, onAdd, label, small }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  onAdd: () => void; label: string; small?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
        style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: small ? '.86rem' : '.9rem', background: 'var(--cream-2)', border: '1px solid var(--line)', borderRadius: 9, padding: small ? '8px 12px' : '10px 14px', outline: 'none' }}
      />
      <button onClick={onAdd}
        style={{ padding: small ? '8px 14px' : '10px 18px', borderRadius: 9, border: 'none', background: 'var(--teal)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: small ? '.82rem' : '.86rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        + {label}
      </button>
    </div>
  );
}

function ItemRow({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', background: 'var(--cream-2)', borderRadius: 8 }}>
      <span style={{ flex: 1, fontSize: '.9rem' }}>{label}</span>
      <DeleteBtn onClick={onDelete} />
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--coral)', fontWeight: 700, fontSize: '.9rem', padding: '2px 6px', borderRadius: 6, lineHeight: 1 }}
      title="Delete">
      ✕
    </button>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '.84rem', color: 'var(--ink-faint)', fontStyle: 'italic', padding: '6px 4px' }}>{children}</div>;
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="two-col-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>{children}</div>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '.88rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin .8s linear infinite' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

const badge: React.CSSProperties = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '.72rem', fontWeight: 800,
  letterSpacing: '.04em', textTransform: 'capitalize',
};

const docBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
  background: 'var(--cream-2)', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 700,
  fontSize: '.84rem', textDecoration: 'none', cursor: 'pointer',
};
