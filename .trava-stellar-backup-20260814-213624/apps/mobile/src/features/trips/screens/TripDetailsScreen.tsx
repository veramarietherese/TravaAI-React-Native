import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { deleteTrip, fetchTrip } from "../api/trips.api";
import { FlightStatusCard } from "../components/FlightStatusCard";
import { TripWorkspaceHeader } from "../components/TripWorkspaceHeader";

const ACTIONS = [
  ["Itinerary", "Build the daily plan", "itinerary", "▦"],
  ["Map", "See every activity", "map", "⌖"],
  ["Budget", "Plan category limits", "budget", "◫"],
  ["Expenses", "Split and settle costs", "expenses", "₱"],
  ["Checklist", "Keep local tasks", "checklist", "✓"],
  ["Documents", "Keep files on device", "documents", "▱"],
  ["Members", "Invite collaborators", "members", "☺"],
] as const;

export function TripDetailsScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const removeMutation = useMutation({
    mutationFn: () => deleteTrip(tripId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
      router.replace("/(traveler)/(tabs)/trips" as Href);
    },
    onError: (error) => Alert.alert("Delete trip", error instanceof Error ? error.message : "Unable to delete this trip."),
  });

  const trip = tripQuery.data;
  if (!trip) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="dark" />
        {tripQuery.isLoading ? <ActivityIndicator color="#7055EC" size="large" /> : <Text style={styles.error}>{tripQuery.error instanceof Error ? tripQuery.error.message : "Trip unavailable."}</Text>}
        {tripQuery.isError ? <Pressable onPress={() => void tripQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
      </SafeAreaView>
    );
  }

  function confirmDelete() {
    Alert.alert("Delete this trip?", "This removes shared activities, expenses, budget categories, invitations, and uploaded trip media. Local checklist and document copies remain only on this device until you delete them.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete trip", style: "destructive", onPress: () => removeMutation.mutate() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} subtitle={trip.destination} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={tripQuery.isRefetching} onRefresh={() => void tripQuery.refetch()} tintColor="#7055EC" />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.maxWidth}>
          <View style={styles.hero}>
            {trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, styles.heroFallback]}><Text style={styles.heroPlane}>✈</Text></View>}
            <View style={styles.heroShade} />
            <View style={styles.heroTop}><View style={styles.status}><Text style={styles.statusText}>{trip.status.toUpperCase()}</Text></View>{trip.canManageTrip ? <Pressable onPress={() => router.push(`/trip/${tripId}/edit` as Href)} style={styles.heroButton}><Text style={styles.heroButtonText}>Edit trip</Text></Pressable> : null}</View>
            <View style={styles.heroCopy}><Text style={styles.heroEyebrow}>{trip.numberOfDays} DAY TRIP</Text><Text style={styles.heroTitle}>{trip.name}</Text><Text style={styles.heroDestination}>{trip.destination}</Text></View>
          </View>

          <View style={styles.metrics}>
            <Metric label="Dates" value={formatDateRange(trip.startDate, trip.endDate)} />
            <Metric label="Budget" value={`${trip.currencyCode} ${trip.totalBudget.toLocaleString()}`} />
            <Metric label="Travelers" value={String(trip.memberCount)} />
          </View>

          {trip.description ? <View style={styles.card}><Text style={styles.cardTitle}>Trip overview</Text><Text style={styles.description}>{trip.description}</Text><View style={styles.pills}>{trip.travelStyle ? <Pill text={trip.travelStyle} /> : null}{trip.travelGroup ? <Pill text={trip.travelGroup} /> : null}</View></View> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan and collaborate</Text>
            <Text style={styles.cardSubtitle}>Every tool below is connected to this trip and its accepted members.</Text>
            <View style={styles.actionGrid}>{ACTIONS.map(([label, subtitle, suffix, icon]) => <Pressable key={suffix} onPress={() => router.push(`/trip/${tripId}/${suffix}` as Href)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Text style={styles.actionGlyph}>{icon}</Text></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>{label}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View><Text style={styles.actionChevron}>›</Text></Pressable>)}</View>
          </View>

          <FlightStatusCard tripId={tripId} initialFlightNumber={trip.flightNumber} initialFlightDate={trip.flightDate} canEdit={trip.canManageTrip} />

          <View style={styles.card}>
            <View style={styles.cardHeader}><View><Text style={styles.cardTitle}>Travel group</Text><Text style={styles.cardSubtitle}>Owner and accepted members</Text></View><Pressable onPress={() => router.push(`/trip/${tripId}/members` as Href)}><Text style={styles.link}>Manage</Text></Pressable></View>
            <View style={styles.memberList}>{trip.members.filter((member) => member.status === "accepted").slice(0, 5).map((member) => <View key={member.id} style={styles.member}><View style={styles.avatar}>{member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={styles.avatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.memberCopy}><Text style={styles.memberName}>{member.fullName}</Text><Text style={styles.memberRole}>{member.role === "owner" ? "Trip owner" : "Member"}</Text></View></View>)}</View>
          </View>

          {trip.canManageTrip ? <Pressable disabled={removeMutation.isPending} onPress={confirmDelete} style={styles.deleteButton}>{removeMutation.isPending ? <ActivityIndicator color="#C83B4A" /> : <Text style={styles.deleteText}>Delete trip</Text>}</Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={2} style={styles.metricValue}>{value}</Text></View>; }
function Pill({ text }: { text: string }) { return <View style={styles.pill}><Text style={styles.pillText}>{text}</Text></View>; }
function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Not set";
  const format = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return end ? `${format(start)} – ${format(end)}` : format(start);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#F8F9FF", padding: 24 },
  error: { color: "#C83B4A", textAlign: "center", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  retry: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 14, backgroundColor: "#7055EC" },
  retryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  content: { padding: 16, paddingBottom: 50 },
  maxWidth: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14 },
  hero: { minHeight: 270, overflow: "hidden", borderRadius: 28, backgroundColor: "#DAD3FF" },
  heroFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#EAE5FF" },
  heroPlane: { color: "#7259EA", fontSize: 70 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(14,22,44,0.34)" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", padding: 15 },
  status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)" },
  statusText: { color: "#5543B8", fontSize: 9, fontWeight: "900" },
  heroButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 13, backgroundColor: "rgba(20,29,52,0.82)" },
  heroButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  heroCopy: { position: "absolute", left: 18, right: 18, bottom: 18 },
  heroEyebrow: { color: "#EDE9FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { marginTop: 5, color: "#FFFFFF", fontSize: 29, lineHeight: 34, fontWeight: "900" },
  heroDestination: { marginTop: 3, color: "#F0F2FA", fontSize: 12, fontWeight: "700" },
  metrics: { flexDirection: "row", gap: 9 },
  metric: { flex: 1, minWidth: 0, minHeight: 76, borderRadius: 19, padding: 12, justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5" },
  metricLabel: { color: "#8A94A7", fontSize: 8, fontWeight: "800" },
  metricValue: { marginTop: 5, color: "#1A263F", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  card: { borderRadius: 24, padding: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardTitle: { color: "#17223C", fontSize: 18, fontWeight: "900" },
  cardSubtitle: { marginTop: 3, color: "#818B9E", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  description: { marginTop: 10, color: "#5F6C84", fontSize: 12, lineHeight: 19, fontWeight: "600" },
  pills: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#EEE9FF" },
  pillText: { color: "#6651CD", fontSize: 9, fontWeight: "800" },
  actionGrid: { marginTop: 13, gap: 8 },
  action: { minHeight: 62, flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 17, backgroundColor: "#F7F7FC" },
  pressed: { opacity: 0.7 },
  actionIcon: { width: 41, height: 41, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDE8FF" },
  actionGlyph: { color: "#7055EC", fontSize: 20, fontWeight: "900" },
  actionCopy: { flex: 1, minWidth: 0, paddingHorizontal: 11 },
  actionTitle: { color: "#263149", fontSize: 12, fontWeight: "900" },
  actionSubtitle: { marginTop: 2, color: "#8791A4", fontSize: 9, fontWeight: "600" },
  actionChevron: { color: "#8C7AD7", fontSize: 23 },
  link: { color: "#7055EC", fontSize: 10, fontWeight: "900" },
  memberList: { marginTop: 12, gap: 9 },
  member: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 38, height: 38, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#EDE8FF" },
  avatarText: { color: "#6550D8", fontSize: 14, fontWeight: "900" },
  memberCopy: { marginLeft: 10 },
  memberName: { color: "#263149", fontSize: 11, fontWeight: "900" },
  memberRole: { marginTop: 2, color: "#8B94A6", fontSize: 9, fontWeight: "600" },
  deleteButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#FFF0F2", borderWidth: 1, borderColor: "#FFD9DE" },
  deleteText: { color: "#C83B4A", fontSize: 11, fontWeight: "900" },
});
