"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/app/components/AppLogo';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!token) setError('No invitation token found. Please use the link from your email.');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      let data: { error?: string } = {};
      try { data = await res.json(); } catch { /* ignore */ }
      setError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }

    router.push('/admin');
  }

  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          <AppLogo height={60} />
          <div style={{ fontSize: '.66rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)' }}>Admin Portal</div>
        </div>

        <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px 8px', borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-.02em', margin: '0 0 4px' }}>
              Accept Admin Invitation
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', margin: '0 0 20px' }}>
              Set a password to activate your admin account.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '24px 28px' }}>
            {error && (
              <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: 'var(--coral-deep)', fontSize: '.86rem', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: 14 }}>Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={loading || !token}
              style={{
                width: '100%', marginTop: 22, padding: '13px', borderRadius: 11, border: 'none',
                background: loading || !token ? 'var(--teal-tint)' : 'var(--teal)', color: '#fff',
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.96rem',
                cursor: loading || !token ? 'not-allowed' : 'pointer', transition: '.18s',
              }}
            >
              {loading ? 'Setting up account…' : 'Activate Admin Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 700, fontSize: '.82rem', marginBottom: 6, color: 'var(--ink)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-body)', fontSize: '.92rem', color: 'var(--ink)',
  background: 'var(--cream-2)', border: '1px solid var(--line)', borderRadius: 10,
  padding: '11px 14px', outline: 'none', boxSizing: 'border-box',
};
