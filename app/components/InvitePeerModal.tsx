"use client";

import { useEffect, useState } from "react";
import AppLogo from "./AppLogo";

interface Props {
  onClose: () => void;
  onToast: (title: string, sub: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InvitePeerModal({ onClose, onToast }: Props) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const valid = EMAIL_RE.test(email.trim());

  const send = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/students/invite-peer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onToast("Invite sent", "We've emailed your peer an invitation to join UniMate.");
        onClose();
      } else {
        onToast("Couldn't send invite", data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      onToast("Couldn't send invite", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes ip-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes ip-fade-in  { from { opacity: 0; }                  to { opacity: 1; }              }
        .ip-outer { display:flex; align-items:center; justify-content:center; padding:20px; }
        .ip-sheet { border-radius:var(--radius); animation: ip-fade-in .2s ease; max-height:90vh; overflow-y:auto; overscroll-behavior:contain; }
        .ip-drag  { display:none; }
        .ip-inner { padding: 32px 28px; position: relative; }
        @media (max-width: 480px) {
          .ip-outer { align-items:flex-end !important; padding:0 !important; }
          .ip-sheet { border-radius:22px 22px 0 0 !important; max-height:92vh !important; animation: ip-slide-up .32s cubic-bezier(0.32,0.72,0,1); }
          .ip-drag  { display:flex; justify-content:center; padding:10px 0 4px; }
          .ip-inner { padding: 20px 20px max(24px, env(safe-area-inset-bottom)) !important; }
          .ip-inner input { font-size: 1rem !important; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet wrapper */}
      <div onClick={onClose} className="ip-outer" style={{ position: "fixed", inset: 0, zIndex: 101 }}>
        <div
          onClick={e => e.stopPropagation()}
          className="ip-sheet"
          style={{ background: "var(--paper)", width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)" }}
        >
          {/* Drag handle — mobile only */}
          <div className="ip-drag">
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.15)" }} />
          </div>

          <div className="ip-inner">
            <button
              onClick={onClose}
              style={{
                position: "absolute", top: 14, right: 14,
                border: "none", background: "var(--cream-2)", borderRadius: 8,
                padding: "10px 12px", cursor: "pointer", color: "var(--ink-soft)",
                fontWeight: 700, fontSize: ".9rem", lineHeight: 1,
                minWidth: 44, minHeight: 44, display: "grid", placeItems: "center",
              }}
            >
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <AppLogo height={32} />
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-.02em" }}>
                Invite a peer
              </h2>
            </div>

            <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", lineHeight: 1.55, margin: "0 0 20px" }}>
              Know someone heading abroad to study? Send them an invitation to join UniMate — we&apos;ll email them on your behalf.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{
                  fontSize: ".72rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                  letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)",
                }}>
                  Peer&apos;s email
                </span>
                <input
                  type="email"
                  value={email}
                  placeholder="peer@example.com"
                  autoFocus
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") send(); }}
                  style={inputCss}
                />
              </label>

              <button
                onClick={send}
                disabled={saving || !valid}
                style={{
                  marginTop: 6, padding: "14px", borderRadius: 12, border: "none",
                  background: "var(--teal)", color: "#fff", width: "100%",
                  fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "1rem",
                  cursor: saving || !valid ? "not-allowed" : "pointer",
                  opacity: !valid ? .5 : 1, transition: ".18s",
                  boxShadow: valid ? "0 8px 18px -6px rgba(9,66,189,0.35)" : "none",
                }}
              >
                {saving ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const inputCss: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: ".92rem", color: "var(--ink)",
  background: "var(--cream-2)", border: "1px solid var(--line)", borderRadius: 11,
  padding: "11px 14px", outline: "none", width: "100%", boxSizing: "border-box",
};
