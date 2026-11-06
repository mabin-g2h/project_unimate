"use client";

import { useEffect, useState } from "react";
import AppLogo from "./AppLogo";

interface Props {
  onClose: () => void;
  onToast: (title: string, sub: string) => void;
}

const MAX_LEN = 2000;

export default function HelpModal({ onClose, onToast }: Props) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const valid = message.trim().length > 0 && message.length <= MAX_LEN;

  const send = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/students/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onToast("Message sent", "Our team will reply to you by email.");
        onClose();
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes hp-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes hp-fade-in  { from { opacity: 0; }                  to { opacity: 1; }              }
        .hp-outer { display:flex; align-items:center; justify-content:center; padding:20px; }
        .hp-sheet { border-radius:var(--radius); animation: hp-fade-in .2s ease; max-height:90vh; overflow-y:auto; overscroll-behavior:contain; }
        .hp-drag  { display:none; }
        .hp-inner { padding: 32px 28px; position: relative; }
        @media (max-width: 480px) {
          .hp-outer { align-items:flex-end !important; padding:0 !important; }
          .hp-sheet { border-radius:22px 22px 0 0 !important; max-height:92vh !important; animation: hp-slide-up .32s cubic-bezier(0.32,0.72,0,1); }
          .hp-drag  { display:flex; justify-content:center; padding:10px 0 4px; }
          .hp-inner { padding: 20px 20px max(24px, env(safe-area-inset-bottom)) !important; }
          .hp-inner textarea { font-size: 1rem !important; }
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
      <div onClick={onClose} className="hp-outer" style={{ position: "fixed", inset: 0, zIndex: 101 }}>
        <div
          onClick={e => e.stopPropagation()}
          className="hp-sheet"
          style={{ background: "var(--paper)", width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)" }}
        >
          {/* Drag handle — mobile only */}
          <div className="hp-drag">
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.15)" }} />
          </div>

          <div className="hp-inner">
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
                How can we help?
              </h2>
            </div>

            <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", lineHeight: 1.55, margin: "0 0 20px" }}>
              Tell us what&apos;s wrong or what you&apos;re worried about. The UniMate team will read it and reply to you by email.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{
                  fontSize: ".72rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                  letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)",
                }}>
                  Your message
                </span>
                <textarea
                  value={message}
                  rows={6}
                  maxLength={MAX_LEN}
                  placeholder="Describe your issue or question…"
                  autoFocus
                  onChange={e => { setMessage(e.target.value); setError(null); }}
                  style={{ ...inputCss, resize: "vertical", lineHeight: 1.5, minHeight: 130 }}
                />
                <span style={{ alignSelf: "flex-end", fontSize: ".74rem", color: "var(--ink-faint)" }}>
                  {message.length}/{MAX_LEN}
                </span>
              </label>

              {error && (
                <div role="alert" style={{
                  background: "var(--coral-tint)", color: "var(--coral-deep)", borderRadius: 10,
                  padding: "10px 14px", fontSize: ".86rem", fontWeight: 600, lineHeight: 1.4,
                }}>
                  {error}
                </div>
              )}

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
                {saving ? "Sending…" : "Send to support"}
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
