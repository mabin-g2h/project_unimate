"use client";

const services = [
  {
    key: "Accommodation",
    tag: "Team assisted",
    msg: "Our housing team will email you verified options near University of Melbourne.",
    iconClass: "ic-home",
    title: "Find Accommodation",
    desc: "Student housing & shared flats near campus.",
    cta: "Request now",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 3l9 6.5V21H3z" /><path d="M9 21v-7h6v7" />
      </svg>
    ),
    bg: "var(--teal-tint)", color: "var(--teal-deep)"
  },
  {
    key: "Forex Card",
    tag: "Best rate",
    msg: "We'll send your Forex card application link with the best student rates.",
    title: "Apply for Forex Card",
    desc: "Load AUD before you land. Zero markup.",
    cta: "Request now",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /><path d="M6 15h4" />
      </svg>
    ),
    bg: "var(--coral-tint)", color: "var(--coral-deep)"
  },
  {
    key: "Flight Booking",
    tag: "Team assisted",
    msg: "Our travel desk will share flight options around your 8 Feb travel date.",
    title: "Book Air Tickets",
    desc: "Compare & book student-friendly fares.",
    cta: "Request now",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L11 19v-5.5z" />
      </svg>
    ),
    bg: "#E7E2F3", color: "#5A4AA8"
  },
  {
    key: "Document Wallet",
    tag: "Secure",
    msg: "Your secure wallet keeps your CoE, visa & tickets encrypted in one place.",
    title: "Document Wallet",
    desc: "Store CoE, visa, tickets — encrypted.",
    cta: "Open wallet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M16 12h.01" /><path d="M3 9h18" />
      </svg>
    ),
    bg: "#F6EAD0", color: "#9A6B12"
  },
];

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform .25s" }}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

interface ServicesProps {
  onToast: (title: string, sub: string) => void;
}

export default function Services({ onToast }: ServicesProps) {
  return (
    <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, margin: "42px 0 16px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.45rem", letterSpacing: "-.02em" }}>Get sorted before you fly</div>
          <div style={{ color: "var(--ink-soft)", fontSize: ".9rem" }}>Included with your ₹399 plan — our team assists you end to end.</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }} className="svc-grid">
        {services.map((s) => (
          <button
            key={s.key}
            onClick={() => onToast(s.key + " requested", s.msg)}
            style={{
              background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius)",
              padding: 20, boxShadow: "var(--shadow)", cursor: "pointer", textAlign: "left",
              transition: "transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, border-color .25s",
              position: "relative", overflow: "hidden"
            }}
            className="svc-card"
          >
            <span style={{
              position: "absolute", top: 14, right: 14, fontSize: ".62rem", fontWeight: 700,
              letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)",
              background: "var(--cream)", border: "1px solid var(--line)", padding: "3px 8px", borderRadius: 999
            }}>{s.tag}</span>
            <div style={{
              width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center",
              marginBottom: 14, background: s.bg, color: s.color
            }}>
              <div style={{ width: 23, height: 23 }}>{s.icon}</div>
            </div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-.01em" }}>{s.title}</h3>
            <p style={{ fontSize: ".82rem", color: "var(--ink-soft)", marginTop: 3 }}>{s.desc}</p>
            <span style={{ marginTop: 14, fontWeight: 700, fontSize: ".8rem", color: "var(--teal)", display: "flex", alignItems: "center", gap: 6 }}>
              {s.cta} <ArrowRight />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
