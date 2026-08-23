import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { deleteTrip, fetchTrip } from "../api/trips.api";
import { FlightStatusCard } from "../components/FlightStatusCard";
import { TripWorkspaceHeader } from "../components/TripWorkspaceHeader";
import { GlassCard, GradientPill, TRAVA, formatShortDate, money } from "../components/TravaUI";

const ACTIONS = [
  ["Itinerary", "Daily plan & map", "itinerary", "▦", "#FF6F91"],
  ["Budget", "Plan and track", "budget", "▣", "#55CDA0"],
  ["Expenses", "Split and settle", "expenses", "₱", "#FF9A56"],
  ["Checklist", "Private on-device", "checklist", "✓", "#A978FF"],
  ["Documents", "Private local vault", "documents", "▱", "#6FB7FF"],
  ["Members", "Invite collaborators", "members", "♙", "#E96AA7"],
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
  if (!trip) return <SafeAreaView style={styles.center}><StatusBar style="dark" />{tripQuery.isLoading ? <ActivityIndicator color={TRAVA.purple} size="large" /> : <Text style={styles.error}>{tripQuery.error instanceof Error ? tripQuery.error.message : "Trip unavailable."}</Text>}</SafeAreaView>;

  function confirmDelete() {
    Alert.alert("Delete this trip?", "Shared trip data will be removed. Local checklist and document copies remain on this device until you delete them.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete trip", style: "destructive", onPress: () => removeMutation.mutate() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#FFF7F8", "#F9F7FF", "#F7FAFF"]} style={StyleSheet.absoluteFillObject} />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} />
      <ScrollView refreshControl={<RefreshControl refreshing={tripQuery.isRefetching} onRefresh={() => void tripQuery.refetch()} tintColor={TRAVA.purple} />} contentContainerStyle={styles.content}>
        <View style={styles.maxWidth}>
          <GlassCard style={styles.hero}>
            {trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject} /> : <LinearGradient colors={["#7C3AED", "#EC4899", "#F9A45D"]} style={StyleSheet.absoluteFillObject} />}
            <LinearGradient colors={["rgba(16,18,36,.05)", "rgba(16,18,36,.72)"]} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroTop}>
              <View style={styles.statusPill}><Text style={styles.statusText}>{trip.status.toUpperCase()}</Text></View>
              {trip.canManageTrip ? <Pressable onPress={() => router.push(`/trip/${tripId}/edit` as Href)} style={styles.editTrip}><Text style={styles.editTripText}>✎ Edit Trip</Text></Pressable> : null}
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroEyebrow}>{trip.numberOfDays} DAY JOURNEY</Text>
              <Text style={styles.heroTitle}>{trip.name}</Text>
              <Text style={styles.heroDestination}>⌖ {trip.destination}</Text>
              <View style={styles.heroPills}><Text style={styles.heroPill}>{trip.startDate ? formatShortDate(trip.startDate) : "Dates not set"}</Text><Text style={styles.heroPill}>{trip.memberCount} travelers</Text></View>
            </View>
          </GlassCard>

          <View style={styles.metrics}>
            <GlassCard style={styles.metric}><Text style={styles.metricLabel}>TRIP BUDGET</Text><Text style={styles.metricValue}>{money(trip.totalBudget, trip.currencyCode)}</Text></GlassCard>
            <GlassCard style={styles.metric}><Text style={styles.metricLabel}>TRAVEL STYLE</Text><Text style={styles.metricValue}>{trip.travelStyle ?? "Flexible"}</Text></GlassCard>
            <GlassCard style={styles.metric}><Text style={styles.metricLabel}>GROUP</Text><Text style={styles.metricValue}>{trip.travelGroup ?? `${trip.memberCount} travelers`}</Text></GlassCard>
          </View>

          <GlassCard style={styles.overviewCard}>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Overview</Text><Text style={styles.sectionSub}>Everything connected to this Japan trip.</Text></View><GradientPill style={styles.readyPill}><Text style={styles.readyText}>78% Ready</Text></GradientPill></View>
            {trip.description ? <Text style={styles.description}>{trip.description}</Text> : <Text style={styles.description}>Keep plans, spending, private checklists, and local documents together in one workspace.</Text>}
            <View style={styles.localBadges}><View style={styles.localBadge}><Text style={styles.localBadgeIcon}>✓</Text><View><Text style={styles.localBadgeTitle}>Checklist</Text><Text style={styles.localBadgeSub}>Local first</Text></View></View><View style={styles.localBadge}><Text style={styles.localBadgeIcon}>▱</Text><View><Text style={styles.localBadgeTitle}>Documents</Text><Text style={styles.localBadgeSub}>Stored on device</Text></View></View></View>
          </GlassCard>

          <View><Text style={styles.sectionTitle}>Plan & Manage</Text><Text style={styles.sectionSub}>Open a tool without leaving this trip context.</Text></View>
          <View style={styles.actionGrid}>
            {ACTIONS.map(([label, subtitle, suffix, glyph, accent]) => (
              <Pressable key={label} onPress={() => router.push(`/trip/${tripId}/${suffix}` as Href)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
                <LinearGradient colors={[`${accent}22`, `${accent}0A`]} style={styles.actionIcon}><Text style={[styles.actionGlyph, { color: accent }]}>{glyph}</Text></LinearGradient>
                <View style={styles.actionCopy}><Text style={styles.actionTitle}>{label}</Text><Text style={styles.actionSub}>{subtitle}</Text></View><Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>

          <FlightStatusCard tripId={tripId} initialFlightNumber={trip.flightNumber} initialFlightDate={trip.flightDate} canEdit={trip.canManageTrip} />

          <GlassCard style={styles.membersCard}>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Travel Group</Text><Text style={styles.sectionSub}>Accepted members in this trip.</Text></View><Pressable onPress={() => router.push(`/trip/${tripId}/members` as Href)}><Text style={styles.manageLink}>Manage ›</Text></Pressable></View>
            <View style={styles.memberRow}>{trip.members.filter((member) => member.status === "accepted").slice(0, 6).map((member, index) => <View key={member.id} style={[styles.avatar, { marginLeft: index ? -9 : 0 }]}>{member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject} /> : <Text style={styles.avatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>}</View>)}<Text style={styles.memberText}>{trip.memberCount} people planning together</Text></View>
          </GlassCard>

          {trip.canManageTrip ? <Pressable disabled={removeMutation.isPending} onPress={confirmDelete} style={styles.deleteButton}>{removeMutation.isPending ? <ActivityIndicator color="#C83B4A" /> : <Text style={styles.deleteText}>Delete Trip</Text>}</Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF9FB" }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF9FB", padding: 24 }, error: { color: "#C83B4A", textAlign: "center", fontWeight: "700" },
  content: { padding: 16, paddingBottom: 100 }, maxWidth: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14 },
  hero: { minHeight: 300, overflow: "hidden", borderRadius: 30 }, heroTop: { flexDirection: "row", justifyContent: "space-between", padding: 16 }, statusPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,.9)" }, statusText: { color: "#5D4AC5", fontSize: 9, fontWeight: "900" }, editTrip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: "rgba(255,255,255,.88)" }, editTripText: { color: TRAVA.ink, fontSize: 9, fontWeight: "900" }, heroBottom: { position: "absolute", left: 20, right: 20, bottom: 18 }, heroEyebrow: { color: "#F2EFFF", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, heroTitle: { marginTop: 5, color: "#FFF", fontSize: 33, lineHeight: 38, fontWeight: "900" }, heroDestination: { marginTop: 4, color: "#F6F6FB", fontSize: 12, fontWeight: "700" }, heroPills: { marginTop: 11, flexDirection: "row", gap: 7 }, heroPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, color: "#FFF", backgroundColor: "rgba(255,255,255,.18)", fontSize: 8, fontWeight: "800" },
  metrics: { flexDirection: "row", gap: 8 }, metric: { flex: 1, minWidth: 0, minHeight: 88, justifyContent: "center", padding: 13, borderRadius: 20 }, metricLabel: { color: "#9299AA", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, metricValue: { marginTop: 6, color: TRAVA.ink, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  overviewCard: { borderRadius: 25, padding: 17 }, sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, sectionTitle: { color: TRAVA.ink, fontSize: 19, lineHeight: 23, fontWeight: "900" }, sectionSub: { marginTop: 3, color: "#858EA1", fontSize: 9, lineHeight: 14, fontWeight: "600" }, readyPill: { minWidth: 86, height: 34 }, readyText: { color: "#FFF", fontSize: 9, fontWeight: "900" }, description: { marginTop: 12, color: "#5E6980", fontSize: 11, lineHeight: 18, fontWeight: "600" }, localBadges: { marginTop: 14, flexDirection: "row", gap: 8 }, localBadge: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, padding: 11, borderRadius: 16, backgroundColor: "#F7F6FC" }, localBadgeIcon: { width: 34, height: 34, textAlign: "center", textAlignVertical: "center", borderRadius: 17, backgroundColor: "#ECE8FF", color: TRAVA.purple, fontSize: 16, fontWeight: "900" }, localBadgeTitle: { color: TRAVA.ink, fontSize: 10, fontWeight: "900" }, localBadgeSub: { marginTop: 2, color: "#7F899A", fontSize: 8, fontWeight: "600" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, actionCard: { width: "48%", flexGrow: 1, minWidth: 220, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 18, backgroundColor: "rgba(255,255,255,.78)", borderWidth: 1, borderColor: "rgba(235,235,244,.96)" }, actionIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15 }, actionGlyph: { fontSize: 21, fontWeight: "900" }, actionCopy: { flex: 1, minWidth: 0 }, actionTitle: { color: TRAVA.ink, fontSize: 11, fontWeight: "900" }, actionSub: { marginTop: 3, color: "#8791A4", fontSize: 8, fontWeight: "600" }, chevron: { color: "#9A8AD6", fontSize: 22 }, pressed: { opacity: .78, transform: [{ scale: .985 }] },
  membersCard: { borderRadius: 24, padding: 16 }, manageLink: { color: TRAVA.purple, fontSize: 9, fontWeight: "900" }, memberRow: { marginTop: 14, flexDirection: "row", alignItems: "center" }, avatar: { width: 42, height: 42, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 21, borderWidth: 2, borderColor: "#FFF", backgroundColor: "#EDE9FF" }, avatarText: { color: TRAVA.purple, fontSize: 13, fontWeight: "900" }, memberText: { marginLeft: 12, color: "#68758B", fontSize: 9, fontWeight: "700" },
  deleteButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#FFF1F4", borderWidth: 1, borderColor: "#FFD9E2" }, deleteText: { color: "#C83B4A", fontSize: 10, fontWeight: "900" },
});
