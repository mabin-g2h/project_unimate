"use client";

import { useEffect, useState } from "react";

interface Props {
  student: { full_name: string | null; profile_id: number | null };
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function RevokeModal({ student, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const valid = reason.trim().length > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes rm-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes rm-fade-in  { from { opacity: 0; }                  to { opacity: 1; }              }
        .rm-outer { display:flex; align-items:center; justify-content:center; padding:20px; }
        .rm-sheet { border-radius:var(--radius); animation: rm-fade-in .2s ease; max-height:90vh; overflow-y:auto; overscroll-behavior:contain; }
        .rm-drag  { display:none; }
        .rm-inner { padding: 32px 28px; position: relative; }
        @media (max-width: 480px) {
          .rm-outer { align-items:flex-end !important; padding:0 !important; }
          .rm-sheet { border-radius:22px 22px 0 0 !important; max-height:92vh !important; animation: rm-slide-up .32s cubic-bezier(0.32,0.72,0,1); }
          .rm-drag  { display:flex; justify-content:center; padding:10px 0 4px; }
          .rm-inner { padding: 20px 20px max(24px, env(safe-area-inset-bottom)) !important; }
          .rm-inner textarea { font-size: 1rem !important; }
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
      <div onClick={onClose} className="rm-outer" style={{ position: "fixed", inset: 0, zIndex: 101 }}>
        <div
          onClick={e => e.stopPropagation()}
          className="rm-sheet"
          style={{ background: "var(--paper)", width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)" }}
        >
          {/* Drag handle — mobile only */}
          <div className="rm-drag">
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.15)" }} />
          </div>

          <div className="rm-inner">
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

            <h2 style={{
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem",
              letterSpacing: "-.02em", margin: "0 0 8px",
            }}>
              <span style={{ color: "var(--coral)" }}>Revoke Access</span>
              {student.full_name && (
                <span style={{ color: "var(--ink)", fontWeight: 600 }}> — {student.full_name}</span>
              )}
            </h2>

            <p style={{ color: "var(--ink-soft)", fontSize: ".9rem", lineHeight: 1.55, margin: "0 0 20px" }}>
              This will suspend the student&apos;s access. They will receive an email explaining the reason.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              <span style={{
                fontSize: ".72rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)",
              }}>
                Reason for suspension
              </span>
              <textarea
                autoFocus
                rows={4}
                maxLength={500}
                value={reason}
                onChange={e => { setReason(e.target.value); setError(""); }}
                placeholder="e.g. Suspicious activity detected on account. Please contact support to resolve."
                style={{
                  fontFamily: "var(--font-body)", fontSize: ".92rem", color: "var(--ink)",
                  background: "var(--cream-2)", border: "1px solid var(--line)", borderRadius: 11,
                  padding: "11px 14px", outline: "none", width: "100%", boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              {reason.length > 0 && (
                <span style={{ fontSize: ".75rem", color: "var(--ink-faint)", textAlign: "right" }}>
                  {reason.length} / 500
                </span>
              )}
            </div>

            {error && (
              <p style={{ color: "var(--coral)", fontSize: ".84rem", margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={submit}
                disabled={!valid || saving}
                style={{
                  padding: "14px", borderRadius: 12, border: "none",
                  background: "var(--coral)", color: "#fff", width: "100%",
                  fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "1rem",
                  cursor: !valid || saving ? "not-allowed" : "pointer",
                  opacity: !valid ? .5 : 1, transition: ".18s",
                  boxShadow: valid ? "0 8px 18px -6px rgba(238,91,54,0.35)" : "none",
                }}
              >
                {saving ? "Revoking…" : "Revoke Access"}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "14px", borderRadius: 12, border: "none",
                  background: "var(--cream-2)", color: "var(--ink-soft)", width: "100%",
                  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
