"use client";

import { useState, useMemo } from "react";
import StudentCard, { Peer } from "./StudentCard";

interface Props {
  peers: Peer[];
  myTravelDate: string | null;
  myDepartureFrom: string | null;
  myArrival: string | null;
  universityName: string;
  onToast: (title: string, sub: string) => void;
}

export default function FlyMateExplorer({ peers, myTravelDate, myDepartureFrom, myArrival, universityName, onToast }: Props) {
  const [q, setQ] = useState("");
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [sort, setSort] = useState("match");

  const list = useMemo(() => {
    const filtered = peers.filter(s => {
      if (phoneOnly && !s.phone) return false;
      if (q) {
        const hay = (s.full_name + " " + s.course_name + " " + s.country_of_origin).toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name);
      if (sort === "intake") {
        if (a.intake_year !== b.intake_year) return a.intake_year - b.intake_year;
        return a.intake_month.localeCompare(b.intake_month);
      }
      // "match" — same route first (0), same date only (1), no match (2)
      const matchScore = (p: Peer) => {
        if (!myTravelDate || !p.travel_date || p.travel_date !== myTravelDate) return 2;
        if (myDepartureFrom && myArrival && p.departure_from === myDepartureFrom && p.arrival === myArrival) return 0;
        return 1;
      };
      const diff = matchScore(a) - matchScore(b);
      if (diff !== 0) return diff;
      return a.full_name.localeCompare(b.full_name);
    });

    return filtered;
  }, [peers, q, phoneOnly, sort, myTravelDate, myDepartureFrom, myArrival]);

  return (
    <section style={{ maxWidth: 1120, margin: "46px auto 0", padding: "0 20px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.45rem", letterSpacing: "-.02em" }}>
          Your FlyMates
        </div>
        <div style={{ color: "var(--ink-soft)", fontSize: ".9rem" }}>
          Verified students at {universityName || "your university"}.
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "18px 0" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 17, height: 17, color: "var(--ink-faint)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name or course…"
            style={{
              width: "100%", fontFamily: "var(--font-body)", fontSize: ".92rem", color: "var(--ink)",
              background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11,
              padding: "11px 14px 11px 40px", outline: "none", transition: ".2s", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Phone only toggle */}
        <div
          onClick={() => setPhoneOnly(p => !p)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: phoneOnly ? "var(--coral-tint)" : "var(--paper)",
            border: `1px solid ${phoneOnly ? "var(--coral)" : "var(--line)"}`,
            borderRadius: 11, padding: "10px 14px", cursor: "pointer",
            fontWeight: 600, fontSize: ".84rem",
            color: phoneOnly ? "var(--coral-deep)" : "var(--ink-soft)",
            transition: ".18s", userSelect: "none",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
          </svg>
          Shares phone
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{
            fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".84rem", color: "var(--ink)",
            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11,
            padding: "10px 32px 10px 14px", cursor: "pointer", outline: "none", appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2356615a' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
          }}
        >
          <option value="match">Same flight day first</option>
          <option value="intake">Intake (earliest)</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 8, fontSize: ".78rem", color: "var(--ink-soft)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
          Verified student
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          Email available to all
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lock)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Phone shown only if student opted in
        </span>
      </div>

      <div style={{ fontSize: ".84rem", color: "var(--ink-soft)", fontWeight: 600, marginBottom: 14 }}>
        Showing <b style={{ color: "var(--ink)" }}>{list.length}</b> of {peers.length} verified students
      </div>

      {peers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink-soft)" }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--line)", marginBottom: 14 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--ink)" }}>
            No peers yet
          </h3>
          <p>You&apos;re among the first verified students at your university. Check back soon!</p>
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink-soft)" }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--line)", marginBottom: 14 }}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--ink)" }}>No students match these filters</h3>
          <p>Try clearing a filter or widening your search.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {list.map((s, i) => (
            <StudentCard key={s.id} peer={s} myTravelDate={myTravelDate} myDepartureFrom={myDepartureFrom} myArrival={myArrival} index={i} onToast={onToast} />
          ))}
        </div>
      )}
    </section>
  );
}
