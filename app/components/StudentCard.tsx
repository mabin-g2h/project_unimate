"use client";

import { useState, useEffect } from "react";

export interface Peer {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  course_name: string;
  degree_level: string;
  intake_month: string;
  intake_year: number;
  country_of_origin: string;
  university_name: string;
  city: string | null;
  profile_picture_url: string | null;
  departure_from: string | null;
  arrival: string | null;
  travel_date: string | null;
  airline: string | null;
}

const appleFont = "-apple-system, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif";

function avColor(n: string) {
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
  const h2 = (h + 38) % 360;
  return `linear-gradient(140deg,hsl(${h} 52% 42%),hsl(${h2} 56% 32%))`;
}

function initials(n: string) {
  return n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function cityOf(loc: string) {
  return loc.replace(/\s*\([A-Z]{3}\)\s*/, "").trim();
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  const badgeSize = size <= 60 ? 18 : 22;
  return (
    <div style={{ width: size, height: size, flexShrink: 0, position: "relative" }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", overflow: "hidden",
        display: "grid", placeItems: "center",
        background: avColor(name),
        fontWeight: 600, fontSize: size * 0.28, color: "#fff", fontFamily: appleFont,
      }}>
        {src ? (
          <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : initials(name)}
      </div>
      <span style={{
        position: "absolute", bottom: 0, right: 0,
        width: badgeSize, height: badgeSize, borderRadius: "50%",
        background: "#30D158", border: "2.5px solid #fff",
        display: "grid", placeItems: "center",
      }}>
        <svg width={badgeSize * 0.5} height={badgeSize * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    </div>
  );
}

interface Props {
  peer: Peer;
  myTravelDate: string | null;
  myDepartureFrom: string | null;
  myArrival: string | null;
  index: number;
  onToast: (title: string, sub: string) => void;
}

export default function StudentCard({ peer: s, myTravelDate, myDepartureFrom, myArrival, index: i }: Props) {
  const [open, setOpen] = useState(false);

  const sameDate = !!(myTravelDate && s.travel_date && s.travel_date === myTravelDate);
  const sameRoute = sameDate &&
    !!myDepartureFrom && !!myArrival &&
    s.departure_from === myDepartureFrom && s.arrival === myArrival;

  const flightLine = s.travel_date
    ? [
        fmtDate(s.travel_date),
        s.airline ? `· ${s.airline}` : "",
        s.departure_from && s.arrival ? `· ${cityOf(s.departure_from)} → ${cityOf(s.arrival)}` : "",
      ].filter(Boolean).join(" ")
    : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const flightBadge = (sameRoute || sameDate) && (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "#34C759", color: "#fff",
      fontWeight: 600, fontSize: 11, fontFamily: appleFont,
      padding: "3px 8px", borderRadius: 980,
      whiteSpace: "nowrap",
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.5 19h19v2h-19zM21 14.6c.2-.8-.3-1.6-1-1.8L14.5 11 8.2 3.8 6.3 4.3l3.7 6.4-5.2-1.4-1.6-2.6-1.5.4 1.1 4 .9 3.3 16 4.3c.8.2 1.6-.3 1.8-1z" />
      </svg>
      {sameRoute ? "Same flight!" : "Same day"}
    </span>
  );

  return (
    <>
      {/* ── Compact tile ── */}
      <article
        onClick={() => setOpen(true)}
        style={{
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.07)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: appleFont,
          cursor: "pointer",
          transition: "transform .22s ease, box-shadow .22s ease",
          opacity: 0,
          transform: "translateY(10px)",
          animation: "rise .5s forwards",
          animationDelay: `${Math.min(i * 45, 520)}ms`,
          userSelect: "none",
        }}
        className="card"
      >
        {/* Accent bar */}
        <div style={{ height: 3, width: "100%", background: "linear-gradient(90deg,#0071e3,#34aadc)", flexShrink: 0 }} />

        <div style={{ padding: "20px 16px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box" }}>
          <Avatar src={s.profile_picture_url} name={s.full_name} size={88} />

          <div style={{ textAlign: "center", width: "100%" }}>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.3px", color: "#1d1d1f", lineHeight: 1.25 }}>
              {s.full_name}
            </div>
            <div style={{ fontSize: 13, color: "#0071e3", fontWeight: 500, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.university_name}
            </div>
            {s.city && (
              <div style={{ fontSize: 13, color: "#86868b", marginTop: 2 }}>
                {s.city}
              </div>
            )}
          </div>

          {flightBadge && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {flightBadge}
            </div>
          )}
        </div>
      </article>

      {/* ── Detail modal ── */}
      {open && (
        <>
          <style>{`
            @keyframes sc-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @keyframes sc-fade-in  { from { opacity: 0; }               to { opacity: 1; }              }
            .sc-outer { display:flex; align-items:center; justify-content:center; padding:20px; }
            .sc-sheet { border-radius:22px; animation: sc-fade-in .2s ease; }
            .sc-drag  { display:none; }
            .sc-modal-header { display:flex; flex-direction:row; gap:16px; align-items:flex-start; margin-bottom:18px; }
            .sc-modal-identity { flex:1; min-width:0; padding-top:4px; }
            .sc-modal-name-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
            .sc-modal-inner { padding: 20px 24px 24px; position:relative; }
            @media (max-width: 480px) {
              .sc-outer { align-items:flex-end !important; padding:0 !important; }
              .sc-sheet { border-radius:22px 22px 0 0 !important; max-height:92vh !important; animation: sc-slide-up .32s cubic-bezier(0.32,0.72,0,1); }
              .sc-drag  { display:flex; justify-content:center; padding:10px 0 4px; }
              .sc-modal-header { flex-direction:column !important; align-items:center !important; text-align:center; }
              .sc-modal-identity { padding-top:0 !important; display:flex; flex-direction:column; align-items:center; }
              .sc-modal-name-row { flex-direction:column; align-items:center; gap:8px; }
              .sc-modal-inner { padding-bottom: max(24px, env(safe-area-inset-bottom)) !important; }
            }
          `}</style>

          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 300,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />

          {/* Sheet wrapper — click outside to close */}
          <div
            onClick={() => setOpen(false)}
            className="sc-outer"
            style={{ position: "fixed", inset: 0, zIndex: 301 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="sc-sheet"
              style={{
                background: "#fff",
                width: "100%", maxWidth: 440,
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                overflow: "hidden", fontFamily: appleFont,
                maxHeight: "90vh", overflowY: "auto",
              }}
            >
              {/* Drag handle — visible only on mobile via CSS */}
              <div className="sc-drag">
                <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.15)" }} />
              </div>

              {/* Accent bar */}
              <div style={{ height: 3, background: "linear-gradient(90deg,#0071e3,#34aadc)" }} />

              <div className="sc-modal-inner">
                {/* Close button */}
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    position: "absolute", top: 16, right: 16,
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer",
                    display: "grid", placeItems: "center", color: "#86868b",
                    fontFamily: appleFont, fontSize: 16, lineHeight: 1,
                    transition: "background .15s",
                  }}
                >
                  ×
                </button>

                {/* Header */}
                <div className="sc-modal-header">
                  <Avatar src={s.profile_picture_url} name={s.full_name} size={80} />

                  <div className="sc-modal-identity">
                    <div className="sc-modal-name-row">
                      <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.4px", color: "#1d1d1f", lineHeight: 1.2 }}>
                        {s.full_name}
                      </div>
                      {flightBadge}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
                      </svg>
                      <span style={{ fontSize: 14, color: "#0071e3", fontWeight: 500 }}>{s.university_name}</span>
                    </div>
                    {s.city && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <span style={{ fontSize: 14, color: "#86868b" }}>{s.city}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tag pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
                  <span style={{ background: "rgba(0,113,227,0.1)", color: "#0071e3", fontSize: 13, fontWeight: 500, padding: "5px 13px", borderRadius: 980 }}>
                    {s.degree_level}
                  </span>
                  <span style={{ background: "rgba(0,0,0,0.05)", color: "#3d3d3d", fontSize: 13, fontWeight: 500, padding: "5px 13px", borderRadius: 980 }}>
                    {s.country_of_origin}
                  </span>
                </div>

                {/* Details panel */}
                <div style={{ background: "#f5f5f7", borderRadius: 14, marginBottom: 20, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: "13px 16px", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", color: "#86868b", marginBottom: 5 }}>Programme</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#1d1d1f", lineHeight: 1.3 }}>{s.course_name}</div>
                    </div>
                    <div style={{ padding: "13px 16px" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", color: "#86868b", marginBottom: 5 }}>Intake</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#1d1d1f", lineHeight: 1.3 }}>{s.intake_month} {s.intake_year}</div>
                    </div>
                  </div>
                  {flightLine && (
                    <>
                      <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />
                      <div style={{ padding: "13px 16px" }}>
                        <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", color: "#0071e3", marginBottom: 5 }}>Flying</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "#1d1d1f", lineHeight: 1.3 }}>{flightLine}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <a
                    href={`mailto:${s.email}?subject=Hi%20from%20a%20fellow%20Uni%20Mate%20student%20%E2%9C%88%EF%B8%8F&body=Hi%20${encodeURIComponent(s.full_name.split(" ")[0])}%2C%0A%0AI%20found%20you%20on%20Uni%20Mate%20%E2%80%94%20looks%20like%20we're%20both%20heading%20to%20${encodeURIComponent(s.university_name)}!`}
                    style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                      fontFamily: appleFont, fontWeight: 600, fontSize: 15, padding: "13px 12px",
                      borderRadius: 980, cursor: "pointer", border: "none", transition: ".18s",
                      textDecoration: "none", background: "#0071e3", color: "#fff",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                    </svg>
                    Email
                  </a>

                  {s.phone ? (
                    <a
                      href={`tel:${s.phone}`}
                      style={{
                        flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                        fontFamily: appleFont, fontWeight: 600, fontSize: 15, padding: "13px 12px",
                        borderRadius: 980, cursor: "pointer", border: "none", transition: ".18s",
                        background: "rgba(0,0,0,0.05)", color: "#1d1d1f", textDecoration: "none",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
                      </svg>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{s.phone}</span>
                    </a>
                  ) : (
                    <div style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                      fontFamily: appleFont, fontWeight: 600, fontSize: 15, padding: "13px 12px",
                      borderRadius: 980, background: "rgba(0,0,0,0.03)", color: "#aeaeb2",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                      Private
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
