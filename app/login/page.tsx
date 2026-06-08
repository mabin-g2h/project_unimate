"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/app/components/AppLogo';

type Mode = 'login' | 'signup';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    searchParams.get('reset') === 'success'
      ? 'Password reset successfully. Sign in with your new password.'
      : ''
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    setLoading(true);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);

    let data: Record<string, string> = {};
    try {
      data = await res.json();
    } catch {
      setError('Server error — please try again.');
      return;
    }

    if (!res.ok) {
      if (data.code === 'UNVERIFIED') {
        setInfo('');
        setError('');
        setInfo('Please verify your email first. Check your inbox for the verification link.');
      } else {
        setError(data.error ?? 'Something went wrong.');
      }
      return;
    }

    if (mode === 'signup') {
      setInfo('Account created! Check your email for a verification link.');
      setEmail(''); setPassword('');
    } else {
      router.push(data.role === 'admin' ? '/admin' : '/');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          <AppLogo height={60} />
          <div style={{ fontSize: '.66rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)' }}>FlyMate Network</div>
        </div>

        <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line-soft)', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--line)' }}>
            {(['login', 'signup'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setInfo(''); }}
                style={{
                  border: 'none', padding: '16px', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  fontWeight: 700, fontSize: '.92rem', transition: '.18s',
                  background: mode === m ? 'var(--paper)' : 'var(--cream-2)',
                  color: mode === m ? 'var(--teal)' : 'var(--ink-soft)',
                  borderBottom: mode === m ? '2px solid var(--teal)' : '2px solid transparent',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '28px 28px 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-.02em', marginBottom: 4 }}>
                {mode === 'login' ? 'Welcome back' : 'Join FlyMate Network'}
              </h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem' }}>
                {mode === 'login' ? 'Sign in to your Uni Mate account.' : 'Create your free student account.'}
              </p>
            </div>

            {error && (
              <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: 'var(--coral-deep)', fontSize: '.86rem', fontWeight: 600 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ background: 'var(--teal-tint)', border: '1px solid var(--teal)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: 'var(--teal-deep)', fontSize: '.86rem', fontWeight: 600 }}>
                {info}
              </div>
            )}

            <label style={labelStyle}>Email address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginTop: 0, marginBottom: 0 }}>Password</label>
              {mode === 'login' && (
                <Link href="/forgot-password" style={{ fontSize: '.78rem', color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
              style={inputStyle}
            />

            <button type="submit" disabled={loading}
              style={{
                width: '100%', marginTop: 22, padding: '13px', borderRadius: 11, border: 'none',
                background: loading ? 'var(--teal-tint)' : 'var(--teal)', color: '#fff',
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.96rem', cursor: loading ? 'not-allowed' : 'pointer',
                transition: '.18s',
              }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: '.84rem', color: 'var(--ink-soft)' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--teal)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '.84rem' }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
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
