import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";

import {
  ActiveTripCard,
  AiConciergeCard,
  BudgetSnapshot,
  calculateTripReadiness,
  EmptyTripCard,
  PlanningShortcuts,
  TodaySuggestions,
  TravelPulse,
} from "../components/TravelerHomeCards";
import { TravelFootprintCard } from "../components/TravelFootprintCard";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import { useTravelerHomePulse } from "../hooks/useTravelerHomePulse";
import type { HomeNotification, HomeTourPackage } from "../types/home.types";

function typedHref(path: string): Href {
  return path as Href;
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Traveler";
}

function HeaderAction({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <LinearGradient colors={["rgba(255,255,255,0.96)", "rgba(248,244,255,0.92)"]} style={StyleSheet.absoluteFillObject} />
      <Ionicons name={icon} size={21} color="#6554C9" />
      {badge && badge > 0 ? (
        <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{badge > 9 ? "9+" : badge}</Text></View>
      ) : null}
    </Pressable>
  );
}

function ProfileButton({ uri, onPress }: { uri: string | null; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={onPress} style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
      {uri ? <Image source={{ uri }} contentFit="cover" style={styles.profileImage} /> : <LinearGradient colors={["#E7E7FF", "#F3DFF7", "#DCEBFF"]} style={styles.profileImageFallback}><Ionicons name="person-outline" size={20} color="#6757CF" /></LinearGradient>}
    </Pressable>
  );
}

function NotificationSheet({
  visible,
  notifications,
  onClose,
  onOpen,
}: {
  visible: boolean;
  notifications: HomeNotification[];
  onClose(): void;
  onOpen(notification: HomeNotification): void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.notificationSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.notificationHeader}><View><Text style={styles.notificationTitle}>Notifications</Text><Text style={styles.notificationSubtitle}>Trip updates and planning reminders.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose}><Ionicons name="close" size={23} color="#626783" /></Pressable></View>
          {notifications.length ? notifications.map((notification) => (
            <Pressable key={notification.id} accessibilityRole="button" onPress={() => onOpen(notification)} style={styles.notificationRow}>
              <LinearGradient colors={["#F3EAFF", "#EAF3FF"]} style={styles.notificationIcon}><Ionicons name="notifications-outline" size={18} color="#7359DE" /></LinearGradient>
              <View style={styles.notificationCopy}><Text numberOfLines={1} style={styles.notificationRowTitle}>{notification.title}</Text><Text numberOfLines={2} style={styles.notificationMessage}>{notification.message}</Text></View>
              {notification.tripId ? <Ionicons name="chevron-forward" size={19} color="#8A8FA7" /> : null}
            </Pressable>
          )) : <View style={styles.notificationEmpty}><Ionicons name="checkmark-circle-outline" size={30} color="#63AD88" /><Text style={styles.notificationEmptyTitle}>You're caught up</Text><Text style={styles.notificationEmptyText}>No trip notifications need your attention right now.</Text></View>}
        </View>
      </View>
    </Modal>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, profile } = useAuth();
  const dashboard = useHomeDashboard(user?.id);
  const trip = dashboard.data?.upcomingTrip ?? null;
  const pulse = useTravelerHomePulse(trip?.id, user?.id);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const displayName = dashboard.data?.profile.fullName || profile?.full_name || metadataName || user?.email?.split("@")[0] || "Traveler";
  const avatarUrl = dashboard.data?.profile.avatarUrl || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);

  const readiness = useMemo(() => trip ? calculateTripReadiness(trip, pulse) : 0, [pulse, trip]);
  const contextualTours = useMemo(() => {
    const tours = dashboard.data?.tours ?? [];
    if (!trip?.destination) return [];
    const destination = trip.destination.toLowerCase();
    return tours.filter((tour) => [tour.destination, tour.country, tour.title].filter(Boolean).some((value) => String(value).toLowerCase().includes(destination) || destination.includes(String(value).toLowerCase())));
  }, [dashboard.data?.tours, trip?.destination]);

  const contentPadding = width < 390 ? 15 : 18;

  function openTripArea(area?: string) {
    if (!trip) {
      router.push(typedHref("/trip/create"));
      return;
    }
    const base = `/trip/${encodeURIComponent(String(trip.id))}`;
    router.push(typedHref(area ? `${base}/${area}` : base));
  }

  function openShortcut(key: string) {
    if (["itinerary", "budget", "expenses", "checklist", "documents"].includes(key)) openTripArea(key);
  }

  function openTour(tour: HomeTourPackage) {
    router.push(typedHref(`/package/${encodeURIComponent(String(tour.id))}`));
  }

  function openNotification(notification: HomeNotification) {
    setNotificationsOpen(false);
    if (notification.tripId) router.push(typedHref(`/trip/${encodeURIComponent(String(notification.tripId))}`));
  }

  if (dashboard.isLoading && !dashboard.data) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <LinearGradient colors={["#FBF9FF", "#F4F7FF", "#FFF8FC"]} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={["#F1B0FF", "#9788FF", "#75A7FF"]} style={styles.loadingOrb}><Ionicons name="sparkles" size={28} color="#FFFFFF" /></LinearGradient>
        <ActivityIndicator color="#7458DF" />
        <Text style={styles.loadingTitle}>Preparing your traveler dashboard</Text>
        <Text style={styles.loadingText}>Loading your trip context without changing your Travel Footprint.</Text>
      </SafeAreaView>
    );
  }

  if (!dashboard.data) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <LinearGradient colors={["#FBF9FF", "#F4F7FF", "#FFF8FC"]} style={StyleSheet.absoluteFillObject} />
        <Ionicons name="cloud-offline-outline" size={36} color="#7358DF" />
        <Text style={styles.loadingTitle}>Your Home dashboard could not load</Text>
        <Text style={styles.loadingText}>{dashboard.error || "Check your connection and try again."}</Text>
        <Pressable accessibilityRole="button" onPress={() => void dashboard.refresh()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={["#FCFAFF", "#F9FBFF", "#FFF9FC"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dashboard.isRefreshing || pulse.loading} onRefresh={() => void Promise.all([dashboard.refresh(), pulse.refresh()])} tintColor="#7559DF" />}
        contentContainerStyle={[styles.content, { paddingHorizontal: contentPadding }]}
      >
        <View style={styles.contentWidth}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.brand}>TRAVA</Text>
              <Text style={styles.greeting}>{greetingForNow()}, {firstName(displayName)} <Text style={styles.wave}>👋</Text></Text>
              <View style={styles.travelerChip}><Ionicons name="sparkles" size={12} color="#7559DF" /><Text style={styles.travelerChipText}>Your travel command center</Text></View>
            </View>
            <View style={styles.headerActions}>
              <HeaderAction icon="chatbubble-ellipses-outline" label="Messages" badge={pulse.unreadMessages} onPress={() => router.push(typedHref("/messages"))} />
              <HeaderAction icon="notifications-outline" label="Notifications" badge={dashboard.data.notifications.length} onPress={() => setNotificationsOpen(true)} />
              <ProfileButton uri={avatarUrl} onPress={() => router.push(typedHref("/profile"))} />
            </View>
          </View>

          {/* CRITICAL: frozen Travel Footprint component. No internal props/styles/logic changed. */}
          <TravelFootprintCard userId={user?.id} />

          {trip ? <ActiveTripCard trip={trip} readiness={readiness} onOpen={() => openTripArea("itinerary")} /> : <EmptyTripCard onPlan={() => router.push(typedHref("/trip/create"))} />}

          {trip ? (
            <>
              <TravelPulse trip={trip} checklistTotal={pulse.checklistTotal} checklistCompleted={pulse.checklistCompleted} documentCount={pulse.documentCount} onChecklist={() => openTripArea("checklist")} onDocuments={() => openTripArea("documents")} onBudget={() => openTripArea("budget")} onTrip={() => openTripArea()} />
              <AiConciergeCard trip={trip} checklistTotal={pulse.checklistTotal} checklistCompleted={pulse.checklistCompleted} documentCount={pulse.documentCount} onAskAi={() => router.push(typedHref("/ai"))} onItinerary={() => openTripArea("itinerary")} />
              <PlanningShortcuts onOpen={openShortcut} />
              <TodaySuggestions tours={contextualTours} onViewAll={() => router.push(typedHref("/explore"))} onView={openTour} />
              <BudgetSnapshot trip={trip} onOpen={() => openTripArea("budget")} />
            </>
          ) : (
            <View style={styles.noTripValue}>
              <Text style={styles.noTripValueTitle}>Home becomes more personal after you create a trip.</Text>
              <Text style={styles.noTripValueText}>Travel Pulse, AI context, checklist readiness, documents, suggestions, and budget insights only appear when they can be backed by your real trip data.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push(typedHref("/explore"))} style={styles.exploreButton}><Ionicons name="compass-outline" size={17} color="#FFFFFF" /><Text style={styles.exploreButtonText}>Explore destinations</Text></Pressable>
            </View>
          )}

          {dashboard.error ? <Pressable accessibilityRole="button" onPress={() => void dashboard.refresh()} style={styles.partialBanner}><Ionicons name="cloud-offline-outline" size={17} color="#8A5E27" /><Text style={styles.partialText}>Some live Home data could not refresh. You're seeing the latest available data. Tap to retry.</Text></Pressable> : null}
          {pulse.error ? <Pressable accessibilityRole="button" onPress={() => void pulse.refresh()} style={styles.partialBanner}><Ionicons name="refresh-outline" size={17} color="#8A5E27" /><Text style={styles.partialText}>{pulse.error} Tap to retry.</Text></Pressable> : null}
        </View>
      </ScrollView>

      <NotificationSheet visible={notificationsOpen} notifications={dashboard.data.notifications} onClose={() => setNotificationsOpen(false)} onOpen={openNotification} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBFAFF" },
  content: { paddingTop: 8, paddingBottom: 130 },
  contentWidth: { width: "100%", maxWidth: 1180, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 2, paddingBottom: 2 },
  headerCopy: { flex: 1, minWidth: 0 },
  brand: { color: "#9A67EC", fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -1.3 },
  greeting: { marginTop: 12, color: "#151D40", fontSize: 20, lineHeight: 25, fontWeight: "900", letterSpacing: -0.5 },
  wave: { fontSize: 17 },
  travelerChip: { alignSelf: "flex-start", minHeight: 32, marginTop: 9, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, borderWidth: 1, borderColor: "#E2D9F7", backgroundColor: "rgba(249,245,255,0.88)" },
  travelerChipText: { color: "#7257DB", fontSize: 9.5, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: { width: 44, height: 44, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.95)", boxShadow: "0 9px 22px rgba(73,65,132,0.10)" },
  headerBadge: { position: "absolute", right: 5, top: 4, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#EA4D93", borderWidth: 1.5, borderColor: "#FFFFFF" },
  headerBadgeText: { color: "#FFFFFF", fontSize: 6.5, fontWeight: "900" },
  profileButton: { width: 46, height: 46, borderRadius: 18, padding: 3, backgroundColor: "rgba(255,255,255,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", boxShadow: "0 9px 22px rgba(73,65,132,0.10)" },
  profileImage: { width: "100%", height: "100%", borderRadius: 15 },
  profileImageFallback: { width: "100%", height: "100%", borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  noTripValue: { marginTop: 24, padding: 20, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.70)" },
  noTripValueTitle: { color: "#1B2345", fontSize: 14, lineHeight: 19, fontWeight: "900" },
  noTripValueText: { marginTop: 7, color: "#707895", fontSize: 10.5, lineHeight: 16, fontWeight: "600" },
  exploreButton: { alignSelf: "flex-start", minHeight: 42, marginTop: 15, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 16, backgroundColor: "#6F58DE" },
  exploreButtonText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  partialBanner: { marginTop: 14, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 17, borderWidth: 1, borderColor: "#F1DFC5", backgroundColor: "#FFF9F0" },
  partialText: { flex: 1, color: "#806848", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  loadingSafe: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  loadingOrb: { width: 70, height: 70, marginBottom: 18, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  loadingTitle: { marginTop: 15, color: "#1A2244", fontSize: 17, textAlign: "center", fontWeight: "900" },
  loadingText: { marginTop: 7, maxWidth: 340, color: "#727A96", fontSize: 10.5, lineHeight: 16, textAlign: "center", fontWeight: "600" },
  retryButton: { marginTop: 17, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 15, backgroundColor: "#7058DF" },
  retryText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,25,50,0.20)" },
  notificationSheet: { maxHeight: "76%", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#FCFBFF" },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", backgroundColor: "#D8D6E4", marginBottom: 12 },
  notificationHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 },
  notificationTitle: { color: "#192044", fontSize: 19, fontWeight: "900" },
  notificationSubtitle: { marginTop: 3, color: "#777E99", fontSize: 10.5, fontWeight: "600" },
  notificationRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#ECEAF3" },
  notificationIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationRowTitle: { color: "#202746", fontSize: 11.5, fontWeight: "900" },
  notificationMessage: { marginTop: 4, color: "#737A96", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  notificationEmpty: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 25 },
  notificationEmptyTitle: { marginTop: 10, color: "#202746", fontSize: 14, fontWeight: "900" },
  notificationEmptyText: { marginTop: 5, color: "#737A96", fontSize: 10, textAlign: "center", fontWeight: "600" },
});
