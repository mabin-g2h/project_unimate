"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/app/components/AppLogo';

type Mode = 'login' | 'signup';

type Slide = {
  eyebrow: string;
  title: string;
  desc: string;
  grad: string;
  img?: string;
};

const SLIDES: Slide[] = [
  {
    eyebrow: 'SAME FLIGHT',
    title: 'Travel together,\nfrom the very first mile.',
    desc: 'Find students booked on your exact route and turn a solo trip into a shared first adventure.',
    grad: 'linear-gradient(150deg, #0942BD 0%, #027AFF 55%, #04153F 100%)',
    img: '/students-1.jpg',
  },
  {
    eyebrow: 'SAME UNIVERSITY & CITY',
    title: 'A familiar face\nbefore orientation week.',
    desc: 'Connect with classmates heading to the same campus, so day one already feels like home.',
    grad: 'linear-gradient(150deg, #04153F 0%, #0942BD 60%, #027AFF 100%)',
    img: '/students-2.jpg',
  },
  {
    eyebrow: 'SAME COURSE & INTAKE YEAR',
    title: 'Your study group\nis already out there.',
    desc: 'Match with people on your exact course and intake year, and start your network early.',
    grad: 'linear-gradient(150deg, #027AFF 0%, #0942BD 45%, #04153F 100%)',
    img: '/students-3.jpg',
  },
  {
    eyebrow: 'SAME COUNTRY',
    title: 'A community that gets\nwhat you are walking into.',
    desc: 'Join verified peers from your country, heading the same way, ready to share the journey.',
    grad: 'linear-gradient(150deg, #0635A0 0%, #04153F 55%, #0942BD 100%)',
    img: '/students-4.jpg',
  },
];

const INTERVAL = 6000;

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
  const [showPassword, setShowPassword] = useState(false);

  // Carousel — auto-advances, but pauses while the form is focused or the
  // carousel is hovered so the motion doesn't compete with data entry.
  const [active, setActive] = useState(0);
  const [formFocused, setFormFocused] = useState(false);
  const [carouselHover, setCarouselHover] = useState(false);
  const paused = formFocused || carouselHover;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive(p => (p + 1) % SLIDES.length), INTERVAL);
    return () => clearInterval(id);
  }, [paused, active]);

  const goTo = (i: number) => setActive(i);

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

  const s = SLIDES[active];

  return (
    <div className="um-login">
      {/* LEFT: carousel */}
      <div
        className={`um-left${paused ? ' um-paused' : ''}`}
        onMouseEnter={() => setCarouselHover(true)}
        onMouseLeave={() => setCarouselHover(false)}
      >
        <div className="um-slides">
          {SLIDES.map((sl, i) => (
            <div
              key={i}
              className={`um-slide${i === active ? ' active' : ''}`}
              style={{ backgroundImage: sl.img ? `url('${sl.img}')` : sl.grad }}
            />
          ))}
        </div>
        <div className="um-overlay" />
        <div className="um-content">
          {/* key={active} re-triggers the staggered enter animation */}
          <div className="um-text um-anim-in" key={active}>
            <div className="um-eyebrow"><span className="um-dot-mark" />{s.eyebrow}</div>
            <h1 className="um-title">{s.title}</h1>
            <p className="um-desc">{s.desc}</p>
          </div>

          <div className="um-dots">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                className={`um-dot${i === active ? ' active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="um-right">
        {/* Compact hero — only shown on mobile, where the carousel is hidden, so the
            value proposition doesn't vanish on small screens. */}
        <div className="um-mobile-hero">
          <p className="um-mobile-hero-eyebrow">FlyMate Network</p>
          <h2 className="um-mobile-hero-title">Find your people before you fly.</h2>
        </div>

        <form
          className="um-form-wrap"
          onSubmit={handleSubmit}
          onFocusCapture={() => setFormFocused(true)}
          onBlurCapture={() => setFormFocused(false)}
        >
          <div className="um-form-head">
            <div className="um-form-logo"><AppLogo height={52} /></div>
            <p className="um-form-eyebrow">{mode === 'login' ? 'Welcome back' : 'New here?'}</p>
            <h2 className="um-form-title">{mode === 'login' ? 'Sign in to UniMate' : 'Create your account'}</h2>
            <p className="um-form-sub">
              {mode === 'login'
                ? 'Sign in to pick up right where you left off.'
                : 'The first friend of your new chapter is waiting.'}
            </p>
          </div>

          <div className="um-tabs">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                className={`um-tab${mode === m ? ' active' : ''}`}
                onClick={() => { setMode(m); setError(''); setInfo(''); }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {error && (
            <div className="um-alert um-alert-error">{error}</div>
          )}
          {info && (
            <div className="um-alert um-alert-info">{info}</div>
          )}

          <div className="um-field">
            <label htmlFor="email">Email address</label>
            <input
              className="um-input" id="email" type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email"
            />
          </div>

          <div className="um-field">
            <div className="um-field-row">
              <label htmlFor="password">Password</label>
              {mode === 'login' && (
                <Link href="/forgot-password">Forgot password?</Link>
              )}
            </div>
            <div className="um-input-wrap">
              <input
                className="um-input um-input-pw" id="password" type={showPassword ? 'text' : 'password'} required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="um-pw-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          <button className="um-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p className="um-form-footer">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>

      <style>{`
        /* Login fills exactly one viewport — cancel the global body padding-bottom
           (meant for scrolling content pages) so there's no extra space/scrollbar. */
        body:has(.um-login) { padding-bottom:0; }
        .um-login { display:flex; height:100dvh; width:100%; overflow:hidden;
          font-family:var(--font-body); }

        /* ---------- LEFT: carousel ---------- */
        .um-left { flex:0 0 52%; position:relative; overflow:hidden; background:#04153f; }
        .um-slides { position:absolute; inset:0; }
        .um-slide { position:absolute; inset:0; background-size:cover; background-position:center;
          opacity:0; transform:scale(1.08); transition:opacity 1.2s ease-in-out; will-change:opacity,transform; }
        .um-slide.active { opacity:1; animation:umKenBurns 7s ease-out forwards; }
        @keyframes umKenBurns { from{transform:scale(1.08);} to{transform:scale(1.16);} }

        .um-overlay { position:absolute; inset:0; z-index:2;
          background:
            linear-gradient(180deg, rgba(4,21,63,.30) 0%, rgba(4,21,63,.10) 35%, rgba(4,21,63,.78) 100%),
            linear-gradient(120deg, rgba(9,66,189,.42) 0%, rgba(2,122,255,.12) 55%, rgba(0,0,0,0) 100%); }

        .um-content { position:absolute; inset:0; z-index:3; display:flex; flex-direction:column;
          justify-content:flex-end; padding:48px 56px; }

        /* Pause Ken-Burns + dot-fill while the form is focused / carousel hovered */
        .um-paused .um-slide.active { animation-play-state:paused; }
        .um-paused .um-dot.active::after { animation-play-state:paused; }

        .um-text { max-width:440px; margin-bottom:6px; }
        .um-eyebrow { display:inline-flex; align-items:center; gap:9px; font-size:11px; font-weight:700;
          letter-spacing:.18em; color:rgba(255,255,255,.9); text-transform:uppercase; margin-bottom:18px;
          background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.22); padding:7px 14px;
          border-radius:20px; backdrop-filter:blur(10px); }
        .um-dot-mark { width:7px; height:7px; border-radius:50%; background:#fff; box-shadow:0 0 0 4px rgba(255,255,255,.22); }
        .um-title { font-family:var(--font-display); font-size:40px; font-weight:800; line-height:1.1;
          letter-spacing:-.035em; color:#fff; margin:0 0 16px; white-space:pre-line; text-shadow:0 2px 24px rgba(0,0,0,.35); }
        .um-desc { font-size:15.5px; font-weight:400; line-height:1.6; color:rgba(255,255,255,.85);
          margin:0; text-shadow:0 1px 12px rgba(0,0,0,.3); }

        /* staggered text-enter */
        .um-anim-in .um-eyebrow { animation:umRise .6s cubic-bezier(.2,.7,.2,1) both; }
        .um-anim-in .um-title   { animation:umRise .6s cubic-bezier(.2,.7,.2,1) .08s both; }
        .um-anim-in .um-desc    { animation:umRise .6s cubic-bezier(.2,.7,.2,1) .16s both; }
        @keyframes umRise { from{opacity:0; transform:translateY(18px); filter:blur(4px);}
          to{opacity:1; transform:translateY(0); filter:blur(0);} }

        .um-dots { display:flex; gap:10px; margin-top:34px; }
        .um-dot { width:28px; height:4px; border-radius:4px; border:none; background:rgba(255,255,255,.30);
          cursor:pointer; padding:0; overflow:hidden; position:relative; transition:background .3s,width .3s; }
        .um-dot.active { width:44px; }
        .um-dot.active::after { content:''; position:absolute; inset:0; background:#fff; transform-origin:left;
          animation:umDotFill ${INTERVAL}ms linear forwards; }
        @keyframes umDotFill { from{transform:scaleX(0);} to{transform:scaleX(1);} }
        .um-dot:hover { background:rgba(255,255,255,.5); }

        /* ---------- RIGHT: form ---------- */
        .um-right { flex:1; background:var(--cream); display:flex; flex-direction:column; align-items:center;
          justify-content:center; padding:48px 56px; position:relative; overflow-y:auto; }
        .um-right::before { content:''; position:absolute; inset:0; pointer-events:none;
          background-image:radial-gradient(circle, rgba(9,66,189,.06) 1px, transparent 1px); background-size:28px 28px; }
        .um-right::after { content:''; position:absolute; top:0; left:0; right:0; height:3px; z-index:2;
          background:linear-gradient(90deg,var(--teal) 0%,var(--cta-blue) 100%); }

        .um-form-wrap { position:relative; z-index:1; width:100%; max-width:360px; }
        .um-form-head { text-align:center; }
        .um-form-logo { margin-bottom:28px; display:flex; justify-content:center; }
        .um-form-eyebrow { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
          color:var(--teal); margin:0 0 10px; }
        .um-form-title { font-family:var(--font-display); font-size:28px; font-weight:700; letter-spacing:-.03em;
          color:var(--ink); margin:0 0 8px; line-height:1.2; }
        .um-form-sub { font-size:14px; color:var(--ink-soft); margin:0 0 32px; line-height:1.55; }

        /* Mobile-only hero (hidden on desktop; shown below 800px where the carousel is gone) */
        .um-mobile-hero { display:none; position:relative; z-index:1; width:100%; box-sizing:border-box;
          background:linear-gradient(135deg, var(--teal) 0%, var(--cta-blue) 100%); color:#fff;
          padding:max(40px, calc(env(safe-area-inset-top) + 16px)) max(28px, env(safe-area-inset-right))
                  34px max(28px, env(safe-area-inset-left));
          text-align:center; }
        .um-mobile-hero-eyebrow { font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
          color:rgba(255,255,255,.85); margin:0 0 12px; }
        .um-mobile-hero-title { font-family:var(--font-display); font-size:23px; font-weight:800;
          letter-spacing:-.02em; line-height:1.2; margin:0; }

        .um-tabs { display:flex; gap:4px; background:#ededeb; border-radius:10px; padding:4px; margin-bottom:24px; }
        .um-tab { flex:1; border:none; background:transparent; padding:9px 16px; border-radius:7px; font-size:13px;
          font-weight:500; color:var(--ink-soft); cursor:pointer; transition:all .2s; font-family:inherit; }
        .um-tab.active { background:#fff; color:var(--teal); font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.04); }

        .um-alert { border-radius:10px; padding:12px 14px; margin-bottom:18px; font-size:.86rem; font-weight:600; }
        .um-alert-error { background:var(--coral-tint); border:1px solid var(--coral); color:var(--coral-deep); }
        .um-alert-info { background:var(--teal-tint); border:1px solid var(--teal); color:var(--teal-deep); }

        .um-field { margin-bottom:16px; }
        .um-field label { display:block; font-size:13px; font-weight:500; color:#374151; margin-bottom:6px; }
        .um-field-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .um-field-row label { margin-bottom:0; }
        .um-field-row a { font-size:12px; color:var(--teal); text-decoration:none; font-weight:500; }
        .um-input { width:100%; box-sizing:border-box; height:44px; padding:0 14px; border:1.5px solid #e5e7eb;
          border-radius:10px; font-size:14px; font-family:inherit; color:var(--ink); background:#fff; outline:none;
          transition:border-color .2s,box-shadow .2s; }
        .um-input:focus { border-color:var(--teal); box-shadow:0 0 0 3.5px rgba(9,66,189,.12); }
        .um-input-wrap { position:relative; }
        .um-input-pw { padding-right:48px; }
        .um-pw-toggle { position:absolute; top:50%; right:4px; transform:translateY(-50%);
          display:flex; align-items:center; justify-content:center; width:40px; height:40px;
          border:none; background:transparent; color:var(--ink-faint); cursor:pointer; border-radius:8px;
          transition:color .2s,background .2s; }
        .um-pw-toggle:hover { color:var(--teal); background:rgba(9,66,189,.06); }
        .um-submit { width:100%; height:46px; margin-top:8px; border:none; border-radius:10px; background:var(--teal);
          color:#fff; font-size:15px; font-weight:600; font-family:inherit; cursor:pointer;
          box-shadow:0 2px 8px rgba(9,66,189,.3); transition:background .2s,transform .1s,box-shadow .2s; }
        .um-submit:hover:not(:disabled) { background:var(--teal-deep); transform:translateY(-1px); box-shadow:0 4px 16px rgba(9,66,189,.35); }
        .um-submit:disabled { opacity:.7; cursor:not-allowed; }
        .um-form-footer { margin-top:24px; text-align:center; font-size:13px; color:var(--ink-faint); }
        .um-form-footer button { color:var(--teal); font-weight:500; background:none; border:none; cursor:pointer; font:inherit; }

        @media (max-width:800px){
          .um-left{ display:none; }
          .um-right{ padding:0; justify-content:flex-start; }
          .um-mobile-hero{ display:block; }
          .um-form-wrap{ max-width:420px;
            padding:32px max(28px, env(safe-area-inset-right))
                    max(44px, calc(env(safe-area-inset-bottom) + 24px)) max(28px, env(safe-area-inset-left)); }
        }
        @media (prefers-reduced-motion: reduce){
          .um-slide,.um-slide.active,.um-anim-in *,.um-dot.active::after{ animation:none !important; transition:opacity .3s !important; }
        }
      `}</style>
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
