import { StatusBar } from "expo-status-bar";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";

import { sendHomeInvitation, submitHomeFeedback } from "../api/home.api";
import { AgencyCard } from "../components/AgencyCard";
import { HomeHeader } from "../components/HomeHeader";
import {
  InviteFriendModal,
  ListingDetailsModal,
  NotificationsModal,
} from "../components/HomeModals";
import { QuickActions, type HomeQuickActionKey } from "../components/QuickActions";
import { SectionHeader } from "../components/SectionHeader";
import { TourPackageCard } from "../components/TourPackageCard";
import { TravelFootprintCard } from "../components/TravelFootprintCard";
import { UpcomingTripCard } from "../components/UpcomingTripCard";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import { useHomeFavorites } from "../hooks/useHomeFavorites";
import type { HomeListing } from "../types/home.types";
import { savePendingInquiry } from "../utils/home-storage";

type HomeView = "dashboard" | "tours" | "agencies";

function typedHref(path: string): Href {
  return path as Href;
}

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, profile } = useAuth();
  const dashboard = useHomeDashboard(user?.id);
  const favorites = useHomeFavorites(user?.id);

  const [view, setView] = useState<HomeView>("dashboard");
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [selectedListing, setSelectedListing] = useState<HomeListing | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const data = dashboard.data;
  const contentPadding = width < 390 ? 14 : width < 720 ? 18 : 28;
  const cardWidth = Math.min(270, Math.max(235, width - contentPadding * 2 - 32));
  const agencyWidth = Math.min(300, Math.max(252, width - contentPadding * 2 - 20));

  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  const displayName =
    data?.profile.fullName ||
    profile?.full_name ||
    metadataName ||
    user?.email?.split("@")[0] ||
    "Explorer";

  const visibleTours = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!data) return [];
    if (!query) return data.tours;
    return data.tours.filter((tour) =>
      [tour.title, tour.destination, tour.country, tour.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data, search]);

  const visibleAgencies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!data) return [];
    if (!query) return data.agencies;
    return data.agencies.filter((agency) =>
      [agency.name, agency.subtitle, ...agency.specialties]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data, search]);

  function openDirectory(nextView: Exclude<HomeView, "dashboard">) {
    setSearch("");
    setView(nextView);
  }

  function openTrip(tripId: string | number) {
    setNotificationsOpen(false);
    router.push(typedHref(`/trip/${encodeURIComponent(String(tripId))}`));
  }

  function handleQuickAction(action: HomeQuickActionKey) {
    const trip = data?.upcomingTrip;
    if (!trip) {
      router.push(typedHref("/trip/create"));
      return;
    }
    router.push(typedHref(`/trip/${encodeURIComponent(String(trip.id))}/${action}`));
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

  function openListing(listing: HomeListing) {
    setSelectedListing(listing);
    setRating(5);
    setComment("");
    setFeedbackStatus(null);
  }

  async function submitFeedback() {
    if (!selectedListing || submittingFeedback) return;

    setSubmittingFeedback(true);
    setFeedbackStatus(null);
    try {
      const message = await submitHomeFeedback({
        listingType: selectedListing.type,
        packageId: selectedListing.type === "tour" ? selectedListing.item.id : null,
        agencyId:
          selectedListing.type === "tour"
            ? selectedListing.item.agencyId
            : selectedListing.item.id,
        rating,
        comment,
      });
      setFeedbackStatus(message);
      setComment("");
    } catch (error) {
      setFeedbackStatus(error instanceof Error ? error.message : "Unable to submit feedback.");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function continueFromListing() {
    if (!selectedListing) return;
    const listing = selectedListing;
    await savePendingInquiry(listing);
    setSelectedListing(null);

    if (listing.type === "tour") {
      router.push(typedHref(`/package/${encodeURIComponent(String(listing.item.id))}`));
      return;
    }

    router.push(typedHref(`/agency/${encodeURIComponent(String(listing.item.id))}`));
  }

  if (dashboard.isLoading && !data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#7558F0" />
        <Text style={styles.loadingTitle}>Preparing your dashboard</Text>
        <Text style={styles.loadingCopy}>Syncing trips, agencies, and travel insights.</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.loadingTitle}>Your dashboard could not load</Text>
        <Text style={styles.loadingCopy}>{dashboard.error || "Check your connection and try again."}</Text>
        <Pressable accessibilityRole="button" onPress={() => void dashboard.refresh()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (view !== "dashboard") {
    const toursView = view === "tours";
    const resultsEmpty = toursView ? visibleTours.length === 0 : visibleAgencies.length === 0;

    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={dashboard.isRefreshing} onRefresh={() => void dashboard.refresh()} tintColor="#7558F0" />}
          contentContainerStyle={[styles.directoryContent, { paddingHorizontal: contentPadding }]}
        >
          <View style={styles.contentWidth}>
            <View style={styles.directoryHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => setView("dashboard")} style={styles.backButton}>
                <Text style={styles.backGlyph}>‹</Text>
              </Pressable>
              <View style={styles.directoryHeaderCopy}>
                <Text style={styles.directoryEyebrow}>{toursView ? "TRAVEL DISCOVERY" : "TRUSTED PARTNERS"}</Text>
                <Text style={styles.directoryTitle}>{toursView ? "Tour Packages" : "Travel Agencies"}</Text>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Text style={styles.searchGlyph}>⌕</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSearch}
                placeholder={toursView ? "Search destination or tour style" : "Search agency or specialty"}
                placeholderTextColor="#8B96AA"
                style={styles.searchInput}
                value={search}
              />
              {search ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")} style={styles.clearButton}>
                  <Text style={styles.clearText}>×</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.directoryGrid}>
              {toursView
                ? visibleTours.map((tour) => {
                    const listing: HomeListing = { type: "tour", item: tour };
                    return (
                      <TourPackageCard
                        key={String(tour.id)}
                        favorite={favorites.isFavorite(listing)}
                        onOpen={() => openListing(listing)}
                        onToggleFavorite={() => favorites.toggleFavorite(listing)}
                        tour={tour}
                        width={width >= 760 ? 280 : Math.max(260, width - contentPadding * 2)}
                      />
                    );
                  })
                : visibleAgencies.map((agency) => {
                    const listing: HomeListing = { type: "agency", item: agency };
                    return (
                      <AgencyCard
                        agency={agency}
                        favorite={favorites.isFavorite(listing)}
                        key={String(agency.id)}
                        onOpen={() => openListing(listing)}
                        onToggleFavorite={() => favorites.toggleFavorite(listing)}
                        width={width >= 760 ? 310 : Math.max(270, width - contentPadding * 2)}
                      />
                    );
                  })}
            </View>

            {resultsEmpty ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsIcon}>⌕</Text>
                <Text style={styles.emptyResultsTitle}>No results found</Text>
                <Text style={styles.emptyResultsCopy}>Try another search term or pull down to refresh.</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <ListingDetailsModal
          comment={comment}
          favorite={selectedListing ? favorites.isFavorite(selectedListing) : false}
          feedbackStatus={feedbackStatus}
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onCommentChange={setComment}
          onContinue={() => void continueFromListing()}
          onRatingChange={setRating}
          onSubmitFeedback={() => void submitFeedback()}
          onToggleFavorite={() => selectedListing && favorites.toggleFavorite(selectedListing)}
          rating={rating}
          submittingFeedback={submittingFeedback}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={dashboard.isRefreshing} onRefresh={() => void dashboard.refresh()} tintColor="#7558F0" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: contentPadding }]}
      >
        <View style={styles.contentWidth}>
          <HomeHeader
            name={displayName}
            notificationCount={data.notifications.length}
            onNotificationsPress={() => setNotificationsOpen(true)}
            onProfilePress={() => router.push(typedHref("/(traveler)/(tabs)/profile"))}
          />

          {dashboard.isUsingCachedData || data.partial || dashboard.error ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerIcon}>↻</Text>
              <Text style={styles.statusBannerText}>
                {dashboard.error
                  ? "Showing the latest saved dashboard. Pull down to try again."
                  : data.partial
                    ? "Some live sections are temporarily unavailable. Available data is shown."
                    : "Showing saved data while TRAVA AI refreshes."}
              </Text>
            </View>
          ) : null}

          <TravelFootprintCard userId={user?.id} />

          <SectionHeader
            actionLabel="View All"
            onActionPress={() => router.push(typedHref("/(traveler)/(tabs)/trips"))}
            title="Upcoming Trips"
          />
          <UpcomingTripCard
            onCreateTrip={() => router.push(typedHref("/trip/create"))}
            onPress={() => data.upcomingTrip && openTrip(data.upcomingTrip.id)}
            trip={data.upcomingTrip}
          />

          <SectionHeader title="Quick Actions" />
          <QuickActions onPress={handleQuickAction} />

          <SectionHeader actionLabel="See All" onActionPress={() => openDirectory("tours")} title="Tour Packages for You" />
          {data.tours.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {data.tours.slice(0, 6).map((tour) => {
                const listing: HomeListing = { type: "tour", item: tour };
                return (
                  <TourPackageCard
                    key={String(tour.id)}
                    favorite={favorites.isFavorite(listing)}
                    onOpen={() => openListing(listing)}
                    onToggleFavorite={() => favorites.toggleFavorite(listing)}
                    tour={tour}
                    width={cardWidth}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.inlineEmpty}><Text style={styles.inlineEmptyText}>No active tour packages are available yet.</Text></View>
          )}

          <SectionHeader actionLabel="View All" onActionPress={() => openDirectory("agencies")} title="Travel Agencies" />
          {data.agencies.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {data.agencies.slice(0, 6).map((agency) => {
                const listing: HomeListing = { type: "agency", item: agency };
                return (
                  <AgencyCard
                    agency={agency}
                    favorite={favorites.isFavorite(listing)}
                    key={String(agency.id)}
                    onOpen={() => openListing(listing)}
                    onToggleFavorite={() => favorites.toggleFavorite(listing)}
                    width={agencyWidth}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.inlineEmpty}><Text style={styles.inlineEmptyText}>No active travel agencies are available yet.</Text></View>
          )}
        </View>
      </ScrollView>

      <NotificationsModal
        notifications={data.notifications}
        onClose={() => setNotificationsOpen(false)}
        onOpenTrip={openTrip}
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
      <ListingDetailsModal
        comment={comment}
        favorite={selectedListing ? favorites.isFavorite(selectedListing) : false}
        feedbackStatus={feedbackStatus}
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onCommentChange={setComment}
        onContinue={() => void continueFromListing()}
        onRatingChange={setRating}
        onSubmitFeedback={() => void submitFeedback()}
        onToggleFavorite={() => selectedListing && favorites.toggleFavorite(selectedListing)}
        rating={rating}
        submittingFeedback={submittingFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  scrollContent: { paddingTop: 20, paddingBottom: 132 },
  directoryContent: { paddingTop: 15, paddingBottom: 80 },
  contentWidth: { width: "100%", maxWidth: 1000, alignSelf: "center" },
  statusBanner: { marginTop: 15, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, backgroundColor: "#F1EEFF", borderWidth: 1, borderColor: "#E2DCFF" },
  statusBannerIcon: { color: "#6A51DD", fontSize: 16, fontWeight: "900" },
  statusBannerText: { flex: 1, color: "#5D54A8", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  horizontalList: { gap: 12, paddingBottom: 10, paddingRight: 3 },
  inlineEmpty: { minHeight: 104, alignItems: "center", justifyContent: "center", padding: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "#DDE2EE", borderRadius: 18, backgroundColor: "rgba(255,255,255,0.78)" },
  inlineEmptyText: { color: "#76839B", fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "600" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: "#F8F9FF" },
  loadingTitle: { marginTop: 14, color: "#17233E", fontSize: 20, lineHeight: 25, textAlign: "center", fontWeight: "900" },
  loadingCopy: { maxWidth: 340, marginTop: 6, color: "#76839B", fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "600" },
  errorIcon: { width: 44, height: 44, color: "#FFFFFF", backgroundColor: "#FF668E", borderRadius: 999, fontSize: 26, lineHeight: 44, textAlign: "center", fontWeight: "900" },
  retryButton: { marginTop: 18, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, borderRadius: 14, backgroundColor: "#111B34" },
  retryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  directoryHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EBEDF4" },
  backGlyph: { color: "#33415E", fontSize: 32, lineHeight: 35, fontWeight: "500" },
  directoryHeaderCopy: { flex: 1 },
  directoryEyebrow: { color: "#7A879E", fontSize: 10, lineHeight: 13, letterSpacing: 1.3, fontWeight: "900" },
  directoryTitle: { marginTop: 2, color: "#111D3A", fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.65 },
  searchBox: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderWidth: 1, borderColor: "#E0E5EF", borderRadius: 15, backgroundColor: "#FFFFFF" },
  searchGlyph: { color: "#68758E", fontSize: 23, lineHeight: 25, fontWeight: "700" },
  searchInput: { flex: 1, minHeight: 48, color: "#1A2743", fontSize: 14 },
  clearButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#F3F4FA" },
  clearText: { color: "#56637B", fontSize: 21, lineHeight: 23 },
  directoryGrid: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" },
  emptyResults: { minHeight: 190, marginTop: 18, alignItems: "center", justifyContent: "center", padding: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "#DCE2ED", borderRadius: 21, backgroundColor: "rgba(255,255,255,0.82)" },
  emptyResultsIcon: { color: "#7558F0", fontSize: 31, fontWeight: "900" },
  emptyResultsTitle: { marginTop: 8, color: "#27344E", fontSize: 16, fontWeight: "900" },
  emptyResultsCopy: { marginTop: 4, color: "#76839B", fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "600" },
});
