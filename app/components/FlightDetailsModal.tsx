"use client";

import { useEffect, useState } from "react";
import AppLogo from "./AppLogo";

export interface FlightDetails {
  departure_from: string;
  arrival: string;
  travel_date: string;
  airline: string;
}

interface Props {
  current: FlightDetails | null;
  destinationCountry: string;
  onSave: (details: FlightDetails) => void;
  onClose: () => void;
}

const OTHER = "__other__";

export default function FlightDetailsModal({ current, destinationCountry, onSave, onClose }: Props) {
  const [form, setForm] = useState<FlightDetails>({
    departure_from: current?.departure_from ?? "",
    arrival: current?.arrival ?? "",
    travel_date: current?.travel_date ?? "",
    airline: current?.airline ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [airports, setAirports] = useState<{ id: number; label: string }[]>([]);
  const [arrivalAirports, setArrivalAirports] = useState<{ id: number; label: string }[]>([]);
  const [airlines, setAirlines] = useState<{ id: number; name: string }[]>([]);
  const [depMode, setDepMode] = useState<"select" | "other">("select");
  const [arrMode, setArrMode] = useState<"select" | "other">("select");

  // Departure stays global (all airports); airlines are global too.
  useEffect(() => {
    Promise.all([
      fetch("/api/options/airports").then(r => r.json()),
      fetch("/api/options/airlines").then(r => r.json()),
    ]).then(([{ airports: ap }, { airlines: al }]) => {
      setAirports(ap ?? []);
      setAirlines(al ?? []);
    });
  }, []);

  // Arrival is scoped to the student's destination country (empty list until one is known).
  useEffect(() => {
    if (!destinationCountry) return;
    let active = true;
    fetch(`/api/options/airports?country=${encodeURIComponent(destinationCountry)}`)
      .then(r => r.json())
      .then(({ airports: ap }) => { if (active) setArrivalAirports(ap ?? []); });
    return () => { active = false; };
  }, [destinationCountry]);

  // "Other" is active when explicitly chosen, or the saved value isn't in the list
  // (e.g. a previously typed-in airport). length>0 guard avoids a false "other"
  // while the list is still loading. Mirrors the registration form's uniOther/cityOther.
  const depOther = depMode === "other" ||
    (!!form.departure_from && airports.length > 0 && !airports.some(a => a.label === form.departure_from));
  const arrOther = arrMode === "other" ||
    (!!form.arrival && arrivalAirports.length > 0 && !arrivalAirports.some(a => a.label === form.arrival));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (k: keyof FlightDetails, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const valid =
    form.departure_from.trim() &&
    form.arrival.trim() &&
    form.travel_date &&
    form.airline;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await fetch("/api/students/flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const selectCss: React.CSSProperties = {
    ...inputCss,
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2356615a' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
  };

  return (
    <>
      <style>{`
        @keyframes fd-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fd-fade-in  { from { opacity: 0; }                  to { opacity: 1; }              }
        .fd-outer { display:flex; align-items:center; justify-content:center; padding:20px; }
        .fd-sheet { border-radius:var(--radius); animation: fd-fade-in .2s ease; max-height:90vh; overflow-y:auto; overscroll-behavior:contain; }
        .fd-drag  { display:none; }
        .fd-inner { padding: 32px 28px; position: relative; }
        @media (max-width: 480px) {
          .fd-outer { align-items:flex-end !important; padding:0 !important; }
          .fd-sheet { border-radius:22px 22px 0 0 !important; max-height:92vh !important; animation: fd-slide-up .32s cubic-bezier(0.32,0.72,0,1); }
          .fd-drag  { display:flex; justify-content:center; padding:10px 0 4px; }
          .fd-inner { padding: 20px 20px max(24px, env(safe-area-inset-bottom)) !important; }
          .fd-inner input, .fd-inner select { font-size: 1rem !important; }
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
      <div
        onClick={onClose}
        className="fd-outer"
        style={{ position: "fixed", inset: 0, zIndex: 101 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="fd-sheet"
          style={{
            background: "var(--paper)", width: "100%", maxWidth: 460,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Drag handle — mobile only */}
          <div className="fd-drag">
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,0.15)" }} />
          </div>

          <div className="fd-inner">
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <AppLogo height={32} />
              <h2 style={{
                fontFamily: "var(--font-display)", fontWeight: 800,
                fontSize: "1.25rem", letterSpacing: "-.02em",
              }}>
                {current ? "Update" : "Add"} flight details
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Departure city / airport">
                <select
                  value={depOther ? OTHER : form.departure_from}
                  onChange={e => {
                    if (e.target.value === OTHER) { setDepMode("other"); set("departure_from", ""); }
                    else { setDepMode("select"); set("departure_from", e.target.value); }
                  }}
                  style={selectCss}
                >
                  <option value="">Select departure</option>
                  {airports.map(a => <option key={a.id} value={a.label}>{a.label}</option>)}
                  <option value={OTHER}>✏️ Other — type it in yourself</option>
                </select>
                {depOther && (
                  <input
                    type="text"
                    style={{ ...inputCss, marginTop: 8 }}
                    value={form.departure_from}
                    placeholder="Type departure city / airport"
                    onChange={e => set("departure_from", e.target.value)}
                  />
                )}
              </Field>

              <Field label="Arrival city / airport">
                <select
                  value={arrOther ? OTHER : form.arrival}
                  onChange={e => {
                    if (e.target.value === OTHER) { setArrMode("other"); set("arrival", ""); }
                    else { setArrMode("select"); set("arrival", e.target.value); }
                  }}
                  style={selectCss}
                >
                  <option value="">{arrivalAirports.length > 0 ? "Select arrival" : "No airports yet — choose Other"}</option>
                  {arrivalAirports.map(a => <option key={a.id} value={a.label}>{a.label}</option>)}
                  <option value={OTHER}>✏️ Other — type it in yourself</option>
                </select>
                {arrOther && (
                  <input
                    type="text"
                    style={{ ...inputCss, marginTop: 8 }}
                    value={form.arrival}
                    placeholder="Type arrival city / airport"
                    onChange={e => set("arrival", e.target.value)}
                  />
                )}
              </Field>

              <Field label="Travel date">
                <input
                  type="date"
                  value={form.travel_date}
                  min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                  onChange={e => set("travel_date", e.target.value)}
                  style={inputCss}
                />
              </Field>

              <Field label="Airline">
                <select value={form.airline} onChange={e => set("airline", e.target.value)} style={selectCss}>
                  <option value="">Select airline</option>
                  {airlines.length === 0 && <option disabled value="">No airlines configured</option>}
                  {airlines.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </Field>

              <button
                onClick={save}
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
                {saving ? "Saving…" : "Save flight details"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{
        fontSize: ".72rem", fontWeight: 700, fontFamily: "var(--font-mono)",
        letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)",
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCss: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: ".92rem", color: "var(--ink)",
  background: "var(--cream-2)", border: "1px solid var(--line)", borderRadius: 11,
  padding: "11px 14px", outline: "none", width: "100%", boxSizing: "border-box",
};
