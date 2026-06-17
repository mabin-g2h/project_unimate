"use client";

import { useRouter } from "next/navigation";
import AppLogo from "./AppLogo";

export default function Navbar() {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 40,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      background: "rgba(255,255,255,0.72)",
      borderBottom: "1px solid rgba(0,0,0,0.1)",
    }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 60, maxWidth: 1120, margin: "0 auto", padding: "0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left))" }}>
        <AppLogo height={40} />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--teal-tint)", color: "var(--teal-deep)",
            fontWeight: 700, fontSize: ".76rem", padding: "7px 12px", borderRadius: 999,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z" />
            </svg>
            Verified
          </span>
          <button
            onClick={signOut}
            title="Sign out"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "none", background: "var(--near-black)",
              borderRadius: 200, padding: "10px 16px", cursor: "pointer",
              fontFamily: "var(--font-body)", fontWeight: 500, fontSize: ".82rem",
              color: "#fff", transition: ".18s",
              minHeight: 44,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hide-mobile-inline">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
