import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripSummary } from "@trava/shared";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { listTripInvitations, listTrips, respondToTripInvitation } from "../api/trips.api";

const TOOL_CARDS = [
  ["Itinerary", "View your plans", "▦", "itinerary", ["#FFF8FA", "#FFEAF0"]],
  ["Budget", "Track your budget", "▣", "budget", ["#F5FFF9", "#E6FFF2"]],
  ["Expenses", "Add & manage", "▤", "expenses", ["#FFF8F0", "#FFF0DA"]],
  ["Checklist", "Stay organized", "✓", "checklist", ["#FBF7FF", "#F0E6FF"]],
  ["Documents", "Travel docs", "▱", "documents", ["#F6FBFF", "#EAF5FF"]],
] as const;

function tripDate(trip: TripSummary) {
  if (!trip.startDate) return "Dates not set";
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = trip.endDate ? new Date(`${trip.endDate}T00:00:00`) : start;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return start.getTime() === end.getTime() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function daysUntil(trip: TripSummary) {
  if (!trip.startDate) return null;
  const now = new Date();
  const start = new Date(`${trip.startDate}T00:00:00`);
  return Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 86400000));
}

function readinessScore(trip: TripSummary) {
  const checks = [
    Boolean(trip.destination?.trim()),
    Boolean(trip.startDate),
    Boolean(trip.endDate),
    trip.totalBudget > 0,
    Boolean(trip.flightNumber),
    trip.memberCount > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function TripsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { profile, user } = useAuth();
  const [search, setSearch] = useState("");

  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips, staleTime: 60_000 });
  const invitationsQuery = useQuery({ queryKey: ["trip-invitations"], queryFn: listTripInvitations, staleTime: 30_000 });
  const invitationMutation = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: "accept" | "reject" }) =>
      respondToTripInvitation(membershipId, action),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["trip-invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
    },
    onError: (error) => Alert.alert("Invitation", error instanceof Error ? error.message : "Unable to update invitation."),
  });

  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data]);
  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => trips.filter((trip) => !q || [trip.name, trip.destination, trip.flightNumber].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))),
    [q, trips],
  );
  const primary = visible.find((t) => t.status === "ongoing") ?? visible.find((t) => t.status === "upcoming") ?? visible[0] ?? null;
  const upcoming = visible.filter((t) => primary?.id !== t.id && t.status !== "completed").slice(0, 5);
  const name =
    profile?.full_name ||
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
    user?.email?.split("@")[0] ||
    "Traveler";

  async function refresh() {
    await Promise.all([tripsQuery.refetch(), invitationsQuery.refetch()]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={tripsQuery.isRefetching || invitationsQuery.isRefetching} onRefresh={() => void refresh()} tintColor="#7358EE" />}
        contentContainerStyle={[styles.content, { paddingHorizontal: width < 390 ? 14 : 18 }]}
      >
        <View style={styles.maxWidth}>
          <View style={styles.topLine}>
            <View>
              <Text style={styles.hello}>Hello, {name.split(" ")[0]} 👋</Text>
              <Text style={styles.title}>My Trips</Text>
            </View>
            <View style={styles.topActions}>
              <Pressable style={styles.notification}><Text style={styles.notificationText}>♧</Text></Pressable>
              <Pressable onPress={() => router.push("/trip/create" as Href)} style={({ pressed }) => [styles.newTrip, pressed && styles.pressed]}>
                <Text style={styles.newTripText}>＋ New Trip</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              placeholder="Search trips, destinations, flights..."
              placeholderTextColor="#A0A6B5"
              style={styles.searchInput}
            />
            <Text style={styles.filterGlyph}>☷</Text>
          </View>

          {tripsQuery.isLoading ? (
            <View style={styles.loading}><ActivityIndicator size="large" color="#7358EE" /><Text style={styles.loadingText}>Loading your travel workspace…</Text></View>
          ) : primary ? (
            <>
              <Pressable onPress={() => router.push(`/trip/${primary.id}` as Href)} style={({ pressed }) => [styles.ticketWrap, pressed && styles.pressed]}>
                <LinearGradient colors={["#FFF1F4", "#F3F1FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ticket}>
                  <View style={styles.ticketMain}>
                    <View style={styles.ticketBadge}><Text style={styles.ticketBadgeText}>⌁ Next Trip</Text></View>
                    <View style={styles.routeRow}>
                      <View style={styles.airportBlock}>
                        <Text style={styles.airportCode}>{primary.flightNumber ? primary.flightNumber.slice(0, 3).toUpperCase() : "TRV"}</Text>
                        <Text numberOfLines={1} style={styles.airportName}>{primary.ownerName || "Departure"}</Text>
                      </View>
                      <View style={styles.routeLine}>
                        <View style={styles.routeDash} />
                        <Text style={styles.plane}>✈</Text>
                        <View style={styles.routeDash} />
                      </View>
                      <View style={[styles.airportBlock, styles.airportRight]}>
                        <Text style={styles.airportCode}>{primary.destination.slice(0, 3).toUpperCase()}</Text>
                        <Text numberOfLines={1} style={styles.airportName}>{primary.destination}</Text>
                      </View>
                    </View>
                    <View style={styles.ticketFacts}>
                      <View><Text style={styles.factLabel}>DEPARTS</Text><Text style={styles.factValue}>{primary.startDate ? new Date(`${primary.startDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</Text></View>
                      <View><Text style={styles.factLabel}>TRIP</Text><Text style={styles.factValue}>{primary.numberOfDays || "—"} days</Text></View>
                    </View>
                  </View>
                  <View style={styles.ticketStub}>
                    <Text style={styles.factLabel}>FLIGHT</Text>
                    <Text style={styles.stubValue}>{primary.flightNumber || "—"}</Text>
                    <Text style={[styles.factLabel, { marginTop: 13 }]}>STATUS</Text>
                    <Text style={styles.stubValue}>{primary.status}</Text>
                    <View style={styles.barcode}>{Array.from({ length: 16 }, (_, i) => <View key={i} style={[styles.bar, { width: i % 3 === 0 ? 2 : 1 }]} />)}</View>
                  </View>
                </LinearGradient>
                <View style={styles.ticketFooter}>
                  <Text style={styles.flightTag}>✈ {primary.flightNumber || "Trip details"}</Text>
                  <Pressable onPress={() => router.push(`/trip/${primary.id}` as Href)} style={styles.checkFlight}><Text style={styles.checkFlightText}>↻ Check trip</Text></Pressable>
                </View>
              </Pressable>

              <Pressable onPress={() => router.push(`/trip/${primary.id}` as Href)} style={({ pressed }) => [styles.readiness, pressed && styles.pressed]}>
                {primary.coverImageUrl ? <Image source={{ uri: primary.coverImageUrl }} contentFit="cover" cachePolicy="memory-disk" style={styles.readinessImage} /> : <LinearGradient colors={["#FF5F8D", "#566BFF"]} style={styles.readinessImage} />}
                <View style={styles.readinessCopy}>
                  <Text style={styles.readinessTitle}>{primary.name}</Text>
                  <Text style={styles.readinessMeta}>{primary.destination}</Text>
                  <View style={styles.memberRow}><Text style={styles.memberBubble}>YOU</Text><Text style={styles.memberBubble}>＋{Math.max(0, primary.memberCount - 1)}</Text><Text style={styles.travelers}>{primary.memberCount} travelers</Text></View>
                </View>
                <View style={styles.progressRing}><Text style={styles.progressValue}>{readinessScore(primary)}%</Text><Text style={styles.progressLabel}>Ready</Text></View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Quick Actions</Text><Text style={styles.sectionSubtitle}>Everything for your latest trip.</Text></View>
              <View style={styles.toolGrid}>
                {TOOL_CARDS.map(([label, subtitle, glyph, suffix, colors], index) => (
                  <Pressable
                    key={suffix}
                    onPress={() => router.push(`/trip/${primary.id}/${suffix}` as Href)}
                    style={({ pressed }) => [styles.toolPress, index < 2 ? styles.toolHalf : styles.toolThird, pressed && styles.pressed]}
                  >
                    <LinearGradient colors={[colors[0], colors[1]]} style={styles.toolCard}>
                      <View style={styles.toolText}><Text style={styles.toolTitle}>{label}</Text><Text style={styles.toolSubtitle}>{subtitle}</Text></View>
                      <View style={styles.toolIcon}><Text style={styles.toolGlyph}>{glyph}</Text></View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.sectionHeading, { marginTop: 20, flexDirection: "row", justifyContent: "space-between" }]}>
                <View><Text style={styles.sectionTitle}>Upcoming Trips</Text><Text style={styles.sectionSubtitle}>Open any trip to continue planning.</Text></View>
                <Text style={styles.seeAll}>See All ›</Text>
              </View>
              <View style={styles.tripRows}>
                {(upcoming.length ? upcoming : [primary]).map((trip) => (
                  <Pressable key={trip.id} onPress={() => router.push(`/trip/${trip.id}` as Href)} style={({ pressed }) => [styles.tripRow, pressed && styles.pressed]}>
                    {trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" cachePolicy="memory-disk" style={styles.tripThumb} /> : <LinearGradient colors={["#FF6388", "#5F66E8"]} style={styles.tripThumb} />}
                    <View style={styles.tripCopy}><Text style={styles.tripName}>{trip.name}</Text><Text style={styles.tripDestination}>{trip.destination}</Text><Text style={styles.tripDate}>{tripDate(trip)}</Text></View>
                    {daysUntil(trip) !== null ? <View style={styles.dayPill}><Text style={styles.dayPillText}>{daysUntil(trip)} days</Text></View> : null}
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.empty}><Text style={styles.emptyPlane}>✈</Text><Text style={styles.emptyTitle}>Your next trip starts here</Text><Text style={styles.emptyText}>Create a trip and TRAVA will organize the itinerary, budget, expenses, checklist and documents in one workspace.</Text><Pressable onPress={() => router.push("/trip/create" as Href)} style={styles.newTrip}><Text style={styles.newTripText}>＋ Create trip</Text></Pressable></View>
          )}

          {(invitationsQuery.data?.length ?? 0) > 0 ? (
            <View style={styles.invites}>
              <Text style={styles.sectionTitle}>Trip invitations</Text>
              {invitationsQuery.data?.map((inv) => (
                <View key={inv.membershipId} style={styles.inviteRow}>
                  <View style={styles.inviteCopy}><Text style={styles.inviteTitle}>{inv.tripName}</Text><Text style={styles.inviteMeta}>{inv.destination} · from {inv.invitedByName}</Text></View>
                  <Pressable disabled={invitationMutation.isPending} onPress={() => invitationMutation.mutate({ membershipId: inv.membershipId, action: "accept" })} style={styles.accept}><Text style={styles.acceptText}>Accept</Text></Pressable>
                  <Pressable disabled={invitationMutation.isPending} onPress={() => invitationMutation.mutate({ membershipId: inv.membershipId, action: "reject" })} style={styles.decline}><Text style={styles.declineText}>Decline</Text></Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAFAFD" },
  content: { paddingTop: 6, paddingBottom: 130 },
  maxWidth: { width: "100%", maxWidth: 760, alignSelf: "center" },
  topLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { color: "#8D93A1", fontSize: 9, fontWeight: "700" },
  title: { marginTop: 1, color: "#101728", fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.5 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  notification: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF4" },
  notificationText: { color: "#697286", fontSize: 18 },
  newTrip: { minHeight: 39, alignItems: "center", justifyContent: "center", paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#FF6385" },
  newTripText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  searchBox: { height: 45, marginTop: 11, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF4" },
  searchIcon: { color: "#949BAC", fontSize: 18 },
  searchInput: { flex: 1, height: "100%", paddingHorizontal: 8, color: "#1E2940", fontSize: 10, fontWeight: "700" },
  filterGlyph: { color: "#8C94A5", fontSize: 15 },
  loading: { minHeight: 350, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#7F8798", fontSize: 10, fontWeight: "700" },
  ticketWrap: { marginTop: 13, overflow: "hidden", borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECECF3" },
  ticket: { minHeight: 205, flexDirection: "row" },
  ticketMain: { flex: 1, padding: 16 },
  ticketStub: { width: 105, padding: 14, borderLeftWidth: 1, borderLeftColor: "rgba(120,112,160,0.18)" },
  ticketBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: "#E9FFF1" },
  ticketBadgeText: { color: "#42B677", fontSize: 7, fontWeight: "900" },
  routeRow: { marginTop: 18, flexDirection: "row", alignItems: "center" },
  airportBlock: { width: 110 },
  airportRight: { alignItems: "flex-end" },
  airportCode: { color: "#11182A", fontSize: 30, lineHeight: 32, fontWeight: "900", letterSpacing: -1 },
  airportName: { marginTop: 4, width: 110, color: "#878E9E", fontSize: 7, fontWeight: "700" },
  routeLine: { flex: 1, minWidth: 70, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  routeDash: { flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#B6A7FF" },
  plane: { marginHorizontal: 6, color: "#765CEB", fontSize: 17 },
  ticketFacts: { marginTop: 20, flexDirection: "row", gap: 25 },
  factLabel: { color: "#A0A5B1", fontSize: 6, letterSpacing: 0.7, fontWeight: "900" },
  factValue: { marginTop: 3, color: "#1B2437", fontSize: 9, fontWeight: "900" },
  stubValue: { marginTop: 4, color: "#141C30", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  barcode: { marginTop: "auto", height: 28, flexDirection: "row", alignItems: "stretch", gap: 2 },
  bar: { height: "100%", backgroundColor: "#5D6270" },
  ticketFooter: { height: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, backgroundColor: "#FFFFFF" },
  flightTag: { color: "#6C7486", fontSize: 8, fontWeight: "800" },
  checkFlight: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#191C2C" },
  checkFlightText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  readiness: { marginTop: 12, minHeight: 73, flexDirection: "row", alignItems: "center", padding: 9, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF4" },
  readinessImage: { width: 63, height: 55, borderRadius: 13, overflow: "hidden" },
  readinessCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  readinessTitle: { color: "#182239", fontSize: 11, fontWeight: "900" },
  readinessMeta: { marginTop: 2, color: "#8A92A2", fontSize: 8, fontWeight: "700" },
  memberRow: { marginTop: 7, flexDirection: "row", alignItems: "center" },
  memberBubble: { marginRight: -2, paddingHorizontal: 5, height: 16, lineHeight: 16, borderRadius: 8, overflow: "hidden", color: "#5D6070", backgroundColor: "#F0F1F5", fontSize: 6, fontWeight: "900" },
  travelers: { marginLeft: 6, color: "#7F8798", fontSize: 7, fontWeight: "700" },
  progressRing: { width: 49, height: 49, borderRadius: 25, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#65D3AD", backgroundColor: "#F4FFFA" },
  progressValue: { color: "#203044", fontSize: 9, fontWeight: "900" },
  progressLabel: { color: "#7B8998", fontSize: 6, fontWeight: "700" },
  chevron: { marginLeft: 8, color: "#202B42", fontSize: 22, fontWeight: "500" },
  sectionHeading: { marginTop: 18 },
  sectionTitle: { color: "#172139", fontSize: 13, lineHeight: 16, fontWeight: "900" },
  sectionSubtitle: { marginTop: 3, color: "#9299A8", fontSize: 7, fontWeight: "700" },
  toolGrid: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toolPress: { minWidth: 0 },
  toolHalf: { width: "49%", flexGrow: 1 },
  toolThird: { width: "31.8%", flexGrow: 1 },
  toolCard: { minHeight: 81, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 17, borderWidth: 1, borderColor: "rgba(255,255,255,0.95)" },
  toolText: { flex: 1, minWidth: 0 },
  toolTitle: { color: "#1D273D", fontSize: 9, fontWeight: "900" },
  toolSubtitle: { marginTop: 3, color: "#8E96A6", fontSize: 7, fontWeight: "700" },
  toolIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.7)" },
  toolGlyph: { color: "#7358EE", fontSize: 21, fontWeight: "900" },
  seeAll: { color: "#7358EE", fontSize: 7, fontWeight: "900" },
  tripRows: { marginTop: 8, gap: 7 },
  tripRow: { minHeight: 61, flexDirection: "row", alignItems: "center", padding: 7, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF4" },
  tripThumb: { width: 70, height: 48, borderRadius: 12, overflow: "hidden" },
  tripCopy: { flex: 1, minWidth: 0, paddingHorizontal: 9 },
  tripName: { color: "#1D273D", fontSize: 9, fontWeight: "900" },
  tripDestination: { marginTop: 2, color: "#878F9F", fontSize: 7, fontWeight: "700" },
  tripDate: { marginTop: 4, color: "#A0A6B3", fontSize: 6, fontWeight: "700" },
  dayPill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 11, backgroundColor: "#EEF6FF" },
  dayPillText: { color: "#6686A6", fontSize: 7, fontWeight: "900" },
  empty: { marginTop: 18, alignItems: "center", padding: 34, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF4" },
  emptyPlane: { color: "#7358EE", fontSize: 35 },
  emptyTitle: { marginTop: 8, color: "#172139", fontSize: 16, fontWeight: "900" },
  emptyText: { marginTop: 6, maxWidth: 420, color: "#8891A2", fontSize: 10, lineHeight: 16, textAlign: "center", fontWeight: "600" },
  invites: { marginTop: 22, gap: 7 },
  inviteRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 15, backgroundColor: "#FFF8FA" },
  inviteCopy: { flex: 1, minWidth: 0 },
  inviteTitle: { color: "#1D273D", fontSize: 9, fontWeight: "900" },
  inviteMeta: { marginTop: 2, color: "#8B93A2", fontSize: 7, fontWeight: "700" },
  accept: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#7257EC" },
  acceptText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900" },
  decline: { marginLeft: 5, paddingHorizontal: 8, paddingVertical: 7 },
  declineText: { color: "#9B6A78", fontSize: 7, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
});
