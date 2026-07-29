import { useEffect, useState } from "react";

import BottomNav from "./components/BottomNav";
import AuthScreen from "./auth/AuthScreen";
import { supabase } from "./auth/supabaseClient";

import HomeScreen from "./screens/HomeScreen";
import TripsScreen from "./screens/TripsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AIChatScreen from "./screens/AIChatScreen";
import UserChatScreen from "./screens/UserChatScreen";
import AgencyDashboardScreen from "./screens/AgencyDashboardScreen";
import { useAuth } from "./auth/AuthContext";

import "./index.css";

const PENDING_INQUIRY_KEY = "travaPendingInquiry";

function readPendingInquiry() {
  try {
    const stored = window.sessionStorage.getItem(PENDING_INQUIRY_KEY);

    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function savePendingInquiry(inquiry) {
  try {
    if (!inquiry) {
      window.sessionStorage.removeItem(PENDING_INQUIRY_KEY);
      return;
    }

    window.sessionStorage.setItem(PENDING_INQUIRY_KEY, JSON.stringify(inquiry));
  } catch {
    // React state still carries the inquiry.
  }
}

export default function App() {
  const { user } = useAuth();
  // 1. Identify user type (safely fallback to Traveler if metadata is missing)
  const isAgency = user?.user_metadata?.role === "Agency";
  console.log("isAgency: ", isAgency);
  console.log(isAgency ? "Agency" : "Traveler");

  // 2. Set initial landing screen based on role
  const [currentScreen, setCurrentScreen] = useState(
    isAgency ? "dashboard" : "explore",
  );

  // NEW: State to store the active trip ID when transitioning to the workspace/trips view
  const [activeTripId, setActiveTripId] = useState(null);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [chatInquiry, setChatInquiry] = useState(readPendingInquiry);

  function goToExplore() {
    setCurrentScreen("explore");
  }

  function goToDashboard() {
    setCurrentScreen("dashboard");
  }

  function goToTrips() {
    setCurrentScreen("trips");
  }

  // NEW: Handler called when Agency Dashboard creates or opens a trip
  function openTripWorkspace(tripId) {
    setActiveTripId(tripId);
    setCurrentScreen("trips"); // Directs agency directly into the workspace/trips screen
  }

  function goToSmartMatch() {
    setCurrentScreen("smartmatch");
  }

  function goToProfile() {
    setCurrentScreen("profile");
  }

  function goToMessages() {
    const pendingInquiry = chatInquiry || readPendingInquiry();

    if (pendingInquiry && !chatInquiry) {
      setChatInquiry(pendingInquiry);
    }

    setCurrentScreen("chat");
  }

  function openInquiryChat(inquiry) {
    if (!inquiry) {
      setCurrentScreen("chat");
      return;
    }

    const normalizedInquiry = {
      ...inquiry,
      navigationId:
        inquiry.navigationId ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    savePendingInquiry(normalizedInquiry);
    setChatInquiry(normalizedInquiry);
    setCurrentScreen("chat");
  }

  function clearHandledInquiry() {
    savePendingInquiry(null);
    setChatInquiry(null);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error("Session load error:", error);
      }

      setSession(data?.session || null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="loading">Loading TRAVA...</div>;
  }

  if (!session) {
    return (
      <main className="app-shell">
        <section className="phone">
          <AuthScreen />
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="phone">
        {/* 3. Conditional Screen Rendering */}
        {currentScreen === "explore" ? (
          <HomeScreen
            onTrips={goToTrips}
            onCreateTrip={goToTrips}
            onBudget={goToTrips}
            onProfile={goToProfile}
            onInquire={openInquiryChat}
          />
        ) : currentScreen === "dashboard" ? (
          <AgencyDashboardScreen
            onOpenTripWorkspace={openTripWorkspace} // <-- FIXED: Added missing callback prop!
            onNavigateToChat={goToMessages}
          />
        ) : currentScreen === "trips" ? (
          <TripsScreen initialTripId={activeTripId} /> // Pass activeTripId to auto-select newly created trip workspace
        ) : currentScreen === "smartmatch" ? (
          <AIChatScreen />
        ) : currentScreen === "chat" ? (
          <UserChatScreen
            key={chatInquiry?.navigationId || "messages-inbox"}
            onBack={goToExplore}
            initialInquiry={chatInquiry}
            inquiryContext={chatInquiry}
            onInquiryHandled={clearHandledInquiry}
          />
        ) : currentScreen === "profile" ? (
          <ProfileScreen />
        ) : (
          <HomeScreen
            onTrips={goToTrips}
            onCreateTrip={goToTrips}
            onBudget={goToTrips}
            onProfile={goToProfile}
            onInquire={openInquiryChat}
          />
        )}

        <BottomNav
          currentScreen={currentScreen}
          userType={isAgency ? "Agency" : "Traveler"}
          onDashboard={goToDashboard}
          onExplore={goToExplore}
          onTrips={goToTrips}
          onSmartMatch={goToSmartMatch}
          onMessages={goToMessages}
          onProfile={goToProfile}
          unreadMessages={0}
        />
      </section>
    </main>
  );
}
