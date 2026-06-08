"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--teal)', display: 'grid', placeItems: 'center', boxShadow: '0 6px 16px -4px rgba(9,66,189,0.3)', transform: 'rotate(-6deg)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-.02em' }}>Uni Mate</div>
            <div style={{ fontSize: '.66rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)' }}>FlyMate Network</div>
          </div>
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

            <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
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

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 700, fontSize: '.82rem', marginBottom: 6, color: 'var(--ink)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-body)', fontSize: '.92rem', color: 'var(--ink)',
  background: 'var(--cream-2)', border: '1px solid var(--line)', borderRadius: 10,
  padding: '11px 14px', outline: 'none', boxSizing: 'border-box',
};
