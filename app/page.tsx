"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";
import BoardingPass from "./components/BoardingPass";
import Services from "./components/Services";
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
  profile_picture_url: string | null;
  phone: string | null;
  share_phone: boolean;
  departure_from: string | null;
  arrival: string | null;
  travel_date: string | null;
  airline: string | null;
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
        if (!user.registration_status) { router.replace("/register"); return; }
        if (user.registration_status !== "approved") { router.replace("/pending"); return; }
        loadData().then(() => setReady(true));
      });
  }, [router, loadData]);

  const handleFlightSaved = (details: FlightDetails) => {
    setMyProfile(p => p ? { ...p, ...details } : p);
    setShowFlightModal(false);
    // Reload peers so "same flight day" badges refresh
    fetch("/api/students/peers").then(r => r.json()).then(d => {
      if (d.peers) setPeers(d.peers);
    });
  };

  const toggleSharePhone = async () => {
    if (togglingPhone) return;
    const next = !sharePhone;
    setSharePhone(next);
    setTogglingPhone(true);
    try {
      await fetch("/api/students/share-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_phone: next }),
      });
      showToast(
        next ? "Phone shared" : "Phone hidden",
        next ? "Your number is now visible to peers." : "Your number is now private."
      );
    } finally {
      setTogglingPhone(false);
    }
  };

  if (!ready) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  const peersCount = peers.length;
  const sharingPhoneCount = peers.filter(p => p.phone !== null).length;
  // Count peers on same route (departure + arrival + date), or date-only if no route set
  const flyingSameDayCount = myProfile?.travel_date
    ? peers.filter(p => {
        if (p.travel_date !== myProfile.travel_date) return false;
        if (myProfile.departure_from && myProfile.arrival)
          return p.departure_from === myProfile.departure_from && p.arrival === myProfile.arrival;
        return true;
      }).length
    : null;

  return (
    <>
      <Navbar
        name={myProfile?.full_name}
        university={myProfile?.university_name}
      />

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
          <p style={{ color: "var(--ink-soft)", fontSize: "1.02rem", maxWidth: "54ch", marginTop: 4 }}>
            Your profile is verified and active. Below are verified students heading to your university — connect by email, and reach out by phone where students have chosen to share it.
          </p>

          {myProfile && (
            <BoardingPass
              name={myProfile.full_name}
              university={myProfile.university_name}
              course={myProfile.course_name}
              degreeLevel={myProfile.degree_level}
              intakeMonth={myProfile.intake_month}
              intakeYear={myProfile.intake_year}
              flightDetails={myFlight}
              onAddFlight={() => setShowFlightModal(true)}
            />
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 16 }} className="stats-grid">
            <div style={{ background: "var(--cream-2)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-sm)", padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", letterSpacing: "-.02em", lineHeight: 1, color: "var(--teal)" }}>{peersCount}</div>
              <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", fontWeight: 600, marginTop: 4 }}>At your university</div>
            </div>
            <div style={{ background: "var(--cream-2)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-sm)", padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", letterSpacing: "-.02em", lineHeight: 1 }}>{sharingPhoneCount}</div>
              <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", fontWeight: 600, marginTop: 4 }}>Share their phone</div>
            </div>
            <div style={{ background: "var(--cream-2)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-sm)", padding: "16px 18px" }}>
              {flyingSameDayCount !== null ? (
                <>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", letterSpacing: "-.02em", lineHeight: 1, color: "var(--coral-deep)" }}>{flyingSameDayCount}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", fontWeight: 600, marginTop: 4 }}>
                    {myProfile?.departure_from && myProfile?.arrival ? "Same flight" : `Flying ${fmtDate(myProfile!.travel_date!)}`}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", letterSpacing: "-.02em", lineHeight: 1, color: "var(--ink-faint)" }}>—</div>
                  <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", fontWeight: 600, marginTop: 4 }}>
                    <button onClick={() => setShowFlightModal(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--teal)", fontWeight: 700, fontSize: ".78rem", fontFamily: "var(--font-body)" }}>
                      Add flight date
                    </button>
                    {" "}to see who&apos;s flying with you
                  </div>
                </>
              )}
            </div>
            {/* Share phone toggle card */}
            <div
              onClick={toggleSharePhone}
              style={{
                background: sharePhone ? "var(--teal-tint)" : "var(--cream-2)",
                border: `1px solid ${sharePhone ? "var(--teal)" : "var(--line-soft)"}`,
                borderRadius: "var(--radius-sm)", padding: "16px 18px",
                cursor: togglingPhone ? "wait" : "pointer", transition: ".2s",
                userSelect: "none",
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", letterSpacing: "-.02em", lineHeight: 1, color: sharePhone ? "var(--teal-deep)" : "var(--ink-faint)" }}>
                {sharePhone ? "ON" : "OFF"}
              </div>
              <div style={{ fontSize: ".78rem", color: sharePhone ? "var(--teal-deep)" : "var(--ink-soft)", fontWeight: 600, marginTop: 4 }}>
                Share my phone
              </div>
            </div>
          </div>
        </div>
      </header>

      <Services onToast={showToast} />
      <FlyMateExplorer
        peers={peers}
        myTravelDate={myProfile?.travel_date ?? null}
        myDepartureFrom={myProfile?.departure_from ?? null}
        myArrival={myProfile?.arrival ?? null}
        universityName={myProfile?.university_name ?? ""}
        onToast={showToast}
      />

      <footer style={{ textAlign: "center", marginTop: 54, paddingTop: 24, borderTop: "1px solid var(--line)", color: "var(--ink-faint)", fontSize: ".8rem", maxWidth: 1120, margin: "54px auto 0", padding: "24px 20px 0" }}>
        <b style={{ color: "var(--ink-soft)" }}>Uni Mate</b> — FlyMate peer network.<br />
        Phone numbers are shown only where a student has toggled sharing on.
      </footer>

      {showFlightModal && (
        <FlightDetailsModal
          current={myFlight}
          onSave={handleFlightSaved}
          onClose={() => setShowFlightModal(false)}
        />
      )}

      <Toast toasts={toasts} onRemove={() => {}} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 680px) { .stats-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 360px) { .stats-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 860px) { .svc-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 460px) { .svc-grid { grid-template-columns: 1fr !important; } }
        .svc-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--teal) !important; }
        .card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--teal-tint) !important; }
        .hide-mobile { display: flex; flex-direction: column; }
        @media (max-width: 640px) { .hide-mobile { display: none; } }
      `}</style>
    </>
  );
}
