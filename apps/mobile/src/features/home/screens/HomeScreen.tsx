import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLocalTripWorkspace } from "@/features/trips/hooks/useLocalTripWorkspace";
import { sendHomeInvitation } from "../api/home.api";
import { InviteFriendModal, NotificationsModal } from "../components/HomeModals";
import { TravelFootprintCard } from "../components/TravelFootprintCard";
import { PremiumConciergeCard, getConciergeState, type ConciergeState } from "../components/premium-home/PremiumConciergeCard";
import { PremiumHomeHeader } from "../components/premium-home/PremiumHomeHeader";
import { PremiumQuickActions, type PremiumQuickActionKey } from "../components/premium-home/PremiumQuickActions";
import { PremiumTravelPulse } from "../components/premium-home/PremiumTravelPulse";
import { PremiumUpcomingTripCard } from "../components/premium-home/PremiumUpcomingTripCard";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import { calculateTravelReadiness } from "../utils/premium-home-readiness";

function href(path: string): Href {
  return path as Href;
}

function LoadingHome() {
  return (
    <SafeAreaView style={styles.loadingSafe} edges={["top"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#FFFFFF", "#FBF8FF", "#FFF7FB"]} style={StyleSheet.absoluteFillObject} />
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

  const tripId = data?.upcomingTrip ? String(data.upcomingTrip.id) : "local-japan";
  const workspace = useLocalTripWorkspace(tripId);

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

  const readiness = useMemo(
    () => calculateTravelReadiness(data?.upcomingTrip, workspace.ready ? workspace.state : null).score,
    [data?.upcomingTrip, workspace.ready, workspace.state],
  );

  const concierge = useMemo(
    () => getConciergeState(data?.upcomingTrip ?? null, workspace.ready ? workspace.state : null),
    [data?.upcomingTrip, workspace.ready, workspace.state],
  );

  const contentPadding = width < 390 ? 12 : 15;

  function openTrip() {
    if (data?.upcomingTrip) router.push(href(`/trip/${encodeURIComponent(String(data.upcomingTrip.id))}`));
    else router.push(href("/trip/create"));
  }

  function openTripSection(section: "itinerary" | "budget" | "expenses" | "checklist" | "documents" | "members") {
    if (!data?.upcomingTrip) {
      router.push(href("/trip/create"));
      return;
    }
    router.push(href(`/trip/${encodeURIComponent(String(data.upcomingTrip.id))}/${section}`));
  }

  function handleQuickAction(action: PremiumQuickActionKey) {
    if (action === "create-trip") {
      router.push(href("/trip/create"));
      return;
    }
    if (action === "collaborate") {
      if (!data?.upcomingTrip) {
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
    const trip = data?.upcomingTrip;
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!trip || !normalizedEmail || sendingInvite) return;
    setSendingInvite(true);
    setInviteStatus(null);
    try {
      const message = await sendHomeInvitation({ tripId: trip.id, email: normalizedEmail });
      setInviteStatus(message);
      setInviteEmail("");
      await dashboard.refresh();
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "Unable to send the invitation.");
    } finally {
      setSendingInvite(false);
    }
  }

  if (dashboard.isLoading && !data) return <LoadingHome />;

  if (!data) {
    return (
      <SafeAreaView style={styles.loadingSafe} edges={["top"]}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Your dashboard could not load</Text>
        <Text style={styles.errorCopy}>{dashboard.error || "Check your connection and try again."}</Text>
        <Pressable onPress={() => void dashboard.refresh()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dashboard.isRefreshing} onRefresh={() => void dashboard.refresh()} tintColor="#6C5CF4" />}
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

          {/* CRITICAL: Existing TravelFootprintCard is imported and rendered unchanged. */}
          <TravelFootprintCard userId={user?.id} />

          <PremiumUpcomingTripCard
            trip={data.upcomingTrip}
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
        trip={data.upcomingTrip}
        visible={inviteOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingTop: 8, paddingBottom: 118 },
  contentWidth: { width: "100%", maxWidth: 430, alignSelf: "center" },
  loadingSafe: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#FFFFFF" },
  loadingCard: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.8)" },
  loadingTitle: { color: "#343B5A", fontSize: 13, fontWeight: "800" },
  errorTitle: { color: "#151D3A", fontSize: 23, lineHeight: 29, fontWeight: "900", textAlign: "center" },
  errorCopy: { marginTop: 8, color: "#68718B", fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" },
  retryButton: { marginTop: 18, height: 44, paddingHorizontal: 20, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#6C5CF4" },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
