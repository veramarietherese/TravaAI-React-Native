import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
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
import { TravelCommerceModals } from "../components/TravelCommerceModals";
import {
  InviteFriendModal,
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

// TRAVA_HOME_CHAT_REFINEMENT_PATCH_V1
type HomeView = "dashboard" | "tours" | "agencies";

function typedHref(path: string): Href {
  return path as Href;
}

function LoadingAccentWord({ children }: { children: string }) {
  return (
    <Text style={styles.loadingTitle}>
      <Text style={styles.loadingTitleAccentBlue}>{children.slice(0, Math.ceil(children.length / 2))}</Text>
      <Text style={styles.loadingTitleAccentPink}>{children.slice(Math.ceil(children.length / 2))}</Text>
    </Text>
  );
}

function HomeLoadingSplash() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={["#F8F6FF", "#FAEFF7", "#F3F7FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.loadingScene}>
        <View style={styles.loadingArtwork}>
          <View style={[styles.loadingOrbitRing, styles.loadingOrbitRingOuter]} />
          <View style={[styles.loadingOrbitRing, styles.loadingOrbitRingMiddle]} />
          <View style={[styles.loadingOrbitRing, styles.loadingOrbitRingInner]} />

          <LinearGradient
            colors={["#FFB95C", "#E96CFF", "#6E83FF"]}
            start={{ x: 0.2, y: 1 }}
            end={{ x: 0.8, y: 0 }}
            style={styles.loadingStar}
          >
            <View style={styles.loadingStarCutout} />
          </LinearGradient>

          <View style={[styles.loadingIconBubble, styles.bubblePlane]}>
            <Text style={styles.loadingBubbleText}>✈</Text>
          </View>
          <View style={[styles.loadingIconBubble, styles.bubblePin]}>
            <Text style={styles.loadingBubbleText}>⌖</Text>
          </View>
          <View style={[styles.loadingIconBubble, styles.bubbleCalendar]}>
            <Text style={styles.loadingBubbleText}>21</Text>
          </View>
          <View style={[styles.loadingIconBubble, styles.bubbleTicket]}>
            <Text style={styles.loadingBubbleEmoji}>🎫</Text>
          </View>
          <View style={[styles.loadingIconBubble, styles.bubbleGlobe]}>
            <Text style={styles.loadingBubbleEmoji}>🌍</Text>
          </View>
          <View style={[styles.loadingIconBubble, styles.bubbleLuggage]}>
            <Text style={styles.loadingBubbleEmoji}>🧳</Text>
          </View>

          <View style={[styles.loadingAvatarBubble, styles.avatarLeft]}>
            <Text style={styles.loadingAvatarEmoji}>🙂</Text>
          </View>
          <View style={[styles.loadingAvatarBubble, styles.avatarRight]}>
            <Text style={styles.loadingAvatarEmoji}>😎</Text>
          </View>
          <View style={[styles.loadingAvatarBubble, styles.avatarBottom]}>
            <Text style={styles.loadingAvatarEmoji}>😊</Text>
          </View>

          <View style={[styles.loadingSparkle, styles.sparkleOne]} />
          <View style={[styles.loadingSparkle, styles.sparkleTwo]} />
          <View style={[styles.loadingSparkle, styles.sparkleThree]} />
          <View style={[styles.loadingCloud, styles.cloudLeft]} />
          <View style={[styles.loadingCloud, styles.cloudRight]} />
        </View>

        <Text style={styles.loadingBrand}>TRAVA ✦</Text>
        <Text style={styles.loadingTitle}>Preparing your</Text>
        <LoadingAccentWord>journey</LoadingAccentWord>
        <Text style={styles.loadingCopy}>Loading your next adventure...</Text>

        <View style={styles.loadingProgressShell}>
          <LinearGradient
            colors={["#54A7FF", "#C16BFF", "#FFB27A"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.loadingProgressFill}
          />
          <View style={styles.loadingProgressSparkle}>
            <Text style={styles.loadingProgressSparkleText}>✦</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
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
    if (action === "create-trip") {
      router.push(typedHref("/trip/create"));
      return;
    }

    if (action === "destinations") {
      router.push(typedHref("/(traveler)/(tabs)/explore"));
      return;
    }

    if (action === "budget") {
      if (data?.upcomingTrip) {
        router.push(typedHref(`/trip/${encodeURIComponent(String(data.upcomingTrip.id))}/budget`));
      } else {
        router.push(typedHref("/trip/create"));
      }
      return;
    }

    if (data?.upcomingTrip) {
      setInviteStatus(null);
      setInviteOpen(true);
    } else {
      router.push(typedHref("/trip/create"));
    }
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

  // TRAVA_STRICT_HOME_COMMERCE_FIX_V2
  async function continueFromListing() {
    if (!selectedListing) return;

    const listing = selectedListing;
    await savePendingInquiry(listing);

    const agencyId = listing.type === "agency"
      ? String(listing.item.id)
      : String(listing.item.agencyId ?? `package-${listing.item.id}`);
    const agencyName = listing.type === "agency"
      ? listing.item.name
      : data?.agencies.find((agency) => String(agency.id) === String(listing.item.agencyId))?.name || "Travel Agency";
    const travelerId = user?.id || "traveler";
    const roomId = `agency-${agencyId}-traveler-${travelerId}`.replace(/[^a-zA-Z0-9_-]/g, "-");

    const params: Array<[string, string]> = [
      ["agencyId", agencyId],
      ["agencyName", agencyName],
      ["travelerId", travelerId],
      ["travelerName", displayName],
    ];

    if (listing.type === "tour") {
      params.push(
        ["packageId", String(listing.item.id)],
        ["packageTitle", listing.item.title],
        ["packagePrice", String(listing.item.price)],
        ["currencyCode", listing.item.currencyCode],
        ["packageDays", String(listing.item.durationDays)],
        ["packageNights", String(listing.item.durationNights)],
        ["destination", listing.item.destination || listing.item.country || ""],
        ["packageImage", listing.item.imageUrl || ""],
      );
    }

    const query = params
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    setSelectedListing(null);
    router.push(typedHref(`/chat/${encodeURIComponent(roomId)}?${query}`));
  }

  if (dashboard.isLoading && !data) {
    return <HomeLoadingSplash />;
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

        <TravelCommerceModals
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
          relatedTours={data?.tours ?? []}
          onOpenTour={(tour) => openListing({ type: "tour", item: tour })}
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
            onMessagesPress={() => router.push(typedHref("/(traveler)/(tabs)/messages"))}
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
      <TravelCommerceModals
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
        relatedTours={data?.tours ?? []}
        onOpenTour={(tour) => openListing({ type: "tour", item: tour })}
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
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#F8F9FF" },
  loadingScene: { width: "100%", maxWidth: 430, alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  loadingArtwork: { width: 320, height: 408, alignItems: "center", justifyContent: "center", position: "relative" },
  loadingOrbitRing: { position: "absolute", borderWidth: 1.2, borderColor: "rgba(255,255,255,0.95)", opacity: 0.9 },
  loadingOrbitRingOuter: { width: 300, height: 300, borderRadius: 150 },
  loadingOrbitRingMiddle: { width: 228, height: 228, borderRadius: 114 },
  loadingOrbitRingInner: { width: 154, height: 154, borderRadius: 77 },
  loadingStar: { width: 74, height: 74, alignItems: "center", justifyContent: "center", transform: [{ rotate: "45deg" }], borderRadius: 22, shadowColor: "#C570FF", shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  loadingStarCutout: { width: 18, height: 18, backgroundColor: "rgba(255,255,255,0.88)", borderRadius: 5 },
  loadingIconBubble: { position: "absolute", alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", backgroundColor: "rgba(255,255,255,0.74)", shadowColor: "#B7A4E9", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  bubblePlane: { width: 86, height: 62, top: 42, left: 22, transform: [{ rotate: "-14deg" }] },
  bubblePin: { width: 76, height: 76, top: 12, left: 124, borderRadius: 38 },
  bubbleCalendar: { width: 76, height: 76, top: 72, right: 26, borderRadius: 28 },
  bubbleTicket: { width: 90, height: 62, bottom: 96, left: 24, transform: [{ rotate: "-16deg" }] },
  bubbleGlobe: { width: 78, height: 78, bottom: 54, left: 121, borderRadius: 39 },
  bubbleLuggage: { width: 82, height: 92, bottom: 84, right: 20, borderRadius: 30 },
  loadingBubbleText: { color: "#7B58F3", fontSize: 30, lineHeight: 34, fontWeight: "900" },
  loadingBubbleEmoji: { fontSize: 30 },
  loadingAvatarBubble: { position: "absolute", width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: 33, borderWidth: 2, borderColor: "rgba(255,255,255,0.92)", backgroundColor: "rgba(255,255,255,0.82)", shadowColor: "#B7A4E9", shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  avatarLeft: { left: 8, top: 192 },
  avatarRight: { right: 6, top: 198 },
  avatarBottom: { bottom: 2, left: 138 },
  loadingAvatarEmoji: { fontSize: 29 },
  loadingSparkle: { position: "absolute", width: 8, height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.96)", shadowColor: "#F9B6FF", shadowOpacity: 0.72, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  sparkleOne: { left: 64, top: 154 },
  sparkleTwo: { right: 56, top: 136 },
  sparkleThree: { bottom: 126, left: 92 },
  loadingCloud: { position: "absolute", width: 34, height: 16, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.76)" },
  cloudLeft: { left: -4, top: 112 },
  cloudRight: { right: -2, bottom: 150 },
  loadingBrand: { marginTop: -4, color: "#715FE5", fontSize: 22, letterSpacing: 6, fontWeight: "800" },
  loadingTitle: { marginTop: 12, color: "#121A34", fontSize: 32, lineHeight: 38, textAlign: "center", fontWeight: "900", letterSpacing: -0.8 },
  loadingTitleAccentBlue: { color: "#6A8EFF" },
  loadingTitleAccentPink: { color: "#F26BAA" },
  loadingCopy: { maxWidth: 340, marginTop: 10, color: "#7A86A0", fontSize: 16, lineHeight: 22, textAlign: "center", fontWeight: "700" },
  loadingProgressShell: { width: "100%", maxWidth: 320, height: 58, marginTop: 34, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 29, backgroundColor: "#11192F" },
  loadingProgressFill: { position: "absolute", left: 16, right: 68, height: 18, borderRadius: 999 },
  loadingProgressSparkle: { position: "absolute", right: 18, width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(255,255,255,0.05)" },
  loadingProgressSparkleText: { color: "#F384D0", fontSize: 19, fontWeight: "900" },
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
