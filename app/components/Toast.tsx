"use client";

import { useEffect, useState } from "react";

export interface ToastItem {
  id: number;
  title: string;
  sub: string;
  out?: boolean;
}

interface ToastProps {
  toasts: ToastItem[];
  onRemove: (id: number) => void;
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)",
      zIndex: 90, display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
      width: "calc(100% - 40px)", maxWidth: 440
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            background: "var(--ink)", color: "#fff", borderRadius: 14, padding: "14px 18px",
            boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 12, width: "100%",
            animation: t.out ? "toastOut .3s forwards" : "toastIn .4s cubic-bezier(.2,.9,.2,1)"
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: "var(--green)",
            display: "grid", placeItems: "center", flexShrink: 0
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: ".9rem", lineHeight: 1.25 }}>{t.title}</div>
            <div style={{ fontSize: ".78rem", opacity: .8, lineHeight: 1.3 }}>{t.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

let _id = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (title: string, sub: string) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, title, sub }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, out: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 3600);
  };

  return { toasts, showToast };
}
