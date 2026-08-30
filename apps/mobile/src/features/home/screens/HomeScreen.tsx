import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import type { TripSummary } from "@trava/shared";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { listTrips } from "@/features/trips/api/trips.api";
import { useLocalTripWorkspace, type WorkspaceState } from "@/features/trips/hooks/useLocalTripWorkspace";
import { sendHomeInvitation } from "../api/home.api";
import { InviteFriendModal, NotificationsModal } from "../components/HomeModals";
import { TravelFootprintCard } from "../components/TravelFootprintCard";
import { PremiumConciergeCard, getConciergeState, type ConciergeState } from "../components/premium-home/PremiumConciergeCard";
import { PremiumHomeHeader } from "../components/premium-home/PremiumHomeHeader";
import { PremiumQuickActions, type PremiumQuickActionKey } from "../components/premium-home/PremiumQuickActions";
import { PremiumTravelPulse } from "../components/premium-home/PremiumTravelPulse";
import { PremiumUpcomingTripCard } from "../components/premium-home/PremiumUpcomingTripCard";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import type { HomeTripSummary } from "../types/home.types";
import { calculateTravelReadiness } from "../utils/premium-home-readiness";

function href(path: string): Href {
  return path as Href;
}

function workspaceStorageKey(tripId: string) {
  return `trava:pixel-workspace:v2:${tripId || "local-japan"}`;
}

function toHomeTripSummary(trip: TripSummary): HomeTripSummary {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    imageUrl: trip.coverImageUrl,
    currencyCode: trip.currencyCode,
    totalBudget: trip.totalBudget,
    spent: 0,
    memberCount: Math.max(1, trip.memberCount || 1),
  };
}

function LoadingHome() {
  return (
    <SafeAreaView style={styles.loadingSafe} edges={["top"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#FFFFFF", "#FBF8FF", "#FFF7FB"]} style={StyleSheet.absoluteFill} />
      <View style={styles.loadingCard}>
        <ActivityIndicator color="#6E5CF4" />
        <Text style={styles.loadingTitle}>Preparing your travel dashboard…</Text>
      </View>
    </SafeAreaView>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, profile } = useAuth();
  const dashboard = useHomeDashboard(user?.id);
  const data = dashboard.data;

  // IMPORTANT: Home and Trips now share the exact same query key + API source.
  // TripsScreen also reads ["trips"] via listTrips, so the first item here is
  // the same trip shown as the selected/latest trip there.
  const tripsQuery = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    retry: 1,
    staleTime: 30_000,
  });

  const latestTrip = useMemo<HomeTripSummary | null>(() => {
    // Once /api/trips has answered, it becomes the source of truth. An empty
    // array intentionally means there is no trip; never resurrect stale home data.
    if (tripsQuery.data) {
      const first = tripsQuery.data[0];
      return first ? toHomeTripSummary(first) : null;
    }

    // While the shared trips query is still hydrating, retain the dashboard
    // result so Home does not flash an empty card. It is replaced immediately
    // when the same trips collection used by TripsScreen resolves.
    return data?.upcomingTrip ?? null;
  }, [data?.upcomingTrip, tripsQuery.data]);

  const tripId = latestTrip ? String(latestTrip.id) : "local-japan";
  const workspace = useLocalTripWorkspace(tripId);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<{ tripId: string; state: WorkspaceState } | null>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [conciergeInfoOpen, setConciergeInfoOpen] = useState(false);

  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  const displayName = data?.profile.fullName || profile?.full_name || metadataName || user?.email?.split("@")[0] || "Explorer";
  const avatarUrl = data?.profile.avatarUrl || null;

  // Keep the home snapshot in sync whenever this hook receives a local or
  // collaborator update while Home is mounted.
  useEffect(() => {
    if (workspace.ready) setWorkspaceSnapshot({ tripId, state: workspace.state });
  }, [tripId, workspace.ready, workspace.state]);

  // Expo Router keeps tabs mounted. Every time Home regains focus we refresh
  // BOTH the shared Trips collection and the latest persisted trip workspace.
  // This makes the card name/destination/date/travelers and readiness mirror
  // current trip data rather than a stale dashboard snapshot.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      void tripsQuery.refetch();

      void AsyncStorage.getItem(workspaceStorageKey(tripId))
        .then((raw) => {
          if (!active || !raw) return;
          const parsed = JSON.parse(raw) as WorkspaceState;
          if (parsed && typeof parsed === "object") setWorkspaceSnapshot({ tripId, state: parsed });
        })
        .catch(() => undefined);

      return () => {
        active = false;
      };
    }, [tripId, tripsQuery.refetch]),
  );

  const effectiveWorkspace = workspaceSnapshot?.tripId === tripId
    ? workspaceSnapshot.state
    : workspace.ready
      ? workspace.state
      : null;

  const readiness = useMemo(
    () => calculateTravelReadiness(latestTrip, effectiveWorkspace).score,
    [latestTrip, effectiveWorkspace],
  );

  const concierge = useMemo(
    () => getConciergeState(latestTrip, effectiveWorkspace),
    [latestTrip, effectiveWorkspace],
  );

  const contentPadding = width < 390 ? 12 : 15;

  function openTrip() {
    if (latestTrip) router.push(href(`/trip/${encodeURIComponent(String(latestTrip.id))}`));
    else router.push(href("/trip/create"));
  }

  function openTripSection(section: "itinerary" | "budget" | "expenses" | "checklist" | "documents" | "members") {
    if (!latestTrip) {
      router.push(href("/trip/create"));
      return;
    }
    router.push(href(`/trip/${encodeURIComponent(String(latestTrip.id))}/${section}`));
  }

  function handleQuickAction(action: PremiumQuickActionKey) {
    if (action === "create-trip") {
      router.push(href("/trip/create"));
      return;
    }
    if (action === "collaborate") {
      if (!latestTrip) {
        router.push(href("/trip/create"));
        return;
      }
      setInviteStatus(null);
      setInviteOpen(true);
      return;
    }
    openTripSection(action);
  }

  function handleConciergePrimary(state: ConciergeState) {
    if (state.route === "trip") {
      openTrip();
      return;
    }
    openTripSection(state.route);
  }

  async function submitInvite() {
    const trip = latestTrip;
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!trip || !normalizedEmail || sendingInvite) return;
    setSendingInvite(true);
    setInviteStatus(null);
    try {
      const message = await sendHomeInvitation({ tripId: trip.id, email: normalizedEmail });
      setInviteStatus(message);
      setInviteEmail("");
      await Promise.all([dashboard.refresh(), tripsQuery.refetch()]);
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "Unable to send the invitation.");
    } finally {
      setSendingInvite(false);
    }
  }

  async function refreshHome() {
    await Promise.all([dashboard.refresh(), tripsQuery.refetch()]);
  }

  if (dashboard.isLoading && !data) return <LoadingHome />;

  if (!data) {
    return (
      <SafeAreaView style={styles.loadingSafe} edges={["top"]}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Your dashboard could not load</Text>
        <Text style={styles.errorCopy}>{dashboard.error || "Check your connection and try again."}</Text>
        <Pressable onPress={() => void refreshHome()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isRefreshing || tripsQuery.isFetching}
            onRefresh={() => void refreshHome()}
            tintColor="#6C5CF4"
          />
        }
        contentContainerStyle={[styles.scroll, { paddingHorizontal: contentPadding }]}
      >
        <View style={styles.contentWidth}>
          <PremiumHomeHeader
            name={displayName}
            avatarUrl={avatarUrl}
            notificationCount={data.notifications.length}
            onMessagesPress={() => router.push(href("/(traveler)/(tabs)/messages"))}
            onNotificationsPress={() => setNotificationsOpen(true)}
            onProfilePress={() => router.push(href("/(traveler)/(tabs)/profile"))}
            onCommandCenterPress={() => router.push(href("/(traveler)/(tabs)/ai"))}
          />

          {/* Existing globe/footprint module remains untouched. */}
          <TravelFootprintCard userId={user?.id} />

          <View style={styles.latestTripHeader}>
            <Text style={styles.latestTripTitle}>Latest Trip</Text>
            <Text style={styles.latestTripSubtitle}>Your most recent adventure. Get ready to explore!</Text>
          </View>

          <PremiumUpcomingTripCard
            trip={latestTrip}
            readiness={readiness}
            onPress={openTrip}
            onItineraryPress={() => openTripSection("itinerary")}
            onCreateTrip={() => router.push(href("/trip/create"))}
          />

          <PremiumTravelPulse readiness={readiness} />
          <PremiumQuickActions onPress={handleQuickAction} />
          <PremiumConciergeCard
            state={concierge}
            infoOpen={conciergeInfoOpen}
            onInfoOpen={() => setConciergeInfoOpen(true)}
            onInfoClose={() => setConciergeInfoOpen(false)}
            onPrimaryPress={handleConciergePrimary}
          />
        </View>
      </ScrollView>

      <NotificationsModal
        notifications={data.notifications}
        onClose={() => setNotificationsOpen(false)}
        onOpenTrip={(id) => {
          setNotificationsOpen(false);
          router.push(href(`/trip/${encodeURIComponent(String(id))}`));
        }}
        visible={notificationsOpen}
      />
      <InviteFriendModal
        email={inviteEmail}
        onClose={() => {
          setInviteOpen(false);
          setInviteStatus(null);
        }}
        onEmailChange={setInviteEmail}
        onSubmit={() => void submitInvite()}
        status={inviteStatus}
        submitting={sendingInvite}
        trip={latestTrip}
        visible={inviteOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingTop: 8, paddingBottom: 118 },
  contentWidth: { width: "100%", maxWidth: 430, alignSelf: "center" },
  latestTripHeader: { marginTop: 17, marginBottom: 2, paddingHorizontal: 2 },
  latestTripTitle: { color: "#121A38", fontSize: 19, lineHeight: 24, fontWeight: "900", letterSpacing: -0.35 },
  latestTripSubtitle: { marginTop: 2, color: "#6C7690", fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
  loadingSafe: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#FFFFFF" },
  loadingCard: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.8)" },
  loadingTitle: { color: "#343B5A", fontSize: 13, fontWeight: "800" },
  errorTitle: { color: "#151D3A", fontSize: 23, lineHeight: 29, fontWeight: "900", textAlign: "center" },
  errorCopy: { marginTop: 8, color: "#68718B", fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" },
  retryButton: { marginTop: 18, height: 44, paddingHorizontal: 20, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#6C5CF4" },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
