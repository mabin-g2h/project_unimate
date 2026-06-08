"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/app/components/AppLogo';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    !token ? 'Missing or invalid reset link. Please request a new one.' : ''
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (res.ok) {
      router.push('/login?reset=success');
      return;
    }

    let data: { error?: string } = {};
    try { data = await res.json(); } catch { /* ignore */ }
    setError(data.error ?? 'Something went wrong. Please try again.');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          <AppLogo height={60} />
          <div style={{ fontSize: '.66rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)' }}>FlyMate Network</div>
        </div>

        <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '28px 28px 24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-.02em', marginBottom: 4 }}>
              Set a new password
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 24 }}>
              Choose a strong password for your Uni Mate account.
            </p>

            {error && (
              <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: 'var(--coral-deep)', fontSize: '.86rem', fontWeight: 600 }}>
                {error}
                {(error.includes('expired') || error.includes('invalid') || error.includes('Missing')) && (
                  <div style={{ marginTop: 8 }}>
                    <Link href="/forgot-password" style={{ color: 'var(--coral-deep)', fontWeight: 700 }}>
                      Request a new reset link →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={labelStyle}>New password</label>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={inputStyle}
                disabled={!token}
              />

              <label style={{ ...labelStyle, marginTop: 14 }}>Confirm password</label>
              <input
                type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
                style={inputStyle}
                disabled={!token}
              />

              <button type="submit" disabled={loading || !token}
                style={{
                  width: '100%', marginTop: 22, padding: '13px', borderRadius: 11, border: 'none',
                  background: loading || !token ? 'var(--teal-tint)' : 'var(--teal)', color: '#fff',
                  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.96rem',
                  cursor: loading || !token ? 'not-allowed' : 'pointer', transition: '.18s',
                }}
              >
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.84rem', color: 'var(--ink-soft)' }}>
              <Link href="/login" style={{ color: 'var(--teal)', fontWeight: 700, textDecoration: 'none' }}>
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
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
