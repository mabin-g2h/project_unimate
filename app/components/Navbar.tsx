"use client";

import { useRouter } from "next/navigation";

interface NavbarProps {
  name?: string;
  university?: string;
}

export default function Navbar({ name, university }: NavbarProps) {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "…";

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 40,
      backdropFilter: "blur(10px)",
      background: "rgba(244,239,227,.82)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 66, maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, background: "var(--teal)",
            display: "grid", placeItems: "center",
            boxShadow: "0 6px 14px -4px rgba(14,110,98,.5)",
            transform: "rotate(-6deg)",
          }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.18rem", letterSpacing: "-.02em", lineHeight: 1 }}>Uni&nbsp;Mate</div>
            <div style={{ fontSize: ".66rem", fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--teal)" }}>FlyMate Network</div>
          </div>
        </div>

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
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center",
              fontFamily: "var(--font-display)", fontWeight: 700, color: "#fff", fontSize: ".86rem",
              background: "linear-gradient(135deg,var(--coral),var(--coral-deep))",
              boxShadow: "var(--shadow)",
            }}>
              {initials}
            </div>
            <div className="hide-mobile">
              <div style={{ fontWeight: 700, fontSize: ".9rem", lineHeight: 1.1 }}>{name ?? "Loading…"}</div>
              <div style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>{university ?? ""}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "1px solid var(--line)", background: "var(--cream-2)",
              borderRadius: 10, padding: "8px 12px", cursor: "pointer",
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".8rem",
              color: "var(--ink-soft)", transition: ".18s",
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
