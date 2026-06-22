"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from '@/app/components/AppLogo';

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

  const isRevoked = user?.registration_status === 'revoked';
  const isRejected = user?.registration_status === 'rejected';
  const isArchived = user?.registration_status === 'archived';

  return (
    <Screen>
      <div style={{ textAlign: 'center', maxWidth: 480, width: '100%' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <AppLogo height={52} />
        </div>

        <div className="content-card" style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line-soft)', padding: '40px 36px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>{isArchived ? '📁' : isRevoked ? '🔒' : isRejected ? '❌' : '⏳'}</div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-.02em', marginBottom: 10 }}>
            {isArchived ? 'Access Ended' : isRevoked ? 'Access Suspended' : isRejected ? 'Application Not Approved' : 'Application Under Review'}
          </h2>

          {isArchived ? (
            <>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', lineHeight: 1.6, marginBottom: 20 }}>
                Hi {user?.full_name?.split(' ')[0]}, now that your course is well underway, your UniMate FlyMate access has ended and your account has been archived.
              </p>
              <div style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 12, padding: '16px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Thank you</div>
                <div style={{ color: '#374151', fontSize: '.9rem', lineHeight: 1.5 }}>
                  We hope UniMate helped you connect with fellow students on your way to campus. Wishing you all the best for the year ahead! 🎓
                </div>
              </div>
            </>
          ) : isRevoked ? (
            <>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', lineHeight: 1.6, marginBottom: 20 }}>
                Hi {user?.full_name?.split(' ')[0]}, your access to UniMate has been suspended by an administrator.
              </p>
              <div style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 12, padding: '16px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>What to do</div>
                <div style={{ color: '#374151', fontSize: '.9rem', lineHeight: 1.5 }}>
                  If you believe this is a mistake, please contact the UniMate admin team for assistance.
                </div>
              </div>
            </>
          ) : isRejected ? (
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
              <p style={{ color: 'var(--ink-soft)', fontSize: '.82rem', lineHeight: 1.6, marginBottom: 24 }}>
                Can&apos;t find our email? Please check your spam or junk folder for a message from UniMate.
              </p>
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
  return <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>{children}</div>;
}

function Spinner() {
  return <div style={{ width: 36, height: 36, border: '3px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
