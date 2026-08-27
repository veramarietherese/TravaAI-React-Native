import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTripSummary } from "../../types/home.types";

interface PremiumUpcomingTripCardProps {
  trip: HomeTripSummary | null;
  readiness: number;
  onPress(): void;
  onItineraryPress(): void;
  onCreateTrip(): void;
}

function parseTripDate(value: string | null) {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTripDate(value: string | null) {
  const date = parseTripDate(value);
  if (!date) return "Sep 18, 2026";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(value: string | null) {
  const date = parseTripDate(value);
  if (!date) return 22;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

export function PremiumUpcomingTripCard({ trip, readiness, onPress, onItineraryPress, onCreateTrip }: PremiumUpcomingTripCardProps) {
  const destination = trip?.destination || trip?.name || "Hong Kong";
  const travelers = Math.max(1, trip?.memberCount ?? 2);
  const days = daysUntil(trip?.startDate ?? null);

  if (!trip) {
    return (
      <Pressable onPress={onCreateTrip} style={({ pressed }) => [styles.emptyShell, pressed && styles.pressed]}>
        <LinearGradient colors={["#C7B8FF", "#F6CFE7", "#DCEBFF"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.eyebrow}>UPCOMING TRIP</Text>
        <Text style={styles.emptyTitle}>Your next adventure starts here.</Text>
        <Text style={styles.emptyCopy}>Create a trip and TRAVA will turn this card into your live planning hub.</Text>
        <View style={styles.createButton}><Ionicons name="add" size={16} color="#6457EE" /><Text style={styles.createButtonText}>Create Trip</Text></View>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${destination} trip`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <LinearGradient colors={["#8E8BEA", "#D4A8DE", "#F5C8D9"]} start={{ x: 0, y: 0.72 }} end={{ x: 1, y: 0.42 }} style={StyleSheet.absoluteFillObject} />
      <Image
        source={require("../../assets/premium-home/hong-kong-scenic.png")}
        contentFit="cover"
        contentPosition="right bottom"
        style={styles.scenic}
      />
      <LinearGradient colors={["rgba(99,91,205,0.72)", "rgba(142,119,220,0.27)", "rgba(255,211,228,0.03)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />

      <View style={styles.content}>
        <Text style={styles.eyebrow}>UPCOMING TRIP</Text>
        <Text numberOfLines={1} style={styles.destination}>{destination}</Text>
        <Text style={styles.date}>{formatTripDate(trip.startDate)}</Text>

        <View style={styles.pills}>
          <View style={styles.pill}><Ionicons name="calendar-outline" size={13} color="#FFFFFF" /><Text style={styles.pillText}>{days} days away</Text></View>
          <View style={styles.pill}><Ionicons name="people-outline" size={14} color="#FFFFFF" /><Text style={styles.pillText}>{travelers} {travelers === 1 ? "traveler" : "travelers"}</Text></View>
        </View>

      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}><Text style={styles.progressLabel}>Trip readiness</Text><Text style={styles.progressValue}>{readiness}%</Text></View>
        <View style={styles.progressTrack}><LinearGradient colors={["#6C58FF", "#69B6FF"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.progressFill, { width: `${readiness}%` }]} /></View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="View itinerary" onPress={(event) => { event.stopPropagation(); onItineraryPress(); }} style={({ pressed }) => [styles.itineraryButton, pressed && styles.pressed]}>
        <Text style={styles.itineraryText}>View Itinerary</Text>
        <Ionicons name="chevron-forward" size={14} color="#6B5FF2" />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, height: 184, borderRadius: 27, overflow: "hidden", position: "relative", shadowColor: "#9A85CC", shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  scenic: { position: "absolute", right: 0, top: 0, bottom: 0, width: "64%", opacity: 0.9 },
  content: { flex: 1, paddingHorizontal: 17, paddingTop: 17, paddingBottom: 48, paddingRight: "43%" },
  eyebrow: { color: "#FFFFFF", fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.25 },
  destination: { marginTop: 7, color: "#FFFFFF", fontSize: 27, lineHeight: 31, fontWeight: "900", letterSpacing: -0.7 },
  date: { marginTop: 2, color: "rgba(255,255,255,0.95)", fontSize: 12.5, lineHeight: 17, fontWeight: "600" },
  pills: { flexDirection: "row", gap: 8, marginTop: 12 },
  pill: { minHeight: 31, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
  pillText: { color: "#FFFFFF", fontSize: 9.8, fontWeight: "800" },
  progressBlock: { position: "absolute", left: 17, right: 17, bottom: 13 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" },
  progressValue: { color: "#111A37", fontSize: 12.5, fontWeight: "900" },
  progressTrack: { marginTop: 6, height: 8, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.58)" },
  progressFill: { height: "100%", borderRadius: 99 },
  itineraryButton: { position: "absolute", top: 11, right: 10, minHeight: 35, paddingHorizontal: 13, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "rgba(216,209,251,0.88)" },
  itineraryText: { color: "#6257E9", fontSize: 10.5, fontWeight: "800" },
  emptyShell: { marginTop: 14, minHeight: 164, borderRadius: 27, overflow: "hidden", padding: 18 },
  emptyTitle: { marginTop: 9, color: "#FFFFFF", fontSize: 25, lineHeight: 30, fontWeight: "900", maxWidth: 290 },
  emptyCopy: { marginTop: 7, color: "rgba(255,255,255,0.94)", fontSize: 11, lineHeight: 16, maxWidth: 320, fontWeight: "600" },
  createButton: { marginTop: 13, alignSelf: "flex-start", height: 34, borderRadius: 17, paddingHorizontal: 12, flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: "#FFFFFF" },
  createButtonText: { color: "#6457EE", fontSize: 10.5, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
});
