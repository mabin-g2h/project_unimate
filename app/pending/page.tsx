"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  registration_status: string | null;
  full_name: string | null;
  rejection_reason: string | null;
}

export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(({ user }) => {
      if (!user) { router.replace('/login'); return; }
      if (user.registration_status === 'approved') { router.replace('/'); return; }
      if (!user.registration_status) { router.replace('/register'); return; }
      setUser(user);
      setLoading(false);
    });
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) return <Screen><Spinner /></Screen>;

  const isRejected = user?.registration_status === 'rejected';

  return (
    <Screen>
      <div style={{ textAlign: 'center', maxWidth: 480, width: '100%' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--teal)', display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)', boxShadow: '0 6px 14px -4px rgba(14,110,98,.5)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-.02em' }}>Uni Mate</div>
        </div>

        <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line-soft)', padding: '40px 36px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>{isRejected ? '❌' : '⏳'}</div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.02em', marginBottom: 10 }}>
            {isRejected ? 'Application Not Approved' : 'Application Under Review'}
          </h2>

          {isRejected ? (
            <>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', lineHeight: 1.6, marginBottom: 20 }}>
                Hi {user?.full_name?.split(' ')[0]}, your application was not approved at this time.
              </p>
              {user?.rejection_reason && (
                <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 12, padding: '16px', marginBottom: 24, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--coral-deep)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Reason</div>
                  <div style={{ color: 'var(--coral-deep)', fontSize: '.9rem', lineHeight: 1.5 }}>{user.rejection_reason}</div>
                </div>
              )}
              <button
                onClick={() => router.push('/register')}
                style={{ width: '100%', padding: '13px', borderRadius: 11, border: 'none', background: 'var(--teal)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.96rem', cursor: 'pointer', marginBottom: 12 }}
              >
                Re-apply with Updated Documents
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', lineHeight: 1.6, marginBottom: 24 }}>
                Hi {user?.full_name?.split(' ')[0]}, your application has been submitted and is currently being reviewed by our team. You&apos;ll receive an email once a decision has been made.
              </p>
              <div style={{ background: 'var(--teal-tint)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--teal-deep)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>What happens next</div>
                {['Our team reviews your documents', 'You get an approval email', 'Log in to access your FlyMate dashboard'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 2 ? 8 : 0 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--teal)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '.72rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ color: 'var(--teal-deep)', fontSize: '.88rem', paddingTop: 2 }}>{step}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={handleLogout}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '.86rem' }}>
            Sign out
          </button>
        </div>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>{children}</div>;
}

function Spinner() {
  return <div style={{ width: 36, height: 36, border: '3px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
