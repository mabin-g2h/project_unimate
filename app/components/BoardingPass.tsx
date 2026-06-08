import { FlightDetails } from "./FlightDetailsModal";

function initials(n: string) {
  return n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function extractCode(loc: string) {
  const m = loc.match(/\(([A-Z]{3})\)/);
  return m ? m[1] : loc.replace(/\(.*\)/, "").trim().substring(0, 3).toUpperCase();
}

function extractCity(loc: string) {
  return loc.replace(/\s*\([A-Z]{3}\)\s*/, "").trim();
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface BoardingPassProps {
  name: string;
  university: string;
  course: string;
  degreeLevel: string;
  intakeMonth: string;
  intakeYear: number;
  flightDetails: FlightDetails | null;
  onAddFlight: () => void;
}

export default function BoardingPass({
  name, university, course, degreeLevel,
  intakeMonth, intakeYear, flightDetails, onAddFlight,
}: BoardingPassProps) {
  return (
    <div className="boarding-pass-layout" style={{
      marginTop: 24, background: "var(--paper)", borderRadius: "var(--radius)",
      boxShadow: "var(--shadow)", border: "1px solid var(--line-soft)", overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ content: '""', position: "absolute", inset: 0, background: "radial-gradient(600px 200px at 100% 0,rgba(9,66,189,0.06),transparent 70%)", pointerEvents: "none" }} />

      {/* Main */}
      <div style={{ flex: 1, padding: "26px 28px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 74, height: 74, borderRadius: 20, flexShrink: 0, display: "grid", placeItems: "center",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.7rem", color: "#fff",
            background: "linear-gradient(140deg,var(--teal),var(--teal-deep))",
            boxShadow: "0 12px 22px -8px rgba(9,66,189,0.4)", position: "relative",
          }}>
            {initials(name)}
            <div style={{
              position: "absolute", bottom: -5, right: -5, width: 28, height: 28, borderRadius: "50%",
              background: "var(--green)", display: "grid", placeItems: "center", border: "3px solid var(--paper)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-.02em", lineHeight: 1.1 }}>{name}</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--green)", fontWeight: 700, fontSize: ".84rem", marginTop: 3 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
              </svg>
              Verified Student · CoE confirmed
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", marginTop: 20, paddingTop: 18, borderTop: "1px dashed var(--line)" }}>
          {[
            { label: "University", value: university },
            { label: "Programme", value: `${degreeLevel} — ${course}` },
            { label: "Intake", value: `${intakeMonth} ${intakeYear}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".66rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)", fontWeight: 700 }}>{label}</b>
              <span style={{ fontWeight: 700, fontSize: ".96rem" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stub */}
      <div className="boarding-pass-stub" style={{
        width: 220, flexShrink: 0,
        background: "linear-gradient(160deg,var(--teal-deep),var(--teal))",
        color: "#fff", padding: "24px 22px", position: "relative",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <span className="boarding-pass-stub-line" style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderLeft: "2px dashed rgba(255,255,255,.4)" }} />

        {flightDetails ? (
          <>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.7rem", lineHeight: 1 }}>
                    {extractCode(flightDetails.departure_from)}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: ".6rem", letterSpacing: ".12em", opacity: .8, textTransform: "uppercase", marginTop: 3 }}>
                    {extractCity(flightDetails.departure_from)}
                  </div>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: .85 }}>
                  <path d="M2.5 19h19v2h-19zM21 14.6c.2-.8-.3-1.6-1-1.8l-5.5-1.5L8.2 3.8 6.3 4.3l3.7 6.4-5.2-1.4-1.6-2.6-1.5.4 1.1 4 .9 3.3 16 4.3c.8.2 1.6-.3 1.8-1z" />
                </svg>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.7rem", lineHeight: 1 }}>
                    {extractCode(flightDetails.arrival)}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: ".6rem", letterSpacing: ".12em", opacity: .8, textTransform: "uppercase", marginTop: 3 }}>
                    {extractCity(flightDetails.arrival)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 10px", margin: "18px 0" }}>
              {[
                { label: "Travel date", value: fmtDate(flightDetails.travel_date) },
                { label: "Airline", value: flightDetails.airline },
              ].map(({ label, value }) => (
                <div key={label}>
                  <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".58rem", letterSpacing: ".1em", textTransform: "uppercase", opacity: .7 }}>{label}</b>
                  <span style={{ fontWeight: 700, fontSize: ".86rem" }}>{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onAddFlight}
              style={{
                background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)",
                borderRadius: 10, padding: "9px 12px", cursor: "pointer",
                color: "#fff", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".78rem",
                textAlign: "left", width: "100%",
              }}
            >
              ✏️ Edit flight details
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, flex: 1, justifyContent: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: .7 }}>
                <path d="M2.5 19h19v2h-19zM21 14.6c.2-.8-.3-1.6-1-1.8l-5.5-1.5L8.2 3.8 6.3 4.3l3.7 6.4-5.2-1.4-1.6-2.6-1.5.4 1.1 4 .9 3.3 16 4.3c.8.2 1.6-.3 1.8-1z" />
              </svg>
              <p style={{ fontWeight: 700, fontSize: ".88rem", opacity: .9, margin: 0 }}>
                Add your flight details to find students flying the same day
              </p>
              <button
                onClick={onAddFlight}
                style={{
                  background: "rgba(255,255,255,.22)", border: "1px solid rgba(255,255,255,.4)",
                  borderRadius: 10, padding: "10px 16px", cursor: "pointer",
                  color: "#fff", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".84rem",
                }}
              >
                + Add flight details
              </button>
            </div>

            <div style={{
              background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.25)",
              borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7CFFB2", boxShadow: "0 0 0 4px rgba(124,255,178,.25)", display: "inline-block" }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: ".78rem", lineHeight: 1.1 }}>ACTIVE</div>
                <div style={{ fontSize: ".66rem", opacity: .85 }}>Until your CoE start date</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
