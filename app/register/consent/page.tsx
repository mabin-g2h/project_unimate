'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistration } from '../context';

const CONSENTS = [
  {
    id: 'document_storage',
    title: 'Document Storage & Verification',
    text: 'I consent to UniMate securely storing my passport and admission letter for identity verification by the admin team. These documents will be permanently deleted from our servers once my application is reviewed.',
  },
  {
    id: 'profile_picture',
    title: 'Profile Photo Display',
    text: 'I consent to my profile photo being retained on UniMate and displayed to other approved students in the peer directory for as long as my account is active.',
  },
  {
    id: 'email_sharing',
    title: 'Email Address in Community',
    text: 'I consent to my email address being visible to other approved UniMate students at my university so they can contact me directly.',
  },
  {
    id: 'phone_opt_in',
    title: 'Phone Number Collection',
    text: 'I understand that my phone number is collected but not shared by default. I can choose to share it with my university peers at any time from my dashboard.',
  },
] as const;

export default function ConsentPage() {
  const router = useRouter();
  const { data, clear } = useRegistration();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!data) router.replace('/register');
  }, [data, router]);

  if (!data) return null;

  const allChecked = CONSENTS.every(c => checked[c.id]);

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit() {
    if (!allChecked || !data) return;
    setSubmitting(true);
    setError('');

    const fd = new FormData();
    Object.entries(data.form).forEach(([k, v]) => fd.append(k, v));
    fd.append('passport', data.passportFile);
    fd.append('admission_letter', data.admissionFile);
    fd.append('profile_picture', data.profileFile);
    fd.append('consents_accepted', 'true');

    const res = await fetch('/api/student/register', { method: 'POST', body: fd });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? 'Submission failed. Please try again.');
      return;
    }
    clear();
    router.push('/pending');
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--teal)', display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)', boxShadow: '0 4px 10px -3px rgba(9,66,189,0.3)', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-.02em' }}>Uni Mate</div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <StepBadge n={1} done label="Your Details" />
        <div style={{ flex: 1, height: 2, background: 'var(--teal)', borderRadius: 2 }} />
        <StepBadge n={2} active label="Review & Consent" />
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem,4vw,2rem)', letterSpacing: '-.03em', marginBottom: 6 }}>
        Review &amp; give consent
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: '.95rem', marginBottom: 28, lineHeight: 1.6 }}>
        Please read each statement carefully and tick to confirm your consent. All items are required before your application can be submitted.
      </p>

      {/* Application summary */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 18, boxShadow: 'var(--shadow)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', letterSpacing: '-.01em', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--line-soft)', color: 'var(--ink)' }}>
          Your application
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          <SummaryRow label="Name" value={data.form.full_name} />
          <SummaryRow label="University" value={data.form.university_name} />
          <SummaryRow label="Course" value={data.form.course_name} />
          <SummaryRow label="Intake" value={`${data.form.intake_month} ${data.form.intake_year}`} />
          <SummaryRow label="Degree" value={data.form.degree_level} />
          <SummaryRow label="Documents" value="Passport, Admission letter, Photo" />
        </div>
      </div>

      {/* Consents */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: 18, boxShadow: 'var(--shadow)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '.95rem', letterSpacing: '-.01em', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line-soft)', color: 'var(--ink)' }}>
          Consent declarations
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CONSENTS.map((c, i) => (
            <ConsentItem
              key={c.id}
              n={i + 1}
              title={c.title}
              text={c.text}
              checked={!!checked[c.id]}
              onChange={() => toggle(c.id)}
            />
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, color: 'var(--coral-deep)', fontSize: '.88rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => router.push('/register')}
          style={{
            flex: '0 0 auto', padding: '14px 20px', borderRadius: 12,
            border: '1.5px solid var(--line)', background: 'var(--paper)',
            color: 'var(--ink)', fontFamily: 'var(--font-body)', fontWeight: 700,
            fontSize: '.95rem', cursor: 'pointer',
          }}
        >
          ← Back to edit
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allChecked || submitting}
          style={{
            flex: 1, padding: '14px', borderRadius: 12, border: 'none',
            background: allChecked && !submitting ? 'var(--teal)' : 'var(--teal-tint)',
            color: allChecked && !submitting ? '#fff' : 'var(--teal)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem',
            cursor: allChecked && !submitting ? 'pointer' : 'not-allowed',
            transition: 'background .2s, color .2s',
          }}
        >
          {submitting ? 'Submitting…' : allChecked ? 'Submit Application' : `Accept all ${CONSENTS.length} consents to continue`}
        </button>
      </div>
    </div>
  );
}

function StepBadge({ n, label, done, active }: { n: number; label: string; done?: boolean; active?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: done ? 'var(--teal)' : active ? 'var(--teal)' : 'var(--line)',
        color: done || active ? '#fff' : 'var(--ink-soft)',
        fontWeight: 700, fontSize: '.8rem',
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: '.72rem', fontWeight: 600, color: active ? 'var(--teal-deep)' : 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function ConsentItem({ n, title, text, checked, onChange }: {
  n: number; title: string; text: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex', gap: 14, cursor: 'pointer',
        background: checked ? 'var(--teal-tint)' : 'var(--cream-2)',
        border: `1.5px solid ${checked ? 'var(--teal)' : 'var(--line)'}`,
        borderRadius: 10, padding: '14px 16px', transition: 'border-color .18s, background .18s',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          border: `2px solid ${checked ? 'var(--teal)' : 'var(--line)'}`,
          background: checked ? 'var(--teal)' : '#fff',
          display: 'grid', placeItems: 'center', transition: '.15s',
        }}>
          {checked && (
            <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
              <path d="M1 4l3 3 6-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <div>
        <div style={{ fontSize: '.82rem', fontWeight: 700, color: checked ? 'var(--teal-deep)' : 'var(--ink)', marginBottom: 4 }}>
          {n}. {title}
        </div>
        <div style={{ fontSize: '.84rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>{text}</div>
      </div>
    </label>
  );
}
