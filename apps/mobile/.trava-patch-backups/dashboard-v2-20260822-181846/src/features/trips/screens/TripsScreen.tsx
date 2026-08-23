import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripSummary } from "@trava/shared";
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

import { fetchTrip, listTripInvitations, listTrips, respondToTripInvitation } from "../api/trips.api";
import { GlassCard, GradientPill, TRAVA, formatShortDate } from "../components/TravaUI";
import {
  compressTicketForWeb,
  loadScannedTicket,
  mockParseTicket,
  pickTicket,
  saveScannedTicket,
  type ScannedTicket,
} from "../utils/ticket-scanner";

const QUICK_ACTIONS = [
  ["Itinerary", "View your plans", "itinerary", "▦", "#FF6F91"],
  ["Budget", "Track your budget", "budget", "▣", "#55CDA0"],
  ["Expenses", "Add & manage", "expenses", "▤", "#FF9A56"],
  ["Checklist", "Stay organized", "checklist", "✓", "#A978FF"],
  ["Documents", "Travel docs", "documents", "▱", "#6FB7FF"],
] as const;

export function TripsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ticket, setTicket] = useState<ScannedTicket | null>(null);

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
  const selected = useMemo(() => chooseFeaturedTrip(trips), [trips]);
  const selectedDetails = useQuery({
    queryKey: ["trip", selected?.id, "dashboard"],
    queryFn: () => fetchTrip(selected!.id),
    enabled: Boolean(selected?.id),
  });

  useEffect(() => {
    if (!selected?.id) { setTicket(null); return; }
    void loadScannedTicket(selected.id).then(setTicket);
  }, [selected?.id]);

  const upcoming = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips
      .filter((trip) => trip.id !== selected?.id)
      .filter((trip) => !q || [trip.name, trip.destination, trip.flightNumber].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)))
      .sort(sortTrips)
      .slice(0, 5);
  }, [search, selected?.id, trips]);

  const currentTicket = ticket ?? deriveTicketFromTrip(selected, selectedDetails.data?.flightNumber ?? null);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#FFF7F8", "#F9F7FF", "#F7FAFF"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={tripsQuery.isRefetching} onRefresh={() => void Promise.all([tripsQuery.refetch(), invitationsQuery.refetch()])} tintColor={TRAVA.purple} />}
        contentContainerStyle={[styles.content, { paddingHorizontal: width < 390 ? 14 : 20 }]}
      >
        <View style={styles.maxWidth}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hello}>Hello, Vera 👋</Text>
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
                style={styles.bell}
              >
                <Text style={styles.bellGlyph}>♧</Text>
                {(invitationsQuery.data?.length ?? 0) > 0 ? <View style={styles.dot} /> : null}
              </Pressable>
              <Pressable onPress={() => router.push("/trip/create" as Href)} style={({ pressed }) => [styles.newTrip, pressed && styles.pressed]}>
                <Text style={styles.newTripText}>＋ New Trip</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search trips, destinations, flights..." placeholderTextColor="#9CA4B7" style={styles.searchInput} />
            <Text style={styles.filterGlyph}>☷</Text>
          </View>

          {selected ? (
            <>
              <BoardingPass ticket={currentTicket} status={selected.status} onScan={() => setScannerOpen(true)} onPressTrip={() => router.push(`/trip/${selected.id}` as Href)} />
              <SelectedTripCard trip={selected} onPress={() => router.push(`/trip/${selected.id}` as Href)} />

              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Quick Actions</Text><Text style={styles.sectionSubtitle}>Everything for your latest trip.</Text></View>
              </View>
              <View style={styles.quickGrid}>
                {QUICK_ACTIONS.map(([label, subtitle, suffix, glyph, accent], index) => (
                  <Pressable key={label} onPress={() => router.push(`/trip/${selected.id}/${suffix}` as Href)} style={({ pressed }) => [styles.quickCard, index < 2 && styles.quickWide, pressed && styles.pressed]}>
                    <View style={styles.quickCopy}><Text style={styles.quickTitle}>{label}</Text><Text style={styles.quickSubtitle}>{subtitle}</Text></View>
                    <LinearGradient colors={[`${accent}B8`, `${accent}FF`]} style={styles.quickIcon}><Text style={styles.quickGlyph}>{glyph}</Text></LinearGradient>
                  </Pressable>
                ))}
                <Pressable onPress={() => setScannerOpen(true)} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
                  <View style={styles.quickCopy}><Text style={styles.quickTitle}>Scan Ticket</Text><Text style={styles.quickSubtitle}>Camera or upload</Text></View>
                  <LinearGradient colors={["#D46BFF", "#8A6CFF"]} style={styles.quickIcon}><Text style={styles.quickGlyph}>⌁</Text></LinearGradient>
                </Pressable>
              </View>
            </>
          ) : tripsQuery.isLoading ? (
            <View style={styles.loadingState}><ActivityIndicator color={TRAVA.purple} size="large" /><Text style={styles.stateText}>Loading your trips...</Text></View>
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyPlane}>✈</Text><Text style={styles.emptyTitle}>Your next trip starts here</Text><Pressable onPress={() => router.push("/trip/create" as Href)} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create a trip</Text></Pressable></View>
          )}

          <View style={styles.upcomingHeader}><View><Text style={styles.sectionTitle}>Upcoming Trips</Text><Text style={styles.sectionSubtitle}>Open any trip to continue planning.</Text></View><Text style={styles.seeAll}>See All ›</Text></View>
          <View style={styles.upcomingList}>
            {upcoming.map((trip) => <UpcomingTripRow key={trip.id} trip={trip} onPress={() => router.push(`/trip/${trip.id}` as Href)} />)}
          </View>
        </View>
      </ScrollView>

      {selected ? <TicketScannerModal visible={scannerOpen} tripId={selected.id} fallbackFlightNumber={selected.flightNumber} onClose={() => setScannerOpen(false)} onSaved={(next) => { setTicket(next); setScannerOpen(false); }} /> : null}
    </SafeAreaView>
  );
}

function BoardingPass({ ticket, status, onScan, onPressTrip }: { ticket: ScannedTicket; status: TripSummary["status"]; onScan(): void; onPressTrip(): void }) {
  return (
    <GlassCard style={styles.ticket}>
      <LinearGradient colors={["#FFF2F4", "#F8F0FF", "#F5F4FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={styles.ticketTop}>
        <View style={styles.ticketBadge}><Text style={styles.ticketBadgeText}>✈ Next Trip</Text></View>
        <View style={styles.statusBadge}><Text style={styles.statusText}>● {status === "ongoing" ? "En-Route" : "Scheduled"}</Text></View>
      </View>
      <Pressable onPress={onPressTrip} style={styles.ticketMain}>
        <View style={styles.airport}><Text style={styles.airportCode}>{ticket.originCode}</Text><Text numberOfLines={1} style={styles.airportName}>{ticket.originName}</Text></View>
        <View style={styles.flightLine}><View style={styles.dash} /><Text style={styles.plane}>✈</Text><View style={styles.dash} /></View>
        <View style={[styles.airport, styles.airportRight]}><Text style={styles.airportCode}>{ticket.destinationCode}</Text><Text numberOfLines={1} style={styles.airportName}>{ticket.destinationName}</Text></View>
        <View style={styles.stub}>
          <Text style={styles.stubLabel}>GATE</Text><Text style={styles.stubValue}>{ticket.gate}</Text>
          <Text style={styles.stubLabel}>FLIGHT</Text><Text style={styles.stubValue}>{ticket.flightNumber}</Text>
          <View style={styles.stubRow}><View><Text style={styles.stubLabel}>TERMINAL</Text><Text style={styles.stubValue}>{ticket.terminal}</Text></View><View><Text style={styles.stubLabel}>SEAT</Text><Text style={styles.stubValue}>{ticket.seat}</Text></View></View>
          <Barcode value={ticket.barcode} />
        </View>
      </Pressable>
      <View style={styles.ticketTimeRow}>
        <View><Text style={styles.timeLabel}>DEPARTS</Text><Text style={styles.timeValue}>{ticket.departureTime}</Text><Text style={styles.timeDate}>{formatShortDate(ticket.date)} · Local time</Text></View>
        <View><Text style={styles.timeLabel}>ETA / ARRIVES</Text><Text style={styles.timeValue}>{ticket.arrivalTime}</Text><Text style={styles.timeDate}>Local time</Text></View>
      </View>
      <View style={styles.ticketFooter}>
        <Pressable onPress={onScan} style={styles.flightNumberPill}><Text style={styles.flightNumberText}>✈ {ticket.flightNumber}</Text><Text style={styles.rescan}>Scan or Upload Ticket</Text></Pressable>
        <Pressable onPress={onPressTrip} style={styles.checkFlight}><Text style={styles.checkFlightText}>◔ Check flight</Text></Pressable>
      </View>
    </GlassCard>
  );
}

function Barcode({ value }: { value: string }) {
  const bars = Array.from({ length: 34 }, (_, index) => ((value.charCodeAt(index % value.length) + index) % 4) + 1);
  return <View style={styles.barcode}>{bars.map((width, index) => <View key={index} style={[styles.bar, { width }]} />)}</View>;
}

function SelectedTripCard({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const ready = trip.status === "completed" ? 100 : trip.status === "ongoing" ? 92 : 78;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.selectedTrip, pressed && styles.pressed]}>
      <View style={styles.tripThumb}>{trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject} /> : <LinearGradient colors={["#7C3AED", "#EC4899"]} style={StyleSheet.absoluteFillObject} />}</View>
      <View style={styles.selectedCopy}><Text style={styles.selectedName}>{trip.name}</Text><Text style={styles.selectedDestination}>{trip.destination}</Text><Text style={styles.selectedMeta}>{trip.memberCount} travelers · {trip.numberOfDays} days</Text></View>
      <View style={styles.readiness}><Text style={styles.readinessValue}>{ready}%</Text><Text style={styles.readinessLabel}>Ready</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function UpcomingTripRow({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const days = daysUntil(trip.startDate);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.upcomingRow, pressed && styles.pressed]}>
      <View style={styles.upcomingImage}>{trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject} /> : <LinearGradient colors={["#5B8CFF", "#D46BFF"]} style={StyleSheet.absoluteFillObject} />}</View>
      <View style={styles.upcomingCopy}><Text style={styles.upcomingName}>{trip.name}</Text><Text style={styles.upcomingDestination}>{trip.destination}</Text><Text style={styles.upcomingDate}>▣ {trip.startDate ? formatShortDate(trip.startDate) : "Dates not set"}</Text></View>
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
        <View style={styles.scannerSheet}>
          <View style={styles.scannerHeader}><View><Text style={styles.scannerTitle}>{preview ? "Ticket Scanned" : "Scan or Upload Ticket"}</Text><Text style={styles.scannerSub}>{preview ? "Review the extracted details before saving." : "Camera and uploaded images are compressed before local storage."}</Text></View><Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>
          {preview ? (
            <View style={styles.scanResult}>
              <Text style={styles.scanRoute}>✈ {preview.originCode} → {preview.destinationCode}</Text>
              <View style={styles.scanGrid}><ScanField label="Flight" value={preview.flightNumber} /><ScanField label="Departure" value={preview.departureTime} /><ScanField label="Arrival" value={preview.arrivalTime} /><ScanField label="Gate" value={preview.gate} /><ScanField label="Terminal" value={preview.terminal} /><ScanField label="Seat" value={preview.seat} /></View>
              <Barcode value={preview.barcode} />
              <View style={styles.scanActions}><Pressable onPress={() => setPreview(null)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Retake</Text></Pressable><Pressable disabled={busy} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryText}>{busy ? "Saving…" : "Save to Trip"}</Text></Pressable></View>
            </View>
          ) : (
            <>
              <View style={styles.scanSourceRow}><Pressable disabled={busy} onPress={() => void scan("camera")} style={styles.scanSource}><Text style={styles.scanSourceGlyph}>⌾</Text><Text style={styles.scanSourceText}>Camera</Text></Pressable><Pressable disabled={busy} onPress={() => void scan("library")} style={styles.scanSource}><Text style={styles.scanSourceGlyph}>▱</Text><Text style={styles.scanSourceText}>Upload</Text></Pressable></View>
              <View style={styles.dropZone}>{busy ? <ActivityIndicator color={TRAVA.purple} /> : <><Text style={styles.cameraGlyph}>▣</Text><Text style={styles.dropTitle}>Tap a source above</Text><Text style={styles.dropText}>Web uploads downscale to max 1200px and compress to ~70% JPEG quality.</Text></>}</View>
            </>
          )}
          {error ? <Text style={styles.scanError}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

function ScanField({ label, value }: { label: string; value: string }) { return <View style={styles.scanField}><Text style={styles.scanFieldLabel}>{label}</Text><Text style={styles.scanFieldValue}>{value}</Text></View>; }
function chooseFeaturedTrip(trips: TripSummary[]) { return [...trips].sort(sortTrips)[0] ?? null; }
function sortTrips(a: TripSummary, b: TripSummary) { const ax = a.startDate ? new Date(`${a.startDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER; const bx = b.startDate ? new Date(`${b.startDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER; return ax - bx; }
function deriveTicketFromTrip(trip: TripSummary | null | undefined, flightNumber: string | null): ScannedTicket { const date = trip?.flightDate ?? trip?.startDate ?? new Date().toISOString().slice(0, 10); return { tripId: trip?.id ?? "preview", imageUri: "", flightNumber: flightNumber ?? trip?.flightNumber ?? "PR2334", originCode: "BXU", destinationCode: "CEB", originName: "Bancasi Airport", destinationName: "Mactan–Cebu International Airport", departureTime: "5:17 PM", arrivalTime: "6:06 PM", date, gate: "—", terminal: "1", seat: "—", barcode: `${flightNumber ?? trip?.flightNumber ?? "PR2334"}-${date}`, scannedAt: new Date().toISOString() }; }
function daysUntil(value: string | null) { if (!value) return null; const now = new Date(); const target = new Date(`${value}T00:00:00`); return Math.ceil((target.getTime() - now.getTime()) / 86400000); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF9FB" }, content: { paddingTop: 12, paddingBottom: 130 }, maxWidth: { width: "100%", maxWidth: 760, alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, hello: { color: "#655F77", fontSize: 11, fontWeight: "700" }, title: { marginTop: 2, color: TRAVA.ink, fontSize: 38, lineHeight: 42, fontWeight: "900", letterSpacing: -1.3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "rgba(255,255,255,.82)", borderWidth: 1, borderColor: "rgba(235,236,244,.9)" }, bellGlyph: { color: TRAVA.ink, fontSize: 19 }, dot: { position: "absolute", right: 8, top: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF5C8A" }, newTrip: { minHeight: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#FF6385", boxShadow: "0 8px 18px rgba(255,99,133,.22)" }, newTripText: { color: "#FFF", fontSize: 11, fontWeight: "900" }, pressed: { opacity: .8, transform: [{ scale: .985 }] },
  searchBox: { marginTop: 14, height: 50, flexDirection: "row", alignItems: "center", borderRadius: 17, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,.88)", borderWidth: 1, borderColor: "rgba(232,234,241,.96)", boxShadow: "0 8px 20px rgba(96,89,125,.06)" }, searchGlyph: { color: "#8090A8", fontSize: 18 }, searchInput: { flex: 1, height: "100%", paddingHorizontal: 9, color: TRAVA.ink, fontSize: 11, fontWeight: "700" }, filterGlyph: { color: "#8B95A8", fontSize: 17 },
  ticket: { marginTop: 14, overflow: "hidden", borderRadius: 25, padding: 0 }, ticketTop: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10 }, ticketBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#E9FFF3" }, ticketBadgeText: { color: "#1B9565", fontSize: 9, fontWeight: "900" }, statusBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#EFECFF" }, statusText: { color: "#7055EC", fontSize: 9, fontWeight: "900" },
  ticketMain: { minHeight: 150, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 }, airport: { width: "30%" }, airportRight: { alignItems: "flex-end" }, airportCode: { color: TRAVA.ink, fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1 }, airportName: { marginTop: 4, color: "#707B90", fontSize: 9, lineHeight: 12, fontWeight: "600" }, flightLine: { flex: 1, minWidth: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 }, dash: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#BCAEFF" }, plane: { color: "#8168F6", fontSize: 17 }, stub: { width: 100, alignSelf: "stretch", marginLeft: 12, paddingLeft: 12, paddingTop: 4, borderLeftWidth: 1, borderStyle: "dashed", borderColor: "#E2DFF0" }, stubLabel: { marginTop: 5, color: "#8C94A7", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, stubValue: { marginTop: 2, color: TRAVA.ink, fontSize: 10, fontWeight: "900" }, stubRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  ticketTimeRow: { flexDirection: "row", gap: 30, paddingHorizontal: 16, paddingBottom: 12 }, timeLabel: { color: "#8E96A9", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, timeValue: { marginTop: 3, color: TRAVA.ink, fontSize: 14, fontWeight: "900" }, timeDate: { marginTop: 3, color: "#8B94A5", fontSize: 8, fontWeight: "600" }, barcode: { height: 28, flexDirection: "row", alignItems: "stretch", gap: 1, marginTop: 8, overflow: "hidden" }, bar: { backgroundColor: "#20283A" }, ticketFooter: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 1, borderColor: "rgba(225,225,236,.9)", backgroundColor: "rgba(255,255,255,.72)" }, flightNumberPill: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F3F4F8" }, flightNumberText: { color: "#536078", fontSize: 9, fontWeight: "900" }, rescan: { color: TRAVA.purple, fontSize: 8, fontWeight: "900" }, checkFlight: { minHeight: 38, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#171C2F" }, checkFlightText: { color: "#FFF", fontSize: 9, fontWeight: "900" },
  selectedTrip: { marginTop: 11, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderRadius: 18, backgroundColor: "rgba(255,255,255,.9)", borderWidth: 1, borderColor: "#ECEEF3", boxShadow: "0 8px 20px rgba(80,76,105,.06)" }, tripThumb: { width: 62, height: 55, overflow: "hidden", borderRadius: 13 }, selectedCopy: { flex: 1, minWidth: 0 }, selectedName: { color: TRAVA.ink, fontSize: 12, fontWeight: "900" }, selectedDestination: { marginTop: 2, color: "#778296", fontSize: 9, fontWeight: "600" }, selectedMeta: { marginTop: 5, color: "#8B94A5", fontSize: 8, fontWeight: "600" }, readiness: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 4, borderColor: "#58D0AA", backgroundColor: "#F7FFFC" }, readinessValue: { color: "#153B35", fontSize: 10, fontWeight: "900" }, readinessLabel: { color: "#5B8B7B", fontSize: 6, fontWeight: "800" }, chevron: { color: "#1F2A42", fontSize: 22 },
  sectionHeader: { marginTop: 18 }, sectionTitle: { color: TRAVA.ink, fontSize: 17, fontWeight: "900" }, sectionSubtitle: { marginTop: 2, color: "#8A93A5", fontSize: 9, fontWeight: "600" }, quickGrid: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 8 }, quickCard: { width: "32%", minWidth: 150, minHeight: 80, flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 13, borderRadius: 17, backgroundColor: "rgba(255,255,255,.76)", borderWidth: 1, borderColor: "rgba(232,234,241,.96)" }, quickWide: { width: "48%" }, quickCopy: { flex: 1, minWidth: 0 }, quickTitle: { color: TRAVA.ink, fontSize: 10, fontWeight: "900" }, quickSubtitle: { marginTop: 3, color: "#8992A4", fontSize: 8, fontWeight: "600" }, quickIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, boxShadow: "0 8px 16px rgba(117,87,180,.12)" }, quickGlyph: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  upcomingHeader: { marginTop: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, seeAll: { color: TRAVA.purple, fontSize: 9, fontWeight: "900" }, upcomingList: { marginTop: 8, gap: 7 }, upcomingRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 17, backgroundColor: "rgba(255,255,255,.86)", borderWidth: 1, borderColor: "#ECEEF3" }, upcomingImage: { width: 70, height: 54, overflow: "hidden", borderRadius: 12 }, upcomingCopy: { flex: 1, minWidth: 0 }, upcomingName: { color: TRAVA.ink, fontSize: 10, fontWeight: "900" }, upcomingDestination: { marginTop: 2, color: "#7D879A", fontSize: 8, fontWeight: "600" }, upcomingDate: { marginTop: 5, color: "#9AA2B1", fontSize: 7, fontWeight: "600" }, daysBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#EDF5FF" }, daysText: { color: "#6383B7", fontSize: 8, fontWeight: "900" },
  loadingState: { marginTop: 22, alignItems: "center", padding: 36 }, stateText: { marginTop: 10, color: "#758097", fontSize: 11, fontWeight: "700" }, emptyState: { marginTop: 20, alignItems: "center", padding: 30, borderRadius: 24, backgroundColor: "#FFF" }, emptyPlane: { fontSize: 42 }, emptyTitle: { marginTop: 7, color: TRAVA.ink, fontSize: 17, fontWeight: "900" }, emptyButton: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, backgroundColor: TRAVA.purple }, emptyButtonText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(16,18,36,.54)" }, scannerSheet: { width: "100%", maxWidth: 460, borderRadius: 28, padding: 20, backgroundColor: "#FFF", boxShadow: "0 24px 80px rgba(35,30,66,.25)" }, scannerHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, scannerTitle: { color: TRAVA.ink, fontSize: 20, fontWeight: "900" }, scannerSub: { marginTop: 4, maxWidth: 320, color: "#7B869A", fontSize: 10, lineHeight: 15, fontWeight: "600" }, closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#F3F4F8" }, closeText: { color: TRAVA.ink, fontSize: 20 }, scanSourceRow: { marginTop: 18, flexDirection: "row", gap: 9 }, scanSource: { flex: 1, minHeight: 76, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#F3EFFF", borderWidth: 1, borderColor: "#E4D9FF" }, scanSourceGlyph: { color: TRAVA.purple, fontSize: 24, fontWeight: "900" }, scanSourceText: { marginTop: 4, color: TRAVA.ink, fontSize: 10, fontWeight: "900" }, dropZone: { marginTop: 12, minHeight: 150, alignItems: "center", justifyContent: "center", padding: 22, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: "#CFC7F8", backgroundColor: "#FAF9FF" }, cameraGlyph: { color: TRAVA.purple, fontSize: 33 }, dropTitle: { marginTop: 8, color: TRAVA.ink, fontSize: 13, fontWeight: "900" }, dropText: { marginTop: 5, maxWidth: 300, textAlign: "center", color: "#7E889B", fontSize: 9, lineHeight: 14, fontWeight: "600" }, scanError: { marginTop: 10, color: "#C83B4A", fontSize: 9, fontWeight: "700" }, scanResult: { marginTop: 16, padding: 16, borderRadius: 21, backgroundColor: "#FAF9FF", borderWidth: 1, borderColor: "#ECE7FF" }, scanRoute: { color: TRAVA.ink, fontSize: 24, fontWeight: "900" }, scanGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }, scanField: { width: "30%", flexGrow: 1, padding: 10, borderRadius: 13, backgroundColor: "#FFF" }, scanFieldLabel: { color: "#8A94A7", fontSize: 7, fontWeight: "900" }, scanFieldValue: { marginTop: 4, color: TRAVA.ink, fontSize: 11, fontWeight: "900" }, scanActions: { marginTop: 16, flexDirection: "row", gap: 9 }, secondaryButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#EFF1F5" }, secondaryText: { color: "#5D6880", fontSize: 10, fontWeight: "900" }, primaryButton: { flex: 1.4, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: TRAVA.purple }, primaryText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
});
