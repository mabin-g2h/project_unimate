"use client";

import { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/app/components/AppLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);

    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      return;
    }

    setSubmitted(true);
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
              Forgot your password?
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 24 }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {submitted ? (
              <div style={{ background: 'var(--teal-tint)', border: '1px solid var(--teal)', borderRadius: 10, padding: '14px 16px', color: 'var(--teal-deep)', fontSize: '.88rem', fontWeight: 600, lineHeight: 1.5 }}>
                If that email is registered, a reset link is on its way. Check your inbox (and spam folder).
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: 'var(--coral-deep)', fontSize: '.86rem', fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <label style={labelStyle}>Email address</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />

                <button type="submit" disabled={loading}
                  style={{
                    width: '100%', marginTop: 22, padding: '13px', borderRadius: 11, border: 'none',
                    background: loading ? 'var(--teal-tint)' : 'var(--teal)', color: '#fff',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.96rem',
                    cursor: loading ? 'not-allowed' : 'pointer', transition: '.18s',
                  }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            )}

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.84rem', color: 'var(--ink-soft)' }}>
              Remember your password?{' '}
              <Link href="/login" style={{ color: 'var(--teal)', fontWeight: 700, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
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
