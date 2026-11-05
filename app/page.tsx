"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";
import BoardingPass from "./components/BoardingPass";
import FlyMateExplorer from "./components/FlyMateExplorer";
import FlightDetailsModal, { FlightDetails } from "./components/FlightDetailsModal";
import Toast, { useToast } from "./components/Toast";
import { Peer } from "./components/StudentCard";

interface MyProfile {
  full_name: string;
  university_name: string;
  degree_level: string;
  course_name: string;
  intake_month: string;
  intake_year: number;
  country_of_origin: string;
  country_of_education: string;
  city: string | null;
  profile_picture_url: string | null;
  phone: string | null;
  share_phone: boolean;
  departure_from: string | null;
  arrival: string | null;
  travel_date: string | null;
  airline: string | null;
}

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [sharePhone, setSharePhone] = useState(false);
  const [togglingPhone, setTogglingPhone] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const { toasts, showToast } = useToast();

  const loadData = useCallback(async () => {
    const [meRes, peersRes] = await Promise.all([
      fetch("/api/students/me"),
      fetch("/api/students/peers"),
    ]);
    const [meJson, peersJson] = await Promise.all([meRes.json(), peersRes.json()]);
    if (meJson.profile) {
      setMyProfile(meJson.profile);
      setSharePhone(meJson.profile.share_phone ?? false);
    }
    if (peersJson.peers) setPeers(peersJson.peers);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(({ user }) => {
        if (!user) { router.replace("/login"); return; }
        if (user.role === "admin") { router.replace("/admin"); return; }
        if (!user.registration_status || user.registration_status === "rejected") { router.replace("/register"); return; }
        if (user.registration_status !== "approved") { router.replace("/pending"); return; }
        loadData().then(() => setReady(true));
      });
  }, [router, loadData]);

  const toggleSharePhone = async () => {
    if (togglingPhone) return;
    const next = !sharePhone;
    setSharePhone(next);
    setTogglingPhone(true);
    try {
      const res = await fetch("/api/students/share-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_phone: next }),
      });
      if (!res.ok) throw new Error("save failed");
      showToast(
        next ? "Phone shared" : "Phone hidden",
        next ? "Your number is now visible to peers." : "Your number is now private."
      );
    } catch {
      setSharePhone(!next);
      showToast("Could not update", "Your sharing setting was not changed. Please try again.");
    } finally {
      setTogglingPhone(false);
    }
  };

  const handleFlightSaved = (details: FlightDetails) => {
    setMyProfile(p => p ? { ...p, ...details } : p);
    setShowFlightModal(false);
    // Reload peers so "same flight day" badges refresh
    fetch("/api/students/peers").then(r => r.json()).then(d => {
      if (d.peers) setPeers(d.peers);
    });
  };



  if (!ready) return (
    <div className="screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid var(--line)", borderTopColor: "var(--teal)", borderRadius: "50%", animation: "spin .8s linear infinite" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  const myFlight: FlightDetails | null =
    myProfile?.departure_from && myProfile.arrival && myProfile.travel_date && myProfile.airline
      ? {
          departure_from: myProfile.departure_from,
          arrival: myProfile.arrival,
          travel_date: myProfile.travel_date,
          airline: myProfile.airline,
        }
      : null;

  const firstName = myProfile?.full_name?.split(" ")[0] ?? "there";

  const atUniversityCount = peers.filter(p =>
    p.university_name === myProfile?.university_name
  ).length;

  const doingCourseCount = peers.filter(p =>
    p.university_name === myProfile?.university_name &&
    p.course_name === myProfile?.course_name &&
    p.degree_level === myProfile?.degree_level
  ).length;

  const sameDegreeCount = peers.filter(p =>
    p.degree_level === myProfile?.degree_level &&
    p.intake_month === myProfile?.intake_month &&
    p.intake_year === myProfile?.intake_year
  ).length;

  const inIntakeCount = peers.filter(p =>
    p.university_name === myProfile?.university_name &&
    p.intake_month === myProfile?.intake_month &&
    p.intake_year === myProfile?.intake_year
  ).length;

  const sameFlightCount = myProfile?.travel_date
    ? peers.filter(p => {
        if (p.travel_date !== myProfile.travel_date) return false;
        if (p.university_name !== myProfile.university_name) return false;
        if (myProfile.arrival) return p.arrival === myProfile.arrival;
        return true;
      }).length
    : null;

  return (
    <>
      <Navbar />

      <header style={{ padding: "34px 0 8px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ fontSize: ".74rem", fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 2, background: "var(--teal)", display: "inline-block" }} />
            Verification complete · profile active
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.9rem,5vw,2.9rem)", letterSpacing: "-.03em", lineHeight: 1.02, marginBottom: 6 }}>
            You&apos;re all set, {firstName}.<br />
            Find your{" "}
            <em style={{ fontStyle: "normal", color: "var(--teal)", position: "relative", whiteSpace: "nowrap" }}>
              FlyMate
              <span style={{ content: '""', position: "absolute", left: 0, right: 0, bottom: 2, height: 8, background: "var(--teal-tint)", zIndex: -1, borderRadius: 4, display: "block" }} />
            </em>
            {myProfile?.university_name ? ` to ${myProfile.university_name}.` : "."}
          </h1>

          {myProfile && (
            <BoardingPass
              name={myProfile.full_name}
              profilePictureUrl={myProfile.profile_picture_url}
              university={myProfile.university_name}
              course={myProfile.course_name}
              degreeLevel={myProfile.degree_level}
              intakeMonth={myProfile.intake_month}
              intakeYear={myProfile.intake_year}
              city={myProfile.city}
              flightDetails={myFlight}
              onAddFlight={() => setShowFlightModal(true)}
              sharePhone={sharePhone}
              onTogglePhone={toggleSharePhone}
              busy={togglingPhone}
              phone={myProfile.phone}
            />
          )}

          {/* Stats — cards stretch to the full boarding-pass width whether 4 or 5 render */}
          <div className="stats-grid">
            {[
              { n: atUniversityCount, label: "At your university", color: "var(--teal)" },
              { n: doingCourseCount, label: "Doing your course", color: "var(--teal)" },
              { n: sameDegreeCount, label: "Doing same degree", color: "var(--teal)" },
              { n: inIntakeCount, label: "In your intake", color: "var(--teal)" },
              ...(sameFlightCount !== null ? [{ n: sameFlightCount, label: "Same flight", color: "var(--coral-deep)" }] : []),
            ].map(st => (
              <div key={st.label} className="stat-card" style={{ ["--stat" as string]: st.color }}>
                <div className="stat-num">{st.n}</div>
                <div className="stat-label">{st.label}</div>
              </div>
            ))}
          </div>

        </div>
      </header>

      <FlyMateExplorer
        peers={peers}
        myTravelDate={myProfile?.travel_date ?? null}
        myDepartureFrom={myProfile?.departure_from ?? null}
        myArrival={myProfile?.arrival ?? null}
        myAirline={myProfile?.airline ?? null}
        myCountry={myProfile?.country_of_education ?? ""}
        onToast={showToast}
      />

      <footer style={{ textAlign: "center", marginTop: 54, paddingTop: 24, borderTop: "1px solid var(--line)", color: "var(--ink-faint)", fontSize: ".8rem", maxWidth: 1120, margin: "54px auto 0", padding: "24px 20px 0" }}>
        <b style={{ color: "var(--ink-soft)" }}>Uni Mate</b> — FlyMate peer network.<br />
        Phone numbers are shown only where a student has toggled sharing on.
      </footer>

      {showFlightModal && (
        <FlightDetailsModal
          current={myFlight}
          destinationCountry={myProfile?.country_of_education ?? ""}
          onSave={handleFlightSaved}
          onClose={() => setShowFlightModal(false)}
        />
      )}

      <Toast toasts={toasts} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes rise { to { opacity: 1; transform: translateY(0) } }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-top: 16px; }
        .stat-card { position: relative; background: var(--paper); border: 1px solid var(--line-soft); border-radius: var(--radius-sm); padding: 18px 20px 16px; box-shadow: var(--shadow); overflow: hidden; }
        .stat-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--stat); opacity: .85; }
        .stat-num { font-family: var(--font-display); font-weight: 800; font-size: 2rem; letter-spacing: -.02em; line-height: 1; color: var(--stat); }
        .stat-label { font-size: .82rem; color: var(--ink-soft); font-weight: 600; margin-top: 6px; }
        @media (max-width: 680px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 360px) { .stats-grid { grid-template-columns: 1fr; } }
        .invite-pill { display:inline-flex; align-items:center; gap:7px; font-family:var(--font-body); font-weight:700; font-size:.84rem; color:var(--teal); background:var(--paper); border:1px solid var(--teal); border-radius:980px; padding:9px 16px; min-height:40px; cursor:pointer; transition:background .18s, color .18s; white-space:nowrap; }
        .invite-pill:hover { background:var(--teal-tint); }
        .invite-pill-solid { background:var(--teal); color:#fff; }
        .invite-pill-solid:hover { background:var(--teal-deep); }
        .card:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 28px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.07) !important; }
        .hide-mobile { display: flex; flex-direction: column; }
        @media (max-width: 640px) { .hide-mobile { display: none; } }
        /* Explorer 2-col responsive */
        .filters-toggle-bar { display: none; }
        .filter-row-desktop { display: block; }
        @media (max-width: 640px) {
          .filter-row-desktop { display: none !important; }
          .filters-toggle-bar { display: flex !important; }
        }
      `}</style>
    </>
  );
}
