"use client";

import { useState, useMemo } from "react";
import StudentCard, { Peer } from "./StudentCard";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: ".84rem", color: "var(--ink)",
  background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11,
  padding: "10px 32px 10px 14px", cursor: "pointer", outline: "none", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2356615a' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
};

interface Props {
  peers: Peer[];
  myTravelDate: string | null;
  myDepartureFrom: string | null;
  myArrival: string | null;
  myCountry: string;
  onToast: (title: string, sub: string) => void;
}

export default function FlyMateExplorer({ peers, myTravelDate, myDepartureFrom, myArrival, myCountry, onToast }: Props) {
  const [q, setQ] = useState("");
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [sort, setSort] = useState("match");
  const [university, setUniversity] = useState("");
  const [city, setCity] = useState("");
  const [course, setCourse] = useState("");
  const [degree, setDegree] = useState("");
  const [intake, setIntake] = useState(""); // "month|year"

  function clearFilters() {
    setUniversity(""); setCity(""); setCourse(""); setDegree(""); setIntake("");
  }

  // Filter dropdown options — derived from the country pool so only present values show.
  const universityOptions = useMemo(() => [...new Set(peers.map(s => s.university_name))].sort((a, b) => a.localeCompare(b)), [peers]);
  const cityOptions = useMemo(() => [...new Set(peers.map(s => s.city).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [peers]);
  const courseOptions = useMemo(() => [...new Set(peers.map(s => s.course_name))].sort((a, b) => a.localeCompare(b)), [peers]);
  const degreeOptions = useMemo(() => [...new Set(peers.map(s => s.degree_level))].sort((a, b) => a.localeCompare(b)), [peers]);
  const intakeOptions = useMemo(() => {
    const seen = new Map<string, { month: string; year: number }>();
    for (const s of peers) seen.set(`${s.intake_month}|${s.intake_year}`, { month: s.intake_month, year: s.intake_year });
    return [...seen.values()].sort((a, b) => (a.year !== b.year ? a.year - b.year : MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)));
  }, [peers]);

  const list = useMemo(() => {
    const filtered = peers.filter(s => {
      if (university && s.university_name !== university) return false;
      if (city && s.city !== city) return false;
      if (course && s.course_name !== course) return false;
      if (degree && s.degree_level !== degree) return false;
      if (intake && `${s.intake_month}|${s.intake_year}` !== intake) return false;
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
        return MONTHS.indexOf(a.intake_month) - MONTHS.indexOf(b.intake_month);
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
  }, [peers, q, phoneOnly, sort, university, city, course, degree, intake, myTravelDate, myDepartureFrom, myArrival]);

  const chips = [
    university && { label: `University: ${university}`, clear: () => setUniversity("") },
    city && { label: `City: ${city}`, clear: () => setCity("") },
    course && { label: `Course: ${course}`, clear: () => setCourse("") },
    degree && { label: `Degree: ${degree}`, clear: () => setDegree("") },
    intake && { label: `Intake: ${intake.replace("|", " ")}`, clear: () => setIntake("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <section style={{ maxWidth: 1120, margin: "46px auto 0", padding: "0 20px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.45rem", letterSpacing: "-.02em" }}>
          Your FlyMates
        </div>
        <div style={{ color: "var(--ink-soft)", fontSize: ".9rem" }}>
          Verified students heading to {myCountry || "your destination country"}. Filter by university, city, course, intake and more.
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "0 0 12px" }}>
        {/* Search */}
        <div className="search-full-mobile" style={{ flex: 1, minWidth: 0, position: "relative" }}>
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

        {/* University filter */}
        <select value={university} onChange={e => setUniversity(e.target.value)} style={selectStyle}>
          <option value="">All universities</option>
          {universityOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        {/* City filter */}
        <select value={city} onChange={e => setCity(e.target.value)} style={selectStyle}>
          <option value="">All cities</option>
          {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Course filter */}
        <select value={course} onChange={e => setCourse(e.target.value)} style={selectStyle}>
          <option value="">All courses</option>
          {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Degree filter */}
        <select value={degree} onChange={e => setDegree(e.target.value)} style={selectStyle}>
          <option value="">All degrees</option>
          {degreeOptions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Intake filter */}
        <select value={intake} onChange={e => setIntake(e.target.value)} style={selectStyle}>
          <option value="">All intakes</option>
          {intakeOptions.map(({ month, year }) => (
            <option key={`${month}|${year}`} value={`${month}|${year}`}>{month} {year}</option>
          ))}
        </select>

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
        <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
          <option value="match">Same flight day first</option>
          <option value="intake">Intake (earliest)</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
          {chips.map(chip => (
            <button
              key={chip.label}
              onClick={chip.clear}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--teal-tint)", border: "1px solid var(--teal-tint)",
                color: "var(--teal-deep)", borderRadius: 999, padding: "5px 10px",
                fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".78rem", cursor: "pointer",
              }}
            >
              {chip.label}
              <span style={{ fontSize: ".9rem", lineHeight: 1 }}>×</span>
            </button>
          ))}
          <button
            onClick={clearFilters}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--ink-soft)", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: ".78rem",
              textDecoration: "underline", padding: "5px 4px",
            }}
          >
            Clear all
          </button>
        </div>
      )}

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
        Showing <b style={{ color: "var(--ink)" }}>{list.length}</b> {list.length === 1 ? "student" : "students"}
        {` in ${myCountry || "your destination country"}`}
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
          <p>You&apos;re among the first verified students heading to {myCountry || "your destination country"}. Check back soon!</p>
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
