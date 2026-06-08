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
  onSave: (details: FlightDetails) => void;
  onClose: () => void;
}

export default function FlightDetailsModal({ current, onSave, onClose }: Props) {
  const [form, setForm] = useState<FlightDetails>({
    departure_from: current?.departure_from ?? "",
    arrival: current?.arrival ?? "",
    travel_date: current?.travel_date ?? "",
    airline: current?.airline ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [airports, setAirports] = useState<{ id: number; label: string }[]>([]);
  const [airlines, setAirlines] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/options/airports").then(r => r.json()),
      fetch("/api/options/airlines").then(r => r.json()),
    ]).then(([{ airports: ap }, { airlines: al }]) => {
      setAirports(ap ?? []);
      setAirlines(al ?? []);
    });
  }, []);

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
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="modal-inner"
        style={{
          background: "var(--paper)", borderRadius: "var(--radius)",
          padding: "32px 28px", width: "100%", maxWidth: 460,
          boxShadow: "var(--shadow-lg)", position: "relative",
          maxHeight: "90vh", overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
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
            <select value={form.departure_from} onChange={e => set("departure_from", e.target.value)} style={selectCss}>
              <option value="">Select departure</option>
              {airports.length === 0 && <option disabled value="">No airports configured</option>}
              {airports.map(a => <option key={a.id} value={a.label}>{a.label}</option>)}
            </select>
          </Field>

          <Field label="Arrival city / airport">
            <select value={form.arrival} onChange={e => set("arrival", e.target.value)} style={selectCss}>
              <option value="">Select arrival</option>
              {airports.length === 0 && <option disabled value="">No airports configured</option>}
              {airports.map(a => <option key={a.id} value={a.label}>{a.label}</option>)}
            </select>
          </Field>

          <Field label="Travel date">
            <input
              type="date"
              value={form.travel_date}
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
              background: "var(--teal)", color: "#fff",
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
