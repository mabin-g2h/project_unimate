"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * First-visit dashboard welcome: an optional Loom video dialog, then a guided
 * tour that spotlights elements marked with data-tour="<key>". On phones
 * (<= 640px, the same breakpoint the dashboard uses to swap the filter row for a drawer) the explanation sits in a bottom card and the target is scrolled
 * into the space above it; on larger screens it is a bubble beside the target.
 */

interface Step {
  key: string;
  target?: string;
  title: (c: Ctx) => string;
  body: (c: Ctx, mobile: boolean) => string;
}

interface Ctx { firstName: string; country: string }

const STEPS: Step[] = [
  {
    key: "welcome",
    title: c => `Welcome to UniMate, ${c.firstName}!`,
    body: () => "You're a verified student with a confirmed seat. Here's a quick tour of what you can do here, and how it helps you before you fly.",
  },
  {
    key: "pass",
    target: "pass",
    title: () => "Your boarding pass",
    body: () => "This is your verified-student ID. It shows every other student that you hold a confirmed seat, so people here can trust you and you can trust them. Your university, course and intake are what peers see when they look for you.",
  },
  {
    key: "flight",
    target: "flight",
    title: () => "Add your flight details",
    body: () => "Tell us when and where you're flying. You'll get a \"Same flight!\" or \"Same day\" badge on students travelling with you, so you can plan to land and travel together instead of alone.",
  },
  {
    key: "peers",
    target: "peers",
    title: () => "Your FlyMates",
    body: c => `Every verified student heading to ${c.country || "your destination country"} appears here, so you can meet people before you arrive.`,
  },
  {
    key: "filters",
    target: "filters",
    title: () => "Find people like you",
    body: (_c, mobile) => mobile
      ? "Tap Filters to narrow the list by university, city, course, degree or intake."
      : "Narrow the list by university, city, course, degree or intake to find students from your campus or your course.",
  },
  {
    key: "contact",
    target: "peer-grid",
    title: () => "Say hello",
    body: () => "Tap any student to see their programme and flight. You can reveal and copy their email to get in touch. Phone numbers show only for students who chose to share theirs.",
  },
  {
    key: "share",
    target: "share",
    title: () => "Share your number, your choice",
    body: () => "Switch this on and peers can call you. It's off by default and you can turn it off at any time. Sharing makes it much easier for your FlyMates to reach you before the flight.",
  },
  {
    key: "invite",
    target: "invite",
    title: () => "Bring friends along",
    body: () => "Know someone else heading abroad with a confirmed seat? Invite them by email. The more students here, the stronger your network gets.",
  },
  {
    key: "done",
    title: () => "You're ready to go",
    body: () => "You can replay this tour any time from the link at the bottom of the page.",
  },
];

const CARD_W = 340;
const PAD = 8;

function findTarget(key: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

interface Box { top: number; left: number; width: number; height: number }

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

interface Props {
  firstName: string;
  country: string;
  /** Loom embed URL; null = no video step. */
  videoEmbedUrl: string | null;
  onFinish: (outcome: "completed" | "skipped", step: number) => void;
}

export default function OnboardingTour({ firstName, country, videoEmbedUrl, onFinish }: Props) {
  const mobile = useIsMobile();
  const [phase, setPhase] = useState<"video" | "tour">(videoEmbedUrl ? "video" : "tour");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ctx: Ctx = { firstName, country };

  // Work out which steps have a visible target once the page has rendered.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setSteps(STEPS.filter(s => !s.target || findTarget(s.target)));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const step = phase === "tour" && steps ? steps[index] : null;
  const last = steps ? index === steps.length - 1 : false;

  const measure = useCallback(() => {
    const el = step?.target ? findTarget(step.target) : null;
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // Scroll the target into view (above the bottom card on phones), then track it.
  useEffect(() => {
    if (!step) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = step.target ? findTarget(step.target) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const area = mobile ? window.innerHeight * 0.5 : window.innerHeight;
      // Phones: centre the target in the space above the bottom card. Desktop: keep it near the
      // top so the bubble fits underneath without covering it.
      const centred = r.height < area - 40 ? (area - r.height) / 2 : 80;
      const offset = mobile ? centred : Math.min(centred, 90);
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - offset), behavior: reduced ? "auto" : "smooth" });
    }
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [step, mobile, measure]);

  const skip = useCallback(() => {
    if (phase === "video") { setPhase("tour"); return; }
    onFinish("skipped", index);
  }, [phase, index, onFinish]);

  const next = () => {
    if (last) onFinish("completed", index);
    else setIndex(i => i + 1);
  };

  // Escape skips; Tab stays inside the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); skip(); return; }
      if (e.key !== "Tab" || !cardRef.current) return;
      const f = Array.from(cardRef.current.querySelectorAll<HTMLElement>("button, a[href], iframe"));
      if (f.length === 0) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [skip]);

  // Move focus into the card whenever it changes.
  useEffect(() => {
    cardRef.current?.focus();
  }, [phase, index, steps]);

  const styles = <style>{`
    @keyframes ob-fade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes ob-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
    .ob-blocker { position: fixed; inset: 0; z-index: 300; background: transparent; }
    .ob-dim { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.55); animation: ob-fade .2s ease; }
    .ob-spot { position: fixed; z-index: 301; border-radius: 16px; box-shadow: 0 0 0 9999px rgba(0,0,0,.55), 0 0 0 2px #fff; pointer-events: none; transition: top .25s ease, left .25s ease, width .25s ease, height .25s ease; }
    .ob-card { position: fixed; z-index: 302; background: var(--paper); color: var(--ink); border-radius: 18px; box-shadow: 0 18px 60px rgba(0,0,0,.3); padding: 20px 22px 18px; width: ${CARD_W}px; max-width: calc(100vw - 32px); outline: none; animation: ob-rise .25s ease; font-family: var(--font-body); }
    .ob-card h2 { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; letter-spacing: -.01em; margin: 0 0 6px; }
    .ob-card p { margin: 0; font-size: .92rem; line-height: 1.5; color: var(--ink-soft); }
    .ob-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; }
    .ob-dots { display: flex; gap: 5px; align-items: center; }
    .ob-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--line); }
    .ob-dot-on { background: var(--teal); width: 16px; border-radius: 4px; }
    .ob-btns { display: flex; gap: 8px; align-items: center; }
    .ob-btn { font-family: var(--font-body); font-weight: 700; font-size: .88rem; border-radius: 980px; padding: 0 18px; min-height: 40px; cursor: pointer; border: 1px solid var(--line); background: var(--paper); color: var(--ink); }
    .ob-btn-primary { background: var(--teal); border-color: var(--teal); color: #fff; }
    .ob-btn-primary:hover { background: var(--teal-deep); }
    .ob-link { background: none; border: none; cursor: pointer; font-family: var(--font-body); font-weight: 600; font-size: .84rem; color: var(--ink-soft); text-decoration: underline; padding: 8px 4px; min-height: 40px; }
    .ob-video-wrap { position: fixed; inset: 0; z-index: 302; display: grid; place-items: center; padding: 16px; }
    .ob-video-card { position: relative; width: min(720px, 100%); background: var(--paper); border-radius: 20px; padding: 20px; box-shadow: 0 18px 60px rgba(0,0,0,.35); animation: ob-rise .25s ease; outline: none; }
    .ob-video-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #000; margin-top: 12px; }
    .ob-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .ob-x { position: absolute; top: 8px; right: 8px; width: 40px; height: 40px; border-radius: 50%; border: none; background: transparent; cursor: pointer; font-size: 1.2rem; color: var(--ink-soft); }
    @media (max-width: 640px) {
      .ob-card { left: 0; right: 0; bottom: 0; top: auto; width: auto; max-width: none; border-radius: 22px 22px 0 0; padding: 18px 20px max(18px, env(safe-area-inset-bottom)); }
      .ob-video-card { padding: 16px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ob-dim, .ob-card, .ob-video-card { animation: none; }
      .ob-spot { transition: none; }
    }
  `}</style>;

  if (phase === "video" && videoEmbedUrl) {
    return (
      <>
        {styles}
        <div className="ob-dim" />
        <div className="ob-video-wrap">
          <div ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ob-video-title" className="ob-video-card">
            <button type="button" className="ob-x" aria-label="Close video" onClick={() => setPhase("tour")}>✕</button>
            <h2 id="ob-video-title" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.2rem", margin: "0 40px 0 0" }}>
              Welcome, {firstName}! Watch this 2-minute intro
            </h2>
            <div className="ob-video-frame">
              <iframe src={videoEmbedUrl} title="UniMate welcome video" allow="fullscreen; picture-in-picture" allowFullScreen />
            </div>
            <div className="ob-row">
              <button type="button" className="ob-link" onClick={() => setPhase("tour")}>Skip video</button>
              <button type="button" className="ob-btn ob-btn-primary" onClick={() => setPhase("tour")}>Take the tour →</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!step || !steps) return null;

  let pos: CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  if (!mobile && box) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(Math.max(16, box.left), vw - CARD_W - 16);
    if (vh - (box.top + box.height) >= 250) pos = { top: box.top + box.height + 14, left };
    else if (box.top >= 250) pos = { bottom: vh - box.top + 14, left };
    else pos = { bottom: 24, left: Math.max(16, (vw - CARD_W) / 2) };
  }

  return (
    <>
      {styles}
      <div className="ob-blocker" />
      {box ? <div className="ob-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} /> : <div className="ob-dim" />}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        className="ob-card"
        style={mobile ? undefined : pos}
        key={step.key}
      >
        <h2 id="ob-title">{step.title(ctx)}</h2>
        <p>{step.body(ctx, mobile)}</p>
        <div className="ob-row">
          <div className="ob-dots" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => <span key={s.key} className={`ob-dot${i === index ? " ob-dot-on" : ""}`} />)}
          </div>
          <div className="ob-btns">
            {!last && <button type="button" className="ob-link" onClick={skip}>Skip</button>}
            {index > 0 && <button type="button" className="ob-btn" onClick={() => setIndex(i => i - 1)}>Back</button>}
            <button type="button" className="ob-btn ob-btn-primary" onClick={next}>
              {last ? "Got it" : index === 0 ? "Start tour" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
