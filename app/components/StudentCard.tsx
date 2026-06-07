"use client";

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
  profile_picture_url: string | null;
  departure_from: string | null;
  arrival: string | null;
  travel_date: string | null;
  airline: string | null;
}

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

interface Props {
  peer: Peer;
  myTravelDate: string | null;
  myDepartureFrom: string | null;
  myArrival: string | null;
  index: number;
  onToast: (title: string, sub: string) => void;
}

export default function StudentCard({ peer: s, myTravelDate, myDepartureFrom, myArrival, index: i, onToast }: Props) {
  const sameDate = !!(myTravelDate && s.travel_date && s.travel_date === myTravelDate);
  const sameRoute = sameDate &&
    !!myDepartureFrom && !!myArrival &&
    s.departure_from === myDepartureFrom && s.arrival === myArrival;

  const copyPhone = async () => {
    if (!s.phone) return;
    try {
      await navigator.clipboard.writeText(s.phone);
      onToast("Number copied", `You can now call or save ${s.full_name.split(" ")[0]}'s number.`);
    } catch {
      onToast("Number copied", s.phone);
    }
  };

  return (
    <article
      style={{
        background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius)",
        padding: 18, boxShadow: "var(--shadow)",
        transition: "transform .22s, box-shadow .22s, border-color .22s",
        display: "flex", flexDirection: "column",
        opacity: 0, transform: "translateY(10px)",
        animation: "rise .5s forwards",
        animationDelay: `${Math.min(i * 45, 520)}ms`,
      }}
      className="card"
    >
      <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
        <div style={{
          width: 54, height: 54, borderRadius: 15, flexShrink: 0,
          display: "grid", placeItems: "center", overflow: "hidden",
          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.2rem", color: "#fff",
          position: "relative", background: avColor(s.full_name),
        }}>
          {s.profile_picture_url ? (
            <img
              src={`/api/files/${s.profile_picture_url}`}
              alt={s.full_name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials(s.full_name)
          )}
          <span style={{
            position: "absolute", bottom: -4, right: -4, width: 20, height: 20, borderRadius: "50%",
            background: "var(--green)", display: "grid", placeItems: "center", border: "2.5px solid var(--paper)",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.08rem",
            letterSpacing: "-.01em", lineHeight: 1.15,
          }}>
            {s.full_name}
          </div>
          <div style={{ fontSize: ".82rem", color: "var(--ink-soft)", fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
            </svg>
            {s.university_name}
          </div>
        </div>

        {(sameRoute || sameDate) && (
          <span style={{
            marginLeft: "auto", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5,
            background: sameRoute ? "#059669" : "var(--coral)",
            color: "#fff", fontWeight: 700, fontSize: ".66rem",
            padding: "4px 9px", borderRadius: 999,
            boxShadow: sameRoute
              ? "0 4px 10px -3px rgba(5,150,105,.55)"
              : "0 4px 10px -3px rgba(238,91,54,.6)",
            flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.5 19h19v2h-19zM21 14.6c.2-.8-.3-1.6-1-1.8L14.5 11 8.2 3.8 6.3 4.3l3.7 6.4-5.2-1.4-1.6-2.6-1.5.4 1.1 4 .9 3.3 16 4.3c.8.2 1.6-.3 1.8-1z" />
            </svg>
            {sameRoute ? "Same flight!" : "Same flight day"}
          </span>
        )}
      </div>

      {/* Tags: degree level + country */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "14px 0" }}>
        <span style={{
          fontSize: ".72rem", fontWeight: 600, color: "var(--teal-deep)",
          background: "var(--teal-tint)", border: "1px solid var(--teal-tint)", padding: "4px 9px", borderRadius: 999,
        }}>
          {s.degree_level}
        </span>
        <span style={{
          fontSize: ".72rem", fontWeight: 600, color: "var(--ink-soft)",
          background: "var(--cream)", border: "1px solid var(--line)", padding: "4px 9px", borderRadius: 999,
        }}>
          {s.country_of_origin}
        </span>
      </div>

      <div style={{ display: "flex", gap: 18, fontSize: ".8rem", color: "var(--ink-soft)", marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Programme</b>
          <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: ".86rem" }}>{s.course_name}</span>
        </div>
        <div>
          <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Intake</b>
          <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: ".86rem" }}>{s.intake_month} {s.intake_year}</span>
        </div>
        {s.travel_date && (
          <div>
            <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Flying</b>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: ".86rem" }}>
              {fmtDate(s.travel_date)}
              {s.airline ? ` · ${s.airline}` : ""}
            </span>
          </div>
        )}
        {(s.departure_from || s.arrival) && (
          <div>
            <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".58rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Route</b>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: ".86rem" }}>
              {s.departure_from ? cityOf(s.departure_from) : "?"}
              {" → "}
              {s.arrival ? cityOf(s.arrival) : "?"}
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: 9, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
        <a
          href={`mailto:${s.email}?subject=Hi%20from%20a%20fellow%20Uni%20Mate%20student%20%E2%9C%88%EF%B8%8F&body=Hi%20${encodeURIComponent(s.full_name.split(" ")[0])}%2C%0A%0AI%20found%20you%20on%20Uni%20Mate%20%E2%80%94%20looks%20like%20we're%20both%20heading%20to%20${encodeURIComponent(s.university_name)}!`}
          style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".84rem", padding: "11px 12px",
            borderRadius: 11, cursor: "pointer", border: "1px solid transparent", transition: ".18s",
            textDecoration: "none", background: "var(--teal)", color: "#fff",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
          </svg>
          Email
        </a>

        {s.phone ? (
          <button
            onClick={copyPhone}
            style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".84rem", padding: "11px 12px",
              borderRadius: 11, cursor: "pointer", border: "1px solid var(--line)", transition: ".18s",
              background: "var(--cream-2)", color: "var(--teal-deep)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: ".78rem", fontWeight: 700 }}>
              {s.phone}
            </span>
          </button>
        ) : (
          <div style={{
            flex: "1.1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".84rem", padding: "11px 12px",
            borderRadius: 11, cursor: "not-allowed", border: "1px solid var(--line-soft)",
            background: "var(--cream-2)", color: "var(--lock)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Phone private
          </div>
        )}
      </div>
    </article>
  );
}
