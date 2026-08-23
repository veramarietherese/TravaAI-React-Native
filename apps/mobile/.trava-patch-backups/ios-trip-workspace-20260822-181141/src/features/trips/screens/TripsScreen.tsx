import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FlightStatus, TripStatus, TripSummary } from "@trava/shared";
import { type Href, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { checkFlightStatus } from "@/features/flights/api/flights.api";
import {
  listTripInvitations,
  listTrips,
  respondToTripInvitation,
  updateTripFlight,
} from "../api/trips.api";

const STATUS_FILTERS: Array<{ key: "all" | TripStatus; label: string }> = [
  { key: "all", label: "All trips" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Drafts" },
];

const QUICK_ACTIONS = [
  { key: "itinerary", title: "Itinerary", subtitle: "View your plans", glyph: "▦", colors: ["#FF9FB1", "#FF718F"] as const },
  { key: "budget", title: "Budget", subtitle: "Track your budget", glyph: "▣", colors: ["#B8F8D7", "#6DE4A8"] as const },
  { key: "expenses", title: "Expenses", subtitle: "Add & manage", glyph: "▤", colors: ["#FFD3A5", "#FF9F61"] as const },
  { key: "checklist", title: "Checklist", subtitle: "Stay organized", glyph: "✓", colors: ["#D7C7FF", "#AA83F7"] as const },
  { key: "documents", title: "Documents", subtitle: "Travel docs", glyph: "□", colors: ["#CFE9FF", "#8BC8FF"] as const },
] as const;

function normalizedFlightNumber(value: string | null | undefined) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
}

function firstName(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean.split(/\s+/)[0] : "Traveler";
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactDate(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "Date pending";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateRange(trip: TripSummary) {
  if (!trip.startDate && !trip.endDate) return "Dates pending";
  if (trip.startDate && !trip.endDate) return compactDate(trip.startDate);
  if (!trip.startDate && trip.endDate) return compactDate(trip.endDate);
  const start = parseDate(trip.startDate);
  const end = parseDate(trip.endDate);
  if (!start || !end) return `${compactDate(trip.startDate)} – ${compactDate(trip.endDate)}`;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startText} – ${endText}`;
}

function daysUntil(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function readiness(trip: TripSummary) {
  let score = 20;
  if (trip.destination.trim()) score += 12;
  if (trip.startDate) score += 12;
  if (trip.endDate) score += 10;
  if (trip.totalBudget > 0) score += 12;
  if (trip.flightNumber) score += 15;
  if (trip.travelStyle) score += 7;
  if (trip.travelGroup) score += 6;
  if (trip.coverImageUrl) score += 6;
  return Math.min(100, score);
}

function statusLabel(status: string | null | undefined) {
  const value = String(status ?? "scheduled").trim().toLowerCase();
  if (value === "en-route" || value === "active") return "En-route";
  if (value === "landed") return "Landed";
  if (value === "cancelled" || value === "canceled") return "Cancelled";
  if (value === "delayed") return "Delayed";
  if (value === "boarding") return "Boarding";
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : "Scheduled";
}

function formatFlightTime(value: string | null | undefined) {
  if (!value) return "—";
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${suffix}`;
}

function statusColors(status: string | null | undefined) {
  const value = String(status ?? "scheduled").toLowerCase();
  if (value.includes("cancel")) return { bg: "#FFE6EB", fg: "#CA3657" };
  if (value.includes("delay")) return { bg: "#FFF2CF", fg: "#8E6500" };
  if (value.includes("landed")) return { bg: "#E5F8EE", fg: "#21784B" };
  if (value.includes("route") || value.includes("active")) return { bg: "#EEE9FF", fg: "#7055EC" };
  return { bg: "#EEE9FF", fg: "#7055EC" };
}

export function TripsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TripStatus>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const tripsQuery = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    staleTime: 45_000,
  });
  const invitationsQuery = useQuery({
    queryKey: ["trip-invitations"],
    queryFn: listTripInvitations,
    staleTime: 45_000,
  });

  const invitationMutation = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: "accept" | "reject" }) => respondToTripInvitation(membershipId, action),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["trip-invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
    },
    onError: (error) => Alert.alert("Invitation", error instanceof Error ? error.message : "Unable to update the invitation."),
  });

  const trips = tripsQuery.data ?? [];
  const orderedTrips = useMemo(() => {
    return trips.slice().sort((a, b) => {
      const order: Record<TripStatus, number> = { ongoing: 0, upcoming: 1, draft: 2, completed: 3 };
      const statusDifference = order[a.status] - order[b.status];
      if (statusDifference) return statusDifference;
      const aDate = parseDate(a.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = parseDate(b.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
  }, [trips]);

  const defaultTrip = useMemo(() => {
    return orderedTrips.find((trip) => (trip.status === "ongoing" || trip.status === "upcoming") && trip.flightNumber)
      ?? orderedTrips.find((trip) => trip.status === "ongoing" || trip.status === "upcoming")
      ?? orderedTrips[0]
      ?? null;
  }, [orderedTrips]);

  const selectedTrip = orderedTrips.find((trip) => trip.id === selectedTripId) ?? defaultTrip;


  const filteredTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderedTrips.filter((trip) => {
      if (statusFilter !== "all" && trip.status !== statusFilter) return false;
      if (!q) return true;
      return [trip.name, trip.destination, trip.flightNumber, trip.travelStyle, trip.travelGroup]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [orderedTrips, search, statusFilter]);

  const upcomingTrips = useMemo(() => {
    const base = filteredTrips.filter((trip) => trip.id !== selectedTrip?.id);
    if (search.trim() || statusFilter !== "all") return base.slice(0, 8);
    return base.filter((trip) => trip.status === "ongoing" || trip.status === "upcoming").slice(0, 5);
  }, [filteredTrips, search, selectedTrip?.id, statusFilter]);

  async function refresh() {
    await Promise.all([tripsQuery.refetch(), invitationsQuery.refetch()]);
  }

  function openTrip(path = "") {
    if (!selectedTrip) return;
    router.push(`/trip/${selectedTrip.id}${path}` as Href);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={tripsQuery.isRefetching || invitationsQuery.isRefetching}
            onRefresh={() => void refresh()}
            tintColor="#7658EF"
          />
        }
        contentContainerStyle={[styles.content, { paddingHorizontal: compact ? 14 : 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxWidth}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.hello}>Hello, {firstName(profile?.full_name)} 👋</Text>
              <Text style={styles.title}>My Trips</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trip invitations"
                onPress={() => setInvitationsOpen((value) => !value)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <View style={styles.bellIcon}>
                  <View style={styles.bellBody} />
                  <View style={styles.bellClapper} />
                </View>
                {(invitationsQuery.data?.length ?? 0) > 0 ? <View style={styles.notificationDot} /> : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/trip/create" as Href)}
                style={({ pressed }) => [styles.newTripButton, pressed && styles.pressed]}
              >
                <Text style={styles.newTripPlus}>＋</Text>
                <Text style={styles.newTripText}>New Trip</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search trips, destinations, flights..."
              placeholderTextColor="#A0A7B7"
              style={styles.searchInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter trips"
              onPress={() => setFilterOpen((value) => !value)}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
            >
              <View style={styles.tuneIcon}>
                <View style={styles.tuneRow}><View style={styles.tuneLine} /><View style={[styles.tuneDot, { left: 6 }]} /></View>
                <View style={styles.tuneRow}><View style={styles.tuneLine} /><View style={[styles.tuneDot, { right: 5 }]} /></View>
                <View style={styles.tuneRow}><View style={styles.tuneLine} /><View style={[styles.tuneDot, { left: 9 }]} /></View>
              </View>
            </Pressable>
          </View>

          {filterOpen ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {STATUS_FILTERS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setStatusFilter(item.key)}
                  style={[styles.filterChip, statusFilter === item.key && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, statusFilter === item.key && styles.filterChipTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {invitationsOpen && (invitationsQuery.data?.length ?? 0) > 0 ? (
            <View style={styles.invitationPanel}>
              <View style={styles.invitationHeading}>
                <Text style={styles.invitationHeadingText}>Trip invitations</Text>
                <Text style={styles.invitationCount}>{invitationsQuery.data?.length}</Text>
              </View>
              {invitationsQuery.data?.map((invitation) => (
                <View key={invitation.membershipId} style={styles.invitationCard}>
                  <View style={styles.invitationCopy}>
                    <Text style={styles.invitationTitle}>{invitation.tripName}</Text>
                    <Text style={styles.invitationMeta}>{invitation.destination} · invited by {invitation.invitedByName}</Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <Pressable
                      disabled={invitationMutation.isPending}
                      onPress={() => invitationMutation.mutate({ membershipId: invitation.membershipId, action: "accept" })}
                      style={styles.acceptButton}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      disabled={invitationMutation.isPending}
                      onPress={() => invitationMutation.mutate({ membershipId: invitation.membershipId, action: "reject" })}
                      style={styles.declineButton}
                    >
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {tripsQuery.isLoading ? (
            <LoadingState />
          ) : tripsQuery.isError ? (
            <ErrorState error={tripsQuery.error} onRetry={() => void tripsQuery.refetch()} />
          ) : !selectedTrip ? (
            <EmptyState onCreate={() => router.push("/trip/create" as Href)} />
          ) : (
            <>
              <LiveFlightTicket
                key={selectedTrip.id}
                trip={selectedTrip}
                onFlightSaved={async () => {
                  await queryClient.invalidateQueries({ queryKey: ["trips"] });
                }}
              />

              <SelectedTripCard trip={selectedTrip} onPress={() => openTrip()} />

              <View style={styles.sectionHeadingBlock}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <Text style={styles.sectionSubtitle}>Everything for your latest trip.</Text>
              </View>

              <View style={styles.quickActions}>
                <View style={styles.quickRowTwo}>
                  {QUICK_ACTIONS.slice(0, 2).map((action) => (
                    <QuickActionCard
                      key={action.key}
                      action={action}
                      onPress={() => openTrip(`/${action.key}`)}
                    />
                  ))}
                </View>
                <View style={styles.quickRowThree}>
                  {QUICK_ACTIONS.slice(2).map((action) => (
                    <QuickActionCard
                      key={action.key}
                      action={action}
                      onPress={() => openTrip(`/${action.key}`)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.upcomingHeading}>
                <View>
                  <Text style={styles.sectionTitle}>{search.trim() || statusFilter !== "all" ? "Trips" : "Upcoming Trips"}</Text>
                  <Text style={styles.sectionSubtitle}>{search.trim() || statusFilter !== "all" ? "Matching your current search and filter." : "Open any trip to continue planning."}</Text>
                </View>
                <Pressable onPress={() => { setSearch(""); setStatusFilter("all"); setFilterOpen(false); }} style={styles.seeAllButton}>
                  <Text style={styles.seeAllText}>See All ›</Text>
                </Pressable>
              </View>

              {upcomingTrips.length ? (
                <View style={styles.upcomingList}>
                  {upcomingTrips.map((trip) => (
                    <UpcomingTripRow
                      key={trip.id}
                      trip={trip}
                      onPress={() => {
                        setSelectedTripId(trip.id);
                        router.push(`/trip/${trip.id}` as Href);
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.noMatches}>
                  <Text style={styles.noMatchesTitle}>No other trips here</Text>
                  <Text style={styles.noMatchesCopy}>Try another search or status filter.</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LiveFlightTicket({ trip, onFlightSaved }: { trip: TripSummary; onFlightSaved(): Promise<void> }) {
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const compactTicket = width < 480;
  const [flightInput, setFlightInput] = useState(trip.flightNumber ?? "");
  const [submittedFlight, setSubmittedFlight] = useState(normalizedFlightNumber(trip.flightNumber));
  const [manualStatus, setManualStatus] = useState<FlightStatus | null>(null);


  const statusQuery = useQuery({
    queryKey: ["flight-status", trip.id, submittedFlight, trip.flightDate ?? "latest"],
    queryFn: () => checkFlightStatus(submittedFlight, trip.flightDate, trip.id),
    enabled: submittedFlight.length >= 2,
    staleTime: 90_000,
    refetchInterval: submittedFlight.length >= 2 ? 120_000 : false,
    retry: 1,
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizedFlightNumber(flightInput);
      if (normalized.length < 2) throw new Error("Enter a valid airline and flight number.");

      // Validate against live AirLabs data before changing the trip configuration.
      const status = await checkFlightStatus(normalized, trip.flightDate, undefined, true);
      if (normalized !== normalizedFlightNumber(trip.flightNumber)) {
        await updateTripFlight(trip.id, normalized, trip.flightDate ?? null);
      }
      // A second request is served from the server cache and attaches the snapshot to this trip.
      await checkFlightStatus(normalized, trip.flightDate, trip.id);
      return { normalized, status };
    },
    onSuccess: async ({ normalized, status }) => {
      setSubmittedFlight(normalized);
      setManualStatus(status);
      queryClient.setQueryData(["flight-status", trip.id, normalized, trip.flightDate ?? "latest"], status);
      await onFlightSaved();
    },
  });

  const status = manualStatus ?? statusQuery.data ?? null;
  const statusColor = statusColors(status?.status);
  const depCode = status?.departure.airportCode ?? "—";
  const arrCode = status?.arrival.airportCode ?? "—";
  const depName = status?.departure.airportName ?? (depCode !== "—" ? `${depCode} Airport` : "Departure airport");
  const arrName = status?.arrival.airportName ?? (arrCode !== "—" ? `${arrCode} Airport` : trip.destination || "Arrival airport");
  const busy = checkMutation.isPending || statusQuery.isFetching;
  const error = checkMutation.error ?? (!manualStatus ? statusQuery.error : null);

  return (
    <View style={styles.ticketShadowWrap}>
      <LinearGradient
        colors={["#FFF3EE", "#FFF0F7", "#F2F1FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ticket, compactTicket && styles.ticketCompact]}
      >
        <TicketDots />
        <View style={styles.ticketNotchLeft} />
        <View style={styles.ticketNotchRight} />

        <View style={[styles.ticketMain, compactTicket && styles.ticketMainCompact]}>
          <View style={styles.ticketBadges}>
            <View style={styles.nextTripBadge}><Text style={styles.nextTripText}>⌁ Next Trip</Text></View>
            <View style={[styles.liveStatusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.liveStatusText, { color: statusColor.fg }]}>{busy && !status ? "Checking..." : `● ${statusLabel(status?.status)}`}</Text>
            </View>
          </View>

          <View style={styles.airportCodesRow}>
            <View style={[styles.airportBlock, compactTicket && styles.airportBlockCompact]}>
              <Text style={[styles.airportCode, compactTicket && styles.airportCodeCompact]}>{depCode}</Text>
              <Text numberOfLines={1} style={styles.airportName}>{depName}</Text>
            </View>
            <View style={styles.flightLineWrap}>
              <View style={styles.flightDashedLine} />
              <View style={styles.planeBubble}><Text style={styles.planeGlyph}>✈</Text></View>
            </View>
            <View style={[styles.airportBlock, styles.airportBlockRight, compactTicket && styles.airportBlockCompact]}>
              <Text style={[styles.airportCode, compactTicket && styles.airportCodeCompact]}>{arrCode}</Text>
              <Text numberOfLines={1} style={[styles.airportName, styles.airportNameRight]}>{arrName}</Text>
            </View>
          </View>

          <View style={[styles.ticketTimingRow, compactTicket && styles.ticketTimingRowCompact]}>
            <TicketDetail label="DEPARTS" value={formatFlightTime(status?.departure.estimatedTime ?? status?.departure.scheduledTime)} />
            <TicketDetail label="ETA / ARRIVES" value={formatFlightTime(status?.arrival.estimatedTime ?? status?.arrival.scheduledTime)} />
          </View>
          <Text style={styles.ticketDate}>{compactDate(status?.flightDate ?? trip.flightDate ?? trip.startDate)} · Local time</Text>
        </View>

        <View style={[styles.ticketStub, compactTicket && styles.ticketStubCompact]}>
          <TicketDetail label="GATE" value={status?.departure.gate ?? "—"} compact />
          <TicketDetail label="FLIGHT" value={(status?.flightNumber ?? submittedFlight) || "—"} compact />
          <View style={styles.stubPair}>
            <TicketDetail label="TERMINAL" value={status?.departure.terminal ?? "—"} compact />
            <TicketDetail label="SEAT" value="—" compact />
          </View>
          <Barcode />
        </View>
      </LinearGradient>

      <View style={styles.ticketControlBar}>
        <View style={styles.flightNumberInputWrap}>
          <Text style={styles.flightInputGlyph}>✈</Text>
          <TextInput
            value={flightInput}
            onChangeText={setFlightInput}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Add flight number"
            placeholderTextColor="#9AA3B5"
            style={styles.flightNumberInput}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={checkMutation.isPending}
          onPress={() => checkMutation.mutate()}
          style={({ pressed }) => [styles.checkFlightButton, pressed && styles.pressed, checkMutation.isPending && styles.disabled]}
        >
          {checkMutation.isPending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.checkFlightIcon}>↻</Text>}
          <Text style={styles.checkFlightText}>{checkMutation.isPending ? "Checking" : "Check flight"}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.flightErrorBox}>
          <Text style={styles.flightErrorText}>{error instanceof Error ? error.message : "Live flight data is unavailable right now."}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TicketDots() {
  return (
    <View pointerEvents="none" style={styles.ticketDots}>
      {Array.from({ length: 55 }, (_, index) => <View key={index} style={styles.ticketDot} />)}
    </View>
  );
}

function TicketDetail({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={compact ? styles.ticketDetailCompact : undefined}>
      <Text style={styles.ticketDetailLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.ticketDetailValue, compact && styles.ticketDetailValueCompact]}>{value}</Text>
    </View>
  );
}

function Barcode() {
  const bars = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3];
  return (
    <View style={styles.barcode}>
      {bars.map((bar, index) => <View key={`${bar}-${index}`} style={[styles.barcodeBar, { width: bar }]} />)}
    </View>
  );
}

function SelectedTripCard({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const score = readiness(trip);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.selectedTripCard, pressed && styles.pressed]}>
      <TripThumbnail trip={trip} large />
      <View style={styles.selectedTripCopy}>
        <Text numberOfLines={1} style={styles.selectedTripName}>{trip.name}</Text>
        <Text numberOfLines={1} style={styles.selectedTripDestination}>{trip.destination}</Text>
        <View style={styles.selectedTripMetaRow}>
          <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>you</Text></View>
          <View style={[styles.miniAvatar, styles.miniAvatarMuted]}><Text style={styles.miniAvatarText}>＋</Text></View>
          <Text style={styles.travelersText}>{Math.max(1, trip.memberCount)} {trip.memberCount === 1 ? "traveler" : "travelers"}</Text>
        </View>
      </View>
      <ReadinessRing value={score} />
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

function ReadinessRing({ value }: { value: number }) {
  const border = {
    borderTopColor: value >= 25 ? "#65D6B0" : "#E9EDF3",
    borderRightColor: value >= 50 ? "#65D6B0" : "#E9EDF3",
    borderBottomColor: value >= 75 ? "#65D6B0" : "#E9EDF3",
    borderLeftColor: value >= 100 ? "#65D6B0" : "#E9EDF3",
  };
  return (
    <View style={[styles.readinessRing, border]}>
      <Text style={styles.readinessValue}>{value}%</Text>
      <Text style={styles.readinessLabel}>Ready</Text>
    </View>
  );
}

function QuickActionCard({ action, onPress }: { action: (typeof QUICK_ACTIONS)[number]; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{action.title}</Text>
        <Text style={styles.quickSubtitle}>{action.subtitle}</Text>
      </View>
      <LinearGradient colors={[...action.colors]} style={styles.quickIcon}>
        <Text style={styles.quickGlyph}>{action.glyph}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function UpcomingTripRow({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const days = daysUntil(trip.startDate);
  const dayText = days === null ? "Open" : days < 0 ? "Past" : days === 0 ? "Today" : `${days} days`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.upcomingRow, pressed && styles.pressed]}
    >
      <TripThumbnail trip={trip} />
      <View style={styles.upcomingCopy}>
        <Text numberOfLines={1} style={styles.upcomingName}>{trip.name}</Text>
        <Text numberOfLines={1} style={styles.upcomingDestination}>{trip.destination}</Text>
        <Text numberOfLines={1} style={styles.upcomingDate}>▣ {dateRange(trip)}</Text>
      </View>
      <View style={styles.daysPill}><Text style={styles.daysText}>{dayText}</Text></View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

function TripThumbnail({ trip, large = false }: { trip: TripSummary; large?: boolean }) {
  const style = large ? styles.thumbnailLarge : styles.thumbnail;
  if (trip.coverImageUrl) {
    return <Image source={trip.coverImageUrl} contentFit="cover" transition={120} style={style} />;
  }
  return (
    <LinearGradient colors={["#FFD8E2", "#DAD5FF", "#CDEAFF"]} style={[style, styles.thumbnailFallback]}>
      <Text style={styles.thumbnailFallbackText}>{trip.destination.slice(0, 2).toUpperCase() || "TR"}</Text>
    </LinearGradient>
  );
}

function LoadingState() {
  return (
    <View style={styles.stateCard}>
      <ActivityIndicator color="#7357EF" size="large" />
      <Text style={styles.stateTitle}>Loading your trips</Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry(): void }) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateIcon}>!</Text>
      <Text style={styles.stateTitle}>Trips could not load</Text>
      <Text style={styles.stateCopy}>{error instanceof Error ? error.message : "Check your connection and try again."}</Text>
      <Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
    </View>
  );
}

function EmptyState({ onCreate }: { onCreate(): void }) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateIcon}>✈</Text>
      <Text style={styles.stateTitle}>Your next trip starts here</Text>
      <Text style={styles.stateCopy}>Create a trip to unlock live flights, itinerary, budget, expenses, checklist, and documents.</Text>
      <Pressable onPress={onCreate} style={styles.retryButton}><Text style={styles.retryText}>Create a trip</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBFBFE" },
  content: { paddingTop: 10, paddingBottom: 128 },
  maxWidth: { width: "100%", maxWidth: 760, alignSelf: "center" },
  header: { minHeight: 78, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerCopy: { flex: 1, minWidth: 0 },
  hello: { color: "#5D6070", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  title: { marginTop: 1, color: "#11182E", fontSize: 38, lineHeight: 43, fontWeight: "900", letterSpacing: -1.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "#E8EAF1", backgroundColor: "#FFFFFF" },
  bellIcon: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  bellBody: { width: 11, height: 12, marginTop: 1, borderWidth: 1.4, borderColor: "#667086", borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  bellClapper: { width: 4, height: 2, marginTop: 1, borderRadius: 2, backgroundColor: "#667086" },
  notificationDot: { position: "absolute", right: 6, top: 5, width: 7, height: 7, borderRadius: 99, backgroundColor: "#FF6685", borderWidth: 1.5, borderColor: "#FFFFFF" },
  newTripButton: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "#FF6B86", shadowColor: "#FF6B86", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  newTripPlus: { color: "#FFFFFF", fontSize: 18, lineHeight: 20, fontWeight: "700" },
  newTripText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.6 },

  searchBox: { height: 49, marginTop: 3, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: "#E9EBF2", backgroundColor: "#FFFFFF", shadowColor: "#1E2945", shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  searchGlyph: { color: "#97A0B1", fontSize: 20, lineHeight: 22 },
  searchInput: { flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 10, color: "#1D2942", fontSize: 11, fontWeight: "700" },
  filterButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  tuneIcon: { width: 16, height: 15, justifyContent: "space-between", paddingVertical: 1 },
  tuneRow: { height: 3, justifyContent: "center" },
  tuneLine: { height: 1.2, borderRadius: 2, backgroundColor: "#8993A7" },
  tuneDot: { position: "absolute", top: 0, width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: "#8993A7" },
  filterRow: { paddingTop: 10, paddingBottom: 2, gap: 7 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F0F1F6" },
  filterChipActive: { backgroundColor: "#7357EF" },
  filterChipText: { color: "#717C90", fontSize: 9, fontWeight: "800" },
  filterChipTextActive: { color: "#FFFFFF" },

  invitationPanel: { marginTop: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: "#F1E5EF", backgroundColor: "#FFF9FC" },
  invitationHeading: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7 },
  invitationHeadingText: { color: "#202B43", fontSize: 12, fontWeight: "900" },
  invitationCount: { minWidth: 19, height: 19, borderRadius: 10, textAlign: "center", lineHeight: 19, backgroundColor: "#F0E9FF", color: "#7357EF", fontSize: 9, fontWeight: "900" },
  invitationCard: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#F1E7EF" },
  invitationCopy: { flex: 1, minWidth: 0 },
  invitationTitle: { color: "#1F2B43", fontSize: 11, fontWeight: "900" },
  invitationMeta: { marginTop: 2, color: "#7F899A", fontSize: 9, lineHeight: 12, fontWeight: "600" },
  invitationActions: { flexDirection: "row", gap: 5 },
  acceptButton: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: "#7357EF" },
  acceptText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  declineButton: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, borderWidth: 1, borderColor: "#E5E7EF", backgroundColor: "#FFFFFF" },
  declineText: { color: "#7A8396", fontSize: 8, fontWeight: "900" },

  ticketShadowWrap: { marginTop: 16, borderRadius: 24, backgroundColor: "#FFFFFF", shadowColor: "#1E2945", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  ticket: { minHeight: 244, flexDirection: "row", overflow: "hidden", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: "#E6E3F2" },
  ticketCompact: { minHeight: 224 },
  ticketDots: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", flexWrap: "wrap", gap: 18, paddingHorizontal: 28, paddingTop: 20, opacity: 0.2 },
  ticketDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: "#DCAAC6" },
  ticketNotchLeft: { position: "absolute", left: -11, top: "53%", width: 22, height: 22, borderRadius: 11, backgroundColor: "#FBFBFE", borderWidth: 1, borderColor: "#ECE9F1", zIndex: 5 },
  ticketNotchRight: { position: "absolute", right: -11, top: "53%", width: 22, height: 22, borderRadius: 11, backgroundColor: "#FBFBFE", borderWidth: 1, borderColor: "#ECE9F1", zIndex: 5 },
  ticketMain: { flex: 1, minWidth: 0, paddingHorizontal: 20, paddingVertical: 17 },
  ticketMainCompact: { paddingHorizontal: 13, paddingVertical: 14 },
  ticketStub: { width: 130, paddingHorizontal: 15, paddingVertical: 17, gap: 14, borderLeftWidth: 1, borderLeftColor: "rgba(136,121,180,0.18)", borderStyle: "dashed" },
  ticketStubCompact: { width: 105, paddingHorizontal: 10, paddingVertical: 14, gap: 11 },
  ticketBadges: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  nextTripBadge: { minHeight: 23, justifyContent: "center", paddingHorizontal: 9, borderRadius: 999, backgroundColor: "#DDF9EC" },
  nextTripText: { color: "#2E9D71", fontSize: 8, fontWeight: "900" },
  liveStatusBadge: { minHeight: 23, justifyContent: "center", paddingHorizontal: 9, borderRadius: 999 },
  liveStatusText: { fontSize: 8, fontWeight: "900" },
  airportCodesRow: { marginTop: 24, flexDirection: "row", alignItems: "center" },
  airportBlock: { width: 132, minWidth: 0 },
  airportBlockCompact: { width: 88 },
  airportBlockRight: { alignItems: "flex-end" },
  airportCode: { color: "#11182E", fontSize: 35, lineHeight: 38, fontWeight: "900", letterSpacing: -1.5 },
  airportCodeCompact: { fontSize: 27, lineHeight: 31, letterSpacing: -1 },
  airportName: { marginTop: 3, color: "#788297", fontSize: 8, lineHeight: 11, fontWeight: "700", maxWidth: 130 },
  airportNameRight: { textAlign: "right" },
  flightLineWrap: { flex: 1, minWidth: 60, height: 28, alignItems: "center", justifyContent: "center", marginHorizontal: 4 },
  flightDashedLine: { position: "absolute", left: 0, right: 0, top: 14, borderTopWidth: 1.2, borderStyle: "dashed", borderColor: "#B7A9F3" },
  planeBubble: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#F2EDFF" },
  planeGlyph: { color: "#8C73EC", fontSize: 14 },
  ticketTimingRow: { marginTop: 26, flexDirection: "row", gap: 30 },
  ticketTimingRowCompact: { marginTop: 20, gap: 14 },
  ticketDetailLabel: { color: "#8A8FA0", fontSize: 7, lineHeight: 10, fontWeight: "900", letterSpacing: 0.8 },
  ticketDetailValue: { marginTop: 3, color: "#17213A", fontSize: 16, lineHeight: 19, fontWeight: "900" },
  ticketDetailCompact: { minWidth: 0 },
  ticketDetailValueCompact: { fontSize: 12, lineHeight: 15 },
  ticketDate: { marginTop: 5, color: "#858C9C", fontSize: 8, fontWeight: "700" },
  stubPair: { flexDirection: "row", gap: 14 },
  barcode: { height: 35, flexDirection: "row", alignItems: "stretch", gap: 1.5, marginTop: 2, overflow: "hidden" },
  barcodeBar: { backgroundColor: "#343647" },
  ticketControlBar: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderWidth: 1, borderTopWidth: 0, borderColor: "#E8EAF1", backgroundColor: "#FFFFFF" },
  flightNumberInputWrap: { flex: 1, minWidth: 0, height: 38, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, borderRadius: 13, backgroundColor: "#F5F6FA" },
  flightInputGlyph: { color: "#8D95A7", fontSize: 12 },
  flightNumberInput: { flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 8, color: "#3A4357", fontSize: 10, fontWeight: "800" },
  checkFlightButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "#171A2B" },
  checkFlightIcon: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  checkFlightText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  flightErrorBox: { marginTop: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: "#FFF0F4", borderWidth: 1, borderColor: "#FFD5DF" },
  flightErrorText: { color: "#B33A5D", fontSize: 9, lineHeight: 13, fontWeight: "700" },

  selectedTripCard: { minHeight: 78, marginTop: 12, flexDirection: "row", alignItems: "center", padding: 9, borderRadius: 20, borderWidth: 1, borderColor: "#EBEDF3", backgroundColor: "#FFFFFF", shadowColor: "#1E2945", shadowOpacity: 0.03, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  thumbnailLarge: { width: 65, height: 59, borderRadius: 15 },
  thumbnail: { width: 78, height: 52, borderRadius: 13 },
  thumbnailFallback: { alignItems: "center", justifyContent: "center" },
  thumbnailFallbackText: { color: "#6254B3", fontSize: 12, fontWeight: "900" },
  selectedTripCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  selectedTripName: { color: "#17213A", fontSize: 12, lineHeight: 15, fontWeight: "900" },
  selectedTripDestination: { marginTop: 2, color: "#7D8697", fontSize: 8, lineHeight: 11, fontWeight: "600" },
  selectedTripMetaRow: { marginTop: 5, flexDirection: "row", alignItems: "center" },
  miniAvatar: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#23263A", borderWidth: 1.5, borderColor: "#FFFFFF" },
  miniAvatarMuted: { marginLeft: -4, backgroundColor: "#EDE9FF" },
  miniAvatarText: { color: "#FFFFFF", fontSize: 5.5, fontWeight: "900" },
  travelersText: { marginLeft: 5, color: "#7A8395", fontSize: 7, fontWeight: "700" },
  readinessRing: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 5, backgroundColor: "#FFFFFF" },
  readinessValue: { color: "#283248", fontSize: 10, lineHeight: 12, fontWeight: "900" },
  readinessLabel: { color: "#72A995", fontSize: 6.5, lineHeight: 8, fontWeight: "800" },
  rowChevron: { marginLeft: 8, marginRight: 2, color: "#2E3548", fontSize: 22, lineHeight: 24, fontWeight: "500" },

  sectionHeadingBlock: { marginTop: 20 },
  sectionTitle: { color: "#17213A", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  sectionSubtitle: { marginTop: 2, color: "#9299A9", fontSize: 8, lineHeight: 11, fontWeight: "600" },
  quickActions: { marginTop: 10, gap: 9 },
  quickRowTwo: { flexDirection: "row", gap: 9 },
  quickRowThree: { flexDirection: "row", gap: 9 },
  quickCard: { flex: 1, minWidth: 0, minHeight: 82, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: "#E9EBF1", backgroundColor: "#FFFFFF" },
  quickCopy: { flex: 1, minWidth: 0, paddingRight: 7 },
  quickTitle: { color: "#20293E", fontSize: 9, lineHeight: 12, fontWeight: "900" },
  quickSubtitle: { marginTop: 3, color: "#8D95A5", fontSize: 7, lineHeight: 10, fontWeight: "600" },
  quickIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, transform: [{ rotate: "-4deg" }] },
  quickGlyph: { color: "#FFFFFF", fontSize: 21, lineHeight: 24, fontWeight: "700" },

  upcomingHeading: { marginTop: 21, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  seeAllButton: { paddingVertical: 4, paddingLeft: 8 },
  seeAllText: { color: "#7658EF", fontSize: 8, fontWeight: "900" },
  upcomingList: { marginTop: 10, gap: 9 },
  upcomingRow: { minHeight: 70, flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 17, borderWidth: 1, borderColor: "#EAECF2", backgroundColor: "#FFFFFF", shadowColor: "#1D2945", shadowOpacity: 0.025, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  upcomingCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  upcomingName: { color: "#1A243B", fontSize: 10, lineHeight: 13, fontWeight: "900" },
  upcomingDestination: { marginTop: 1, color: "#798398", fontSize: 7.5, lineHeight: 10, fontWeight: "600" },
  upcomingDate: { marginTop: 4, color: "#9AA1AF", fontSize: 6.8, lineHeight: 9, fontWeight: "700" },
  daysPill: { minWidth: 58, minHeight: 27, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 999, backgroundColor: "#EEF5FF" },
  daysText: { color: "#6B84AE", fontSize: 7, fontWeight: "900" },
  noMatches: { marginTop: 10, alignItems: "center", paddingVertical: 22, borderRadius: 17, borderWidth: 1, borderStyle: "dashed", borderColor: "#E0E3EB", backgroundColor: "#FFFFFF" },
  noMatchesTitle: { color: "#253049", fontSize: 11, fontWeight: "900" },
  noMatchesCopy: { marginTop: 3, color: "#8A94A5", fontSize: 8, fontWeight: "600" },

  stateCard: { marginTop: 26, alignItems: "center", paddingHorizontal: 24, paddingVertical: 34, borderRadius: 24, borderWidth: 1, borderColor: "#ECEEF4", backgroundColor: "#FFFFFF" },
  stateIcon: { width: 48, height: 48, borderRadius: 24, textAlign: "center", textAlignVertical: "center", lineHeight: 48, backgroundColor: "#EEE9FF", color: "#7357EF", fontSize: 22, fontWeight: "900" },
  stateTitle: { marginTop: 10, color: "#1E2942", fontSize: 14, fontWeight: "900" },
  stateCopy: { marginTop: 5, maxWidth: 430, textAlign: "center", color: "#7D879A", fontSize: 9, lineHeight: 14, fontWeight: "600" },
  retryButton: { marginTop: 12, minHeight: 39, justifyContent: "center", paddingHorizontal: 16, borderRadius: 13, backgroundColor: "#7357EF" },
  retryText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
});
