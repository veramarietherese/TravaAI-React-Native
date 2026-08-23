// TRAVA_DASHBOARD_V2 — full visual replacement, not the legacy dashboard.
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FlightStatus, TripSummary } from "@trava/shared";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { checkFlightStatus } from "@/features/flights/api/flights.api";
import { listTripInvitations, listTrips, respondToTripInvitation } from "../api/trips.api";
import { GlassCard, GradientPill, TRAVA, formatShortDate } from "../components/TravaUI";
import {
  compressTicketForWeb,
  loadScannedTicket,
  mockParseTicket,
  pickTicket,
  saveScannedTicket,
  type ScannedTicket,
} from "../utils/ticket-scanner";

type QuickActionKind = "calendar" | "wallet" | "receipt" | "checklist" | "folder";

const QUICK_ACTIONS = [
  { label: "Itinerary", subtitle: "View your plans", suffix: "itinerary", kind: "calendar" as QuickActionKind, colors: ["#FF9BAD", "#FF6F8E"] as const },
  { label: "Budget", subtitle: "Track your budget", suffix: "budget", kind: "wallet" as QuickActionKind, colors: ["#9AF2C5", "#5AD8A0"] as const },
  { label: "Expenses", subtitle: "Add & manage", suffix: "expenses", kind: "receipt" as QuickActionKind, colors: ["#FFD19B", "#FFA45F"] as const },
  { label: "Checklist", subtitle: "Stay organized", suffix: "checklist", kind: "checklist" as QuickActionKind, colors: ["#DAB8FF", "#A978F2"] as const },
  { label: "Documents", subtitle: "Travel docs", suffix: "documents", kind: "folder" as QuickActionKind, colors: ["#BFE5FF", "#7DB9F3"] as const },
] as const;

export function TripsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ticket, setTicket] = useState<ScannedTicket | null>(null);
  const [liveFlight, setLiveFlight] = useState<FlightStatus | null>(null);

  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  const invitationsQuery = useQuery({ queryKey: ["trip-invitations"], queryFn: listTripInvitations });
  const invitationMutation = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: "accept" | "reject" }) => respondToTripInvitation(membershipId, action),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["trip-invitations"] }),
      ]);
    },
  });

  const trips = tripsQuery.data ?? [];
  const featured = useMemo(() => chooseFeaturedTrip(trips), [trips]);
  const currentTicket = useMemo(() => mergeLiveTicket(ticket ?? deriveTicketFromTrip(featured), liveFlight), [featured, liveFlight, ticket]);

  useEffect(() => {
    setLiveFlight(null);
    if (!featured?.id) { setTicket(null); return; }
    void loadScannedTicket(featured.id).then(setTicket);
  }, [featured?.id]);

  const liveLookup = useMutation({
    mutationFn: () => checkFlightStatus(currentTicket.flightNumber, currentTicket.date || null, featured?.id ?? undefined),
    onSuccess: (data) => setLiveFlight(data),
    onError: (error) => Alert.alert("Flight status", error instanceof Error ? error.message : "Unable to retrieve live flight status."),
  });

  const upcoming = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips
      .filter((trip) => trip.id !== featured?.id)
      .filter((trip) => !q || [trip.name, trip.destination, trip.flightNumber].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)))
      .sort(sortTrips)
      .slice(0, 5);
  }, [featured?.id, search, trips]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={tripsQuery.isRefetching || invitationsQuery.isRefetching} onRefresh={() => void Promise.all([tripsQuery.refetch(), invitationsQuery.refetch()])} tintColor={TRAVA.purple} />}
        contentContainerStyle={[styles.content, { paddingHorizontal: width < 390 ? 14 : 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxWidth}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hello}>Hello, Vera <Text style={styles.wave}>👋</Text></Text>
              <Text style={styles.title}>My Trips</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trip invitations"
                onPress={() => {
                  const invitation = invitationsQuery.data?.[0];
                  if (!invitation) return Alert.alert("Trip invitations", "No pending invitations right now.");
                  Alert.alert(invitation.tripName, `${invitation.invitedByName} invited you to ${invitation.destination}.`, [
                    { text: "Decline", style: "destructive", onPress: () => invitationMutation.mutate({ membershipId: invitation.membershipId, action: "reject" }) },
                    { text: "Accept", onPress: () => invitationMutation.mutate({ membershipId: invitation.membershipId, action: "accept" }) },
                  ]);
                }}
                style={({ pressed }) => [styles.roundHeaderButton, pressed && styles.pressed]}
              >
                <Text style={styles.headerGlyph}>♧</Text>
                {(invitationsQuery.data?.length ?? 0) > 0 ? <View style={styles.dot} /> : null}
              </Pressable>
              <Pressable onPress={() => router.push("/trip/create" as Href)} style={({ pressed }) => [styles.newTripShell, pressed && styles.pressed]}>
                <LinearGradient colors={["#FF668B", "#FF7A78"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newTrip}>
                  <Text style={styles.newTripText}>＋ New Trip</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <GlassCard style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search trips, destinations, flights..." placeholderTextColor="#9AA3B7" style={styles.searchInput} />
            <View style={styles.searchControl}><Text style={styles.filterGlyph}>☷</Text></View>
          </GlassCard>

          {featured ? (
            <>
              <NextFlightCard
                ticket={currentTicket}
                status={featured.status}
                liveStatus={liveFlight?.status ?? null}
                checking={liveLookup.isPending}
                onScan={() => setScannerOpen(true)}
                onCheck={() => liveLookup.mutate()}
                onPressTrip={() => router.push(`/trip/${featured.id}` as Href)}
              />

              <FeaturedTripCard trip={featured} onPress={() => router.push(`/trip/${featured.id}` as Href)} />

              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Quick Actions</Text><Text style={styles.sectionSubtitle}>Everything for your latest trip.</Text></View>
              </View>
              <View style={styles.quickWideRow}>
                {QUICK_ACTIONS.slice(0, 2).map((item) => (
                  <QuickActionCard
                    key={item.label}
                    item={item}
                    wide
                    onPress={() => router.push(`/trip/${featured.id}/${item.suffix}` as Href)}
                  />
                ))}
              </View>
              <View style={styles.quickSmallRow}>
                {QUICK_ACTIONS.slice(2).map((item) => (
                  <QuickActionCard
                    key={item.label}
                    item={item}
                    onPress={() => router.push(`/trip/${featured.id}/${item.suffix}` as Href)}
                  />
                ))}
              </View>
            </>
          ) : tripsQuery.isLoading ? (
            <GlassCard style={styles.loadingState}><ActivityIndicator color={TRAVA.purple} size="large" /><Text style={styles.stateText}>Loading your trips...</Text></GlassCard>
          ) : (
            <GlassCard style={styles.emptyState}><Text style={styles.emptyPlane}>✈</Text><Text style={styles.emptyTitle}>Your next trip starts here</Text><Text style={styles.emptyCopy}>Create a trip and TRAVA will organize your itinerary, budget, files, and travel group.</Text><Pressable onPress={() => router.push("/trip/create" as Href)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create a trip</Text></Pressable></GlassCard>
          )}

          <View style={styles.upcomingHeader}>
            <View><Text style={styles.sectionTitle}>Upcoming Trips</Text><Text style={styles.sectionSubtitle}>Open any trip to continue planning.</Text></View>
            <Pressable onPress={() => setSearch("")}><Text style={styles.seeAll}>See All ›</Text></Pressable>
          </View>
          <View style={styles.upcomingList}>
            {upcoming.map((trip) => <UpcomingTripRow key={trip.id} trip={trip} onPress={() => router.push(`/trip/${trip.id}` as Href)} />)}
          </View>
        </View>
      </ScrollView>

      {featured ? <TicketScannerModal visible={scannerOpen} tripId={featured.id} fallbackFlightNumber={featured.flightNumber} onClose={() => setScannerOpen(false)} onSaved={(next) => { setTicket(next); setLiveFlight(null); setScannerOpen(false); }} /> : null}
    </SafeAreaView>
  );
}

function QuickActionCard({ item, wide = false, onPress }: { item: (typeof QUICK_ACTIONS)[number]; wide?: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.label}`}
      onPress={onPress}
      style={({ pressed }) => [wide ? styles.quickWideCard : styles.quickSmallCard, pressed && styles.quickPressed]}
    >
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{item.label}</Text>
        <Text style={styles.quickSubtitle}>{item.subtitle}</Text>
      </View>
      <Soft3DIcon kind={item.kind} colors={item.colors} compact={!wide} />
    </Pressable>
  );
}

function Soft3DIcon({ kind, colors, compact = false }: { kind: QuickActionKind; colors: readonly [string, string]; compact?: boolean }) {
  const size = compact ? 56 : 64;
  return (
    <View style={[styles.softIconWrap, { width: size + 8, height: size + 8 }]}> 
      <View style={[styles.softIconDepth, { width: size, height: size, borderRadius: compact ? 18 : 20, backgroundColor: colors[1] }]} />
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0.08, y: 0.06 }}
        end={{ x: 0.94, y: 0.96 }}
        style={[styles.softIconFace, { width: size, height: size, borderRadius: compact ? 18 : 20 }]}
      >
        <View pointerEvents="none" style={styles.softIconHighlight} />
        <LineIcon kind={kind} compact={compact} />
      </LinearGradient>
    </View>
  );
}

function LineIcon({ kind, compact }: { kind: QuickActionKind; compact: boolean }) {
  const scale = compact ? 0.88 : 1;
  if (kind === "calendar") {
    return <View style={[styles.calendarIcon, { transform: [{ scale }] }]}><View style={styles.calendarTopLine} /><View style={[styles.calendarRing, { left: 7 }]} /><View style={[styles.calendarRing, { right: 7 }]} /><View style={styles.calendarDots}><View style={styles.calendarDot}/><View style={styles.calendarDot}/><View style={styles.calendarDot}/><View style={styles.calendarDot}/></View></View>;
  }
  if (kind === "wallet") {
    return <View style={[styles.walletIcon, { transform: [{ scale }] }]}><View style={styles.walletTopLine} /><View style={styles.walletPocket}><View style={styles.walletDot} /></View></View>;
  }
  if (kind === "receipt") {
    return <View style={[styles.receiptIcon, { transform: [{ scale }] }]}><View style={styles.receiptLineLong}/><View style={styles.receiptLineLong}/><View style={styles.receiptLineShort}/></View>;
  }
  if (kind === "checklist") {
    return <View style={[styles.checklistIcon, { transform: [{ scale }] }]}><View style={styles.checkRow}><Text style={styles.checkGlyph}>✓</Text><View style={styles.checkLine}/></View><View style={styles.checkRow}><Text style={styles.checkGlyph}>✓</Text><View style={styles.checkLine}/></View><View style={styles.checkRow}><Text style={styles.checkGlyph}>✓</Text><View style={styles.checkLine}/></View></View>;
  }
  return <View style={[styles.folderIcon, { transform: [{ scale }] }]}><View style={styles.folderTab}/><View style={styles.folderBody}/></View>;
}

function NextFlightCard({ ticket, status, liveStatus, checking, onScan, onCheck, onPressTrip }: { ticket: ScannedTicket; status: TripSummary["status"]; liveStatus: string | null; checking: boolean; onScan(): void; onCheck(): void; onPressTrip(): void }) {
  return (
    <GlassCard style={styles.ticketCard}>
      <LinearGradient colors={["rgba(255,241,241,.96)", "rgba(251,238,255,.94)", "rgba(239,240,255,.96)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={styles.ticketGlowA} /><View style={styles.ticketGlowB} />
      <View style={styles.ticketBadgeRow}>
        <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>✈  Next Flight</Text></View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>{liveStatus ? liveStatus.toUpperCase() : status === "ongoing" ? "EN-ROUTE" : "SCHEDULED"}</Text></View>
      </View>

      <Pressable onPress={onPressTrip} style={styles.ticketBody}>
        <View style={styles.ticketRoutePane}>
          <View style={styles.routeRow}>
            <View style={styles.airportBlock}>
              <Text style={styles.airportCode}>{ticket.originCode}</Text>
              <Text numberOfLines={1} style={styles.airportName}>{ticket.originName}</Text>
            </View>
            <View style={styles.routeLineWrap}>
              <View style={styles.routeLine} /><View style={styles.routePlane}><Text style={styles.routePlaneText}>✈</Text></View><View style={styles.routeLine} />
            </View>
            <View style={[styles.airportBlock, styles.airportRight]}>
              <Text style={styles.airportCode}>{ticket.destinationCode}</Text>
              <Text numberOfLines={1} style={styles.airportName}>{ticket.destinationName}</Text>
            </View>
          </View>

          <View style={styles.timeRow}>
            <View><Text style={styles.timeLabel}>DEPARTS</Text><Text style={styles.timeValue}>{ticket.departureTime}</Text><Text style={styles.timeDate}>{formatShortDate(ticket.date)}</Text></View>
            <View><Text style={styles.timeLabel}>ETA / ARRIVES</Text><Text style={styles.timeValue}>{ticket.arrivalTime}</Text><Text style={styles.timeDate}>Local time</Text></View>
          </View>
        </View>

        <View style={styles.stub}>
          <Text style={styles.stubLabel}>GATE</Text><Text style={styles.stubValue}>{ticket.gate || "—"}</Text>
          <Text style={styles.stubLabel}>FLIGHT</Text><Text style={styles.stubValue}>{ticket.flightNumber}</Text>
          <View style={styles.stubMiniRow}><View><Text style={styles.stubLabel}>TERM</Text><Text style={styles.stubValue}>{ticket.terminal || "—"}</Text></View><View><Text style={styles.stubLabel}>SEAT</Text><Text style={styles.stubValue}>{ticket.seat || "—"}</Text></View></View>
          <Barcode value={ticket.barcode} />
        </View>
      </Pressable>

      <View style={styles.ticketFooter}>
        <Pressable onPress={onScan} style={styles.scanInline}><View style={styles.scanIcon}><Text style={styles.scanIconText}>⌁</Text></View><Text style={styles.scanInlineText}>Scan or Upload Ticket</Text></Pressable>
        <Pressable disabled={checking} onPress={onCheck} style={({ pressed }) => [styles.checkFlight, pressed && styles.pressed, checking && styles.disabled]}>{checking ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.checkFlightText}>↻  Check flight</Text>}</Pressable>
      </View>
    </GlassCard>
  );
}

function Barcode({ value }: { value: string }) {
  const safe = value || "TRAVA";
  const bars = Array.from({ length: 30 }, (_, index) => ((safe.charCodeAt(index % safe.length) + index) % 4) + 1);
  return <View style={styles.barcode}>{bars.map((barWidth, index) => <View key={index} style={[styles.bar, { width: barWidth }]} />)}</View>;
}

function FeaturedTripCard({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const ready = trip.status === "completed" ? 100 : trip.status === "ongoing" ? 92 : 78;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featuredTrip, pressed && styles.pressed]}>
      <View style={styles.featuredThumb}>{trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject} /> : <LinearGradient colors={["#7863F8", "#F05DA5"]} style={StyleSheet.absoluteFillObject} />}</View>
      <View style={styles.featuredCopy}>
        <Text style={styles.featuredName}>{trip.name}</Text>
        <Text style={styles.featuredDestination}>{trip.destination}</Text>
        <View style={styles.featuredMetaRow}><View style={styles.metaDot} /><Text style={styles.featuredMeta}>{trip.memberCount} travelers</Text><View style={styles.metaDot} /><Text style={styles.featuredMeta}>{trip.numberOfDays} days</Text></View>
      </View>
      <ReadinessRing value={ready} />
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ReadinessRing({ value }: { value: number }) {
  return <View style={styles.readyOuter}><View style={styles.readyInner}><Text style={styles.readyValue}>{value}%</Text><Text style={styles.readyLabel}>Ready</Text></View></View>;
}

function UpcomingTripRow({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const days = daysUntil(trip.startDate);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.upcomingRow, pressed && styles.pressed]}>
      <View style={styles.upcomingImage}>{trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject} /> : <LinearGradient colors={["#7A65F8", "#F56AA5"]} style={StyleSheet.absoluteFillObject} />}</View>
      <View style={styles.upcomingCopy}><Text style={styles.upcomingName}>{trip.name}</Text><Text style={styles.upcomingDestination}>{trip.destination}</Text><Text style={styles.upcomingDate}>▣  {trip.startDate ? formatShortDate(trip.startDate) : "Dates not set"}</Text></View>
      <View style={styles.daysBadge}><Text style={styles.daysText}>{days === null ? trip.status : days <= 0 ? "Now" : `${days} days`}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function TicketScannerModal({ visible, tripId, fallbackFlightNumber, onClose, onSaved }: { visible: boolean; tripId: string; fallbackFlightNumber: string | null; onClose(): void; onSaved(ticket: ScannedTicket): void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ScannedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan(source: "camera" | "library") {
    setBusy(true); setError(null);
    try {
      const asset = await pickTicket(source);
      if (!asset) return;
      const imageUri = await compressTicketForWeb(asset);
      const parsed = mockParseTicket({ tripId, imageUri, fileName: asset.fileName, fallbackFlightNumber });
      setPreview(parsed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ticket scanning failed.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    try { await saveScannedTicket(preview); onSaved(preview); } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <GlassCard style={styles.scannerSheet}>
          <View style={styles.scannerHeader}>
            <View><Text style={styles.scannerTitle}>{preview ? "Ticket Scanned" : "Scan or Upload Ticket"}</Text><Text style={styles.scannerSub}>{preview ? "Review the extracted details before saving." : "Take a photo or upload your ticket. TRAVA compresses the image before local storage."}</Text></View>
            <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          {preview ? (
            <View style={styles.scanResult}>
              <Text style={styles.scanRoute}>✈  {preview.originCode} → {preview.destinationCode}</Text>
              <View style={styles.scanGrid}><ScanField label="Flight" value={preview.flightNumber} /><ScanField label="Departure" value={preview.departureTime} /><ScanField label="Arrival" value={preview.arrivalTime} /><ScanField label="Gate" value={preview.gate} /><ScanField label="Terminal" value={preview.terminal} /><ScanField label="Seat" value={preview.seat} /></View>
              <Barcode value={preview.barcode} />
              <View style={styles.scanActions}><Pressable onPress={() => setPreview(null)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Retake</Text></Pressable><Pressable disabled={busy} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryText}>{busy ? "Saving…" : "Save to Trip"}</Text></Pressable></View>
            </View>
          ) : (
            <>
              <View style={styles.scanSourceRow}>
                <Pressable disabled={busy} onPress={() => void scan("camera")} style={styles.scanSource}><Text style={styles.scanSourceGlyph}>⌾</Text><Text style={styles.scanSourceText}>Camera</Text></Pressable>
                <Pressable disabled={busy} onPress={() => void scan("library")} style={styles.scanSource}><Text style={styles.scanSourceGlyph}>▱</Text><Text style={styles.scanSourceText}>Upload</Text></Pressable>
              </View>
              <View style={styles.dropZone}>{busy ? <ActivityIndicator color={TRAVA.purple} /> : <><Text style={styles.cameraGlyph}>▣</Text><Text style={styles.dropTitle}>Ready for your ticket</Text><Text style={styles.dropText}>Web uploads downscale to max 1200px and compress to about 70% JPEG quality.</Text></>}</View>
            </>
          )}
          {error ? <Text style={styles.scanError}>{error}</Text> : null}
        </GlassCard>
      </View>
    </Modal>
  );
}

function ScanField({ label, value }: { label: string; value: string }) { return <View style={styles.scanField}><Text style={styles.scanFieldLabel}>{label}</Text><Text style={styles.scanFieldValue}>{value || "—"}</Text></View>; }
function chooseFeaturedTrip(trips: TripSummary[]) { return [...trips].sort(sortTrips)[0] ?? null; }
function sortTrips(a: TripSummary, b: TripSummary) { const ax = a.startDate ? new Date(`${a.startDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER; const bx = b.startDate ? new Date(`${b.startDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER; return ax - bx; }
function deriveTicketFromTrip(trip: TripSummary | null | undefined): ScannedTicket { const date = trip?.flightDate ?? trip?.startDate ?? new Date().toISOString().slice(0, 10); return { tripId: trip?.id ?? "preview", imageUri: "", flightNumber: trip?.flightNumber ?? "PR2334", originCode: "BXU", destinationCode: "CEB", originName: "Bancasi Airport", destinationName: "Mactan–Cebu International Airport", departureTime: "5:17 PM", arrivalTime: "6:06 PM", date, gate: "—", terminal: "1", seat: "—", barcode: `${trip?.flightNumber ?? "PR2334"}-${date}`, scannedAt: new Date().toISOString() }; }
function mergeLiveTicket(ticket: ScannedTicket, live: FlightStatus | null): ScannedTicket { if (!live) return ticket; return { ...ticket, flightNumber: live.flightNumber || ticket.flightNumber, originCode: live.departure.airportCode ?? ticket.originCode, destinationCode: live.arrival.airportCode ?? ticket.destinationCode, originName: live.departure.airportName ?? ticket.originName, destinationName: live.arrival.airportName ?? ticket.destinationName, departureTime: displayTime(live.departure.estimatedTime ?? live.departure.scheduledTime) ?? ticket.departureTime, arrivalTime: displayTime(live.arrival.estimatedTime ?? live.arrival.scheduledTime) ?? ticket.arrivalTime, gate: live.departure.gate ?? ticket.gate, terminal: live.departure.terminal ?? ticket.terminal }; }
function displayTime(value: string | null) { if (!value) return null; const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) return value; return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function daysUntil(value: string | null) { if (!value) return null; const now = new Date(); const target = new Date(`${value}T00:00:00`); return Math.ceil((target.getTime() - now.getTime()) / 86400000); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingTop: 10, paddingBottom: 132 },
  maxWidth: { width: "100%", maxWidth: 720, alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 2 },
  hello: { color: "#6E718A", fontSize: 11, lineHeight: 15, fontWeight: "700" },
  wave: { color: "#E9A935" },
  title: { marginTop: 3, color: TRAVA.ink, fontSize: 39, lineHeight: 43, fontWeight: "900", letterSpacing: -1.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  roundHeaderButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5", boxShadow: "0 8px 20px rgba(41,47,70,.06)" },
  headerGlyph: { color: TRAVA.ink, fontSize: 19, fontWeight: "800" },
  dot: { position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5C87", borderWidth: 1.5, borderColor: "#FFF" },
  newTripShell: { borderRadius: 17, boxShadow: "0 12px 26px rgba(245,94,132,.24)" },
  newTrip: { minHeight: 46, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  newTripText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  pressed: { opacity: .82, transform: [{ scale: .985 }] },
  disabled: { opacity: .62 },

  searchBox: { marginTop: 14, height: 54, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, backgroundColor: "#FFFFFF", borderColor: "#ECEEF5", boxShadow: "0 8px 22px rgba(41,47,70,.05)" },
  searchGlyph: { color: "#8994AA", fontSize: 19 },
  searchInput: { flex: 1, height: "100%", paddingHorizontal: 10, color: TRAVA.ink, fontSize: 11, fontWeight: "700" },
  searchControl: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,247,251,.9)" },
  filterGlyph: { color: "#7B879D", fontSize: 16 },

  ticketCard: { marginTop: 16, borderRadius: 30, overflow: "hidden", padding: 0 },
  ticketGlowA: { position: "absolute", width: 170, height: 170, borderRadius: 85, top: -75, left: 70, backgroundColor: "rgba(255,255,255,.45)" },
  ticketGlowB: { position: "absolute", width: 210, height: 210, borderRadius: 105, right: -75, bottom: -110, backgroundColor: "rgba(139,92,246,.08)" },
  ticketBadgeRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 },
  nextBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(218,255,238,.94)" },
  nextBadgeText: { color: "#14865C", fontSize: 8, fontWeight: "900" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(239,235,255,.94)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7657F5" },
  liveBadgeText: { color: "#6C54D8", fontSize: 8, fontWeight: "900" },
  ticketBody: { minHeight: 196, flexDirection: "row", paddingLeft: 16, paddingTop: 4 },
  ticketRoutePane: { flex: 1, minWidth: 0, paddingRight: 14, paddingBottom: 15 },
  routeRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  airportBlock: { flex: 1, minWidth: 0 },
  airportRight: { alignItems: "flex-end" },
  airportCode: { color: TRAVA.ink, fontSize: 39, lineHeight: 42, fontWeight: "900", letterSpacing: -1.6 },
  airportName: { marginTop: 4, color: "#737E95", fontSize: 8.5, lineHeight: 12, fontWeight: "700" },
  routeLineWrap: { width: 120, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
  routeLine: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: "rgba(123,91,246,.46)" },
  routePlane: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.86)", boxShadow: "0 6px 14px rgba(112,85,236,.12)" },
  routePlaneText: { color: "#7B60F6", fontSize: 14 },
  timeRow: { flexDirection: "row", gap: 34, paddingBottom: 2 },
  timeLabel: { color: "#9A93AA", fontSize: 6.5, letterSpacing: .8, fontWeight: "900" },
  timeValue: { marginTop: 3, color: TRAVA.ink, fontSize: 14, fontWeight: "900" },
  timeDate: { marginTop: 3, color: "#8C94A7", fontSize: 7.5, fontWeight: "600" },
  stub: { width: 105, alignSelf: "stretch", paddingHorizontal: 12, paddingTop: 6, borderLeftWidth: 1, borderStyle: "dashed", borderColor: "rgba(189,181,211,.7)", backgroundColor: "rgba(255,255,255,.23)" },
  stubLabel: { marginTop: 5, color: "#968EA4", fontSize: 6, letterSpacing: .8, fontWeight: "900" },
  stubValue: { marginTop: 2, color: TRAVA.ink, fontSize: 9.5, fontWeight: "900" },
  stubMiniRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  barcode: { height: 30, flexDirection: "row", alignItems: "stretch", gap: 1, marginTop: 10, overflow: "hidden" },
  bar: { backgroundColor: "#20283B" },
  ticketFooter: { flexDirection: "row", alignItems: "center", gap: 9, padding: 10, borderTopWidth: 1, borderColor: "rgba(223,220,233,.84)", backgroundColor: "rgba(255,255,255,.66)" },
  scanInline: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: "rgba(247,247,251,.88)" },
  scanIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#EEE9FF" },
  scanIconText: { color: TRAVA.purple, fontSize: 14, fontWeight: "900" },
  scanInlineText: { color: "#6A57D8", fontSize: 8.5, fontWeight: "900" },
  checkFlight: { minWidth: 108, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#11172B" },
  checkFlightText: { color: "#FFF", fontSize: 8.5, fontWeight: "900" },

  featuredTrip: { marginTop: 12, minHeight: 92, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8EAF1", boxShadow: "0 10px 28px rgba(41,47,70,.06)" },
  featuredThumb: { width: 82, height: 72, overflow: "hidden", borderRadius: 18 },
  featuredCopy: { flex: 1, minWidth: 0 },
  featuredName: { color: TRAVA.ink, fontSize: 15, fontWeight: "900" },
  featuredDestination: { marginTop: 2, color: "#717C93", fontSize: 9, fontWeight: "600" },
  featuredMetaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#A897E9" },
  featuredMeta: { color: "#8B94A6", fontSize: 7.5, fontWeight: "700" },
  readyOuter: { width: 50, height: 50, borderRadius: 25, padding: 4, backgroundColor: "#5FD3AE", boxShadow: "0 6px 14px rgba(67,191,151,.18)" },
  readyInner: { flex: 1, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FFFC" },
  readyValue: { color: "#173D36", fontSize: 9.5, fontWeight: "900" },
  readyLabel: { marginTop: -1, color: "#5B8B7B", fontSize: 5.5, fontWeight: "800" },
  chevron: { color: "#202B45", fontSize: 22 },

  sectionHeader: { marginTop: 20 },
  sectionTitle: { color: TRAVA.ink, fontSize: 22, fontWeight: "900", letterSpacing: -.45 },
  sectionSubtitle: { marginTop: 3, color: "#8B94A8", fontSize: 9, fontWeight: "600" },
  quickWideRow: { marginTop: 14, flexDirection: "row", gap: 12 },
  quickSmallRow: { marginTop: 12, flexDirection: "row", gap: 12 },
  quickWideCard: { flex: 1, minWidth: 0, minHeight: 126, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E8EF", boxShadow: "0 10px 24px rgba(41,47,70,.055)" },
  quickSmallCard: { flex: 1, minWidth: 0, minHeight: 116, paddingHorizontal: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E8EF", boxShadow: "0 10px 24px rgba(41,47,70,.05)" },
  quickPressed: { opacity: .88, transform: [{ scale: .985 }] },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: TRAVA.ink, fontSize: 13, fontWeight: "900" },
  quickSubtitle: { marginTop: 6, color: "#8A93A6", fontSize: 9, lineHeight: 12, fontWeight: "600" },
  softIconWrap: { alignItems: "center", justifyContent: "center" },
  softIconDepth: { position: "absolute", right: 1, bottom: 0, opacity: .28, transform: [{ rotate: "-4deg" }] },
  softIconFace: { alignItems: "center", justifyContent: "center", overflow: "hidden", transform: [{ rotate: "-3deg" }], borderWidth: 1, borderColor: "rgba(255,255,255,.78)", boxShadow: "0 9px 18px rgba(87,75,131,.16)" },
  softIconHighlight: { position: "absolute", width: 44, height: 20, borderRadius: 22, top: -5, left: 8, backgroundColor: "rgba(255,255,255,.28)", transform: [{ rotate: "-12deg" }] },
  calendarIcon: { width: 31, height: 29, borderRadius: 5, borderWidth: 2.2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "flex-end", paddingBottom: 5 },
  calendarTopLine: { position: "absolute", top: 7, left: 0, right: 0, height: 2, backgroundColor: "#FFFFFF" },
  calendarRing: { position: "absolute", top: -5, width: 3, height: 8, borderRadius: 2, backgroundColor: "#FFFFFF" },
  calendarDots: { width: 17, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  calendarDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#FFFFFF" },
  walletIcon: { width: 33, height: 25, borderRadius: 6, borderWidth: 2.2, borderColor: "#FFFFFF" },
  walletTopLine: { position: "absolute", top: 7, left: 4, right: 4, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,.92)" },
  walletPocket: { position: "absolute", right: -2, top: 9, width: 15, height: 10, borderRadius: 4, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center" },
  walletDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#FFFFFF" },
  receiptIcon: { width: 25, height: 32, borderRadius: 4, borderWidth: 2.2, borderColor: "#FFFFFF", paddingHorizontal: 5, paddingTop: 7, gap: 4 },
  receiptLineLong: { width: "100%", height: 2, borderRadius: 1, backgroundColor: "#FFFFFF" },
  receiptLineShort: { width: "65%", height: 2, borderRadius: 1, backgroundColor: "#FFFFFF" },
  checklistIcon: { width: 33, gap: 3 },
  checkRow: { height: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  checkGlyph: { width: 8, color: "#FFFFFF", fontSize: 9, lineHeight: 10, fontWeight: "900" },
  checkLine: { flex: 1, height: 2.2, borderRadius: 2, backgroundColor: "#FFFFFF" },
  folderIcon: { width: 34, height: 27 },
  folderTab: { position: "absolute", top: 1, left: 3, width: 14, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 2.2, borderBottomWidth: 0, borderColor: "#FFFFFF" },
  folderBody: { position: "absolute", left: 1, right: 1, bottom: 1, height: 22, borderRadius: 5, borderWidth: 2.2, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,.04)" },

  upcomingHeader: { marginTop: 20, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  seeAll: { color: TRAVA.purple, fontSize: 9, fontWeight: "900" },
  upcomingList: { marginTop: 9, gap: 8 },
  upcomingRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8EAF1", boxShadow: "0 8px 20px rgba(41,47,70,.045)" },
  upcomingImage: { width: 74, height: 58, overflow: "hidden", borderRadius: 15 },
  upcomingCopy: { flex: 1, minWidth: 0 },
  upcomingName: { color: TRAVA.ink, fontSize: 10.5, fontWeight: "900" },
  upcomingDestination: { marginTop: 2, color: "#7C879A", fontSize: 8, fontWeight: "600" },
  upcomingDate: { marginTop: 5, color: "#98A0B0", fontSize: 7, fontWeight: "600" },
  daysBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#EDF5FF" },
  daysText: { color: "#6280B5", fontSize: 7.5, fontWeight: "900" },

  loadingState: { marginTop: 18, alignItems: "center", padding: 38, borderRadius: 28 },
  stateText: { marginTop: 10, color: "#778399", fontSize: 11, fontWeight: "700" },
  emptyState: { marginTop: 18, alignItems: "center", padding: 32, borderRadius: 28 },
  emptyPlane: { fontSize: 42 },
  emptyTitle: { marginTop: 8, color: TRAVA.ink, fontSize: 17, fontWeight: "900" },
  emptyCopy: { marginTop: 6, maxWidth: 320, textAlign: "center", color: "#7D879A", fontSize: 10, lineHeight: 16, fontWeight: "600" },
  emptyButton: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 15, backgroundColor: TRAVA.purple },
  emptyButtonText: { color: "#FFF", fontSize: 10, fontWeight: "900" },

  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(18,18,35,.52)" },
  scannerSheet: { width: "100%", maxWidth: 460, borderRadius: 30, padding: 20 },
  scannerHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  scannerTitle: { color: TRAVA.ink, fontSize: 20, fontWeight: "900" },
  scannerSub: { marginTop: 4, maxWidth: 320, color: "#7B869A", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "rgba(243,244,248,.92)" },
  closeText: { color: TRAVA.ink, fontSize: 20 },
  scanSourceRow: { marginTop: 18, flexDirection: "row", gap: 9 },
  scanSource: { flex: 1, minHeight: 80, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#F2EDFF", borderWidth: 1, borderColor: "#E5DAFF" },
  scanSourceGlyph: { color: TRAVA.purple, fontSize: 24, fontWeight: "900" },
  scanSourceText: { marginTop: 4, color: TRAVA.ink, fontSize: 10, fontWeight: "900" },
  dropZone: { marginTop: 12, minHeight: 150, alignItems: "center", justifyContent: "center", padding: 22, borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "#CDC4F5", backgroundColor: "rgba(250,249,255,.94)" },
  cameraGlyph: { color: TRAVA.purple, fontSize: 33 },
  dropTitle: { marginTop: 8, color: TRAVA.ink, fontSize: 13, fontWeight: "900" },
  dropText: { marginTop: 5, maxWidth: 300, textAlign: "center", color: "#7E889B", fontSize: 9, lineHeight: 14, fontWeight: "600" },
  scanError: { marginTop: 10, color: "#C83B4A", fontSize: 9, fontWeight: "700" },
  scanResult: { marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: "rgba(250,249,255,.96)", borderWidth: 1, borderColor: "#ECE7FF" },
  scanRoute: { color: TRAVA.ink, fontSize: 24, fontWeight: "900" },
  scanGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scanField: { width: "30%", flexGrow: 1, padding: 10, borderRadius: 13, backgroundColor: "#FFF" },
  scanFieldLabel: { color: "#8A94A7", fontSize: 7, fontWeight: "900" },
  scanFieldValue: { marginTop: 4, color: TRAVA.ink, fontSize: 11, fontWeight: "900" },
  scanActions: { marginTop: 16, flexDirection: "row", gap: 9 },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#EFF1F5" },
  secondaryText: { color: "#5D6880", fontSize: 10, fontWeight: "900" },
  primaryButton: { flex: 1.4, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: TRAVA.purple },
  primaryText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
});
