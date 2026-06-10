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

function daysToFly(iso: string): number {
  const now = new Date();
  const t = new Date(iso + "T00:00:00");
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((b - a) / 86400000);
}

interface BoardingPassProps {
  name: string;
  profilePictureUrl?: string | null;
  university: string;
  course: string;
  degreeLevel: string;
  intakeMonth: string;
  intakeYear: number;
  city?: string | null;
  flightDetails: FlightDetails | null;
  onAddFlight: () => void;
  sharePhone: boolean;
  onTogglePhone: () => void;
  phone?: string | null;
}

export default function BoardingPass({
  name, profilePictureUrl, university, course, degreeLevel,
  intakeMonth, intakeYear, city, flightDetails, onAddFlight,
  sharePhone, onTogglePhone, phone,
}: BoardingPassProps) {
  const days = flightDetails ? daysToFly(flightDetails.travel_date) : null;
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
            width: 74, height: 74, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.7rem", color: "#fff",
            background: "linear-gradient(140deg,var(--teal),var(--teal-deep))",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)", position: "relative",
          }}>
            {profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePictureUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
            ) : initials(name)}
            <div style={{
              position: "absolute", bottom: -1, right: -1, width: 26, height: 26, borderRadius: "50%",
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", marginTop: 28, paddingTop: 20, borderTop: "1px dashed var(--line)" }}>
          {[
            { label: "University", value: university },
            { label: "Programme", value: `${degreeLevel} — ${course}` },
            { label: "Intake", value: `${intakeMonth} ${intakeYear}` },
            ...(city ? [{ label: "City", value: city }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <b style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: ".66rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)", fontWeight: 700 }}>{label}</b>
              <span style={{ fontWeight: 700, fontSize: ".96rem" }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={onTogglePhone}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              background: "none", border: "none", padding: "8px 0", cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
              background: sharePhone ? "#22c55e" : "#ef4444",
              boxShadow: sharePhone
                ? "0 0 0 3px rgba(34,197,94,.25)"
                : "0 0 0 3px rgba(239,68,68,.22)",
              display: "inline-block", transition: "background .2s, box-shadow .2s",
            }} />
            <span style={{ fontWeight: 700, fontSize: ".84rem", color: "var(--ink-soft)" }}>
              Share my number
            </span>
            <span style={{ fontSize: ".78rem", color: sharePhone ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
              {sharePhone ? "On" : "Off"}
            </span>
          </button>

          {sharePhone && phone && (
            <span
              title="Visible to your FlyMates"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                paddingLeft: 12, borderLeft: "1px solid var(--line)",
                color: "var(--ink-faint)", opacity: .85,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: ".84rem", fontVariantNumeric: "tabular-nums", letterSpacing: ".01em" }}>
                {phone}
              </span>
            </span>
          )}
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
            <button
              onClick={onAddFlight}
              title="Edit flight details"
              aria-label="Edit flight details"
              style={{
                position: "absolute", top: 6, right: 6, zIndex: 2,
                width: 36, height: 36, borderRadius: "50%", padding: 0,
                background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)",
                color: "#fff", cursor: "pointer", display: "grid", placeItems: "center",
                transition: "background .15s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, paddingRight: 30 }}>
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

            {days !== null && days >= 0 && (
              <div className="days-to-fly-pill">
                <span className="dtf-row dtf-row--track">
                  <span className="dtf-airport dtf-airport--left" />
                  <span className="dtf-runway-full">
                    <span className="dtf-trail" />
                    <span className="dtf-plane-wrap">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.5 19h19v2h-19zM21 14.6c.2-.8-.3-1.6-1-1.8l-5.5-1.5L8.2 3.8 6.3 4.3l3.7 6.4-5.2-1.4-1.6-2.6-1.5.4 1.1 4 .9 3.3 16 4.3c.8.2 1.6-.3 1.8-1z" />
                      </svg>
                    </span>
                  </span>
                  <span className="dtf-airport dtf-airport--right" />
                </span>
                <span className="dtf-row dtf-row--label">
                  <span className="dtf-label-text">
                    {days === 0
                      ? "Boarding today"
                      : <>Boards in <strong className="dtf-label-days">{days}</strong> {days === 1 ? "day" : "days"}</>}
                  </span>
                </span>
              </div>
            )}

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
