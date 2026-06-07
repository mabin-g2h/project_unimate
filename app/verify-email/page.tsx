"use client";

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function Content() {
  const params = useSearchParams();
  const error = params.get('error');

  if (error === 'expired') {
    return (
      <Card>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⏰</div>
        <h2 style={h2}>Link expired</h2>
        <p style={p}>Your verification link has expired. Please create a new account.</p>
        <Link href="/login" style={btn}>Go to Sign Up</Link>
      </Card>
    );
  }

  if (error === 'invalid') {
    return (
      <Card>
        <div style={{ fontSize: 44, marginBottom: 16 }}>❌</div>
        <h2 style={h2}>Invalid link</h2>
        <p style={p}>This verification link is invalid or has already been used.</p>
        <Link href="/login" style={btn}>Back to Login</Link>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ fontSize: 44, marginBottom: 16 }}>📬</div>
      <h2 style={h2}>Check your inbox</h2>
      <p style={p}>
        We&apos;ve sent a verification link to your email address. Click the link in the email to activate your account.
      </p>
      <p style={{ fontSize: '.82rem', color: 'var(--ink-faint)', marginTop: 8 }}>
        Didn&apos;t receive it? Check your spam folder or&nbsp;
        <Link href="/login" style={{ color: 'var(--teal)', fontWeight: 600 }}>go back</Link>
        &nbsp;and try again.
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        maxWidth: 420, width: '100%', background: 'var(--paper)', borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line-soft)', padding: '40px 36px', textAlign: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

const h2: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-.02em', marginBottom: 10,
};
const p: React.CSSProperties = { color: 'var(--ink-soft)', fontSize: '.92rem', lineHeight: 1.6 };
const btn: React.CSSProperties = {
  display: 'inline-block', marginTop: 20, padding: '12px 28px', borderRadius: 11,
  background: 'var(--teal)', color: '#fff', fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div />}>
      <Content />
    </Suspense>
  );
}
