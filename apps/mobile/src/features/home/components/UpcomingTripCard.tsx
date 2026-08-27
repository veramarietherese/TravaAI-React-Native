import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HomeTripSummary } from "../types/home.types";
import { formatMoney, formatTripDate } from "../utils/home-normalizers";

interface UpcomingTripCardProps {
  trip: HomeTripSummary | null;
  onPress(): void;
  onCreateTrip(): void;
}

export function UpcomingTripCard({ trip, onPress, onCreateTrip }: UpcomingTripCardProps) {
  if (!trip) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onCreateTrip}
        style={({ pressed }: { pressed: boolean }) => [styles.empty, pressed && styles.pressed]}
      >
        <Text style={styles.emptyIcon}>◫</Text>
        <Text style={styles.emptyTitle}>No upcoming trip yet</Text>
        <Text style={styles.emptyCopy}>Create one and your live plan will appear here automatically.</Text>
        <View style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Create a trip</Text>
        </View>
      </Pressable>
    );
  }

  const progress = trip.totalBudget > 0 ? Math.min(100, Math.round((trip.spent / trip.totalBudget) * 100)) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${trip.name}`}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.hero}>
        {trip.imageUrl ? (
          <Image source={{ uri: trip.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} transition={180} />
        ) : (
          <LinearGradient
            colors={["#15244A", "#5D58C8", "#D26F9D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={["rgba(5,11,25,0.74)", "rgba(5,11,25,0.08)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.tripName}>{trip.name}</Text>
          <Text style={styles.tripDate}>◫  {formatTripDate(trip.startDate, trip.endDate)}</Text>
          <View style={styles.tripMetaRow}>
            {trip.destination ? <Text style={styles.tripMeta}>⌖ {trip.destination}</Text> : null}
            <Text style={styles.tripMeta}>◎ {trip.memberCount} traveler{trip.memberCount === 1 ? "" : "s"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.budget}>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Budget used</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.budgetValue}>
            {formatMoney(trip.spent, trip.currencyCode)} / {formatMoney(trip.totalBudget, trip.currencyCode)}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={["#FF4C9B", "#7695E8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F1F7",
    elevation: 5,
  },
  hero: { minHeight: 205, overflow: "hidden", backgroundColor: "#1C2641" },
  heroCopy: { position: "absolute", left: 20, right: 20, bottom: 19 },
  tripName: { color: "#FFFFFF", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.55 },
  tripDate: { marginTop: 6, color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  tripMetaRow: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tripMeta: {
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    color: "#F7F8FF",
    backgroundColor: "rgba(255,255,255,0.18)",
    fontSize: 11,
    fontWeight: "700",
  },
  budget: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 17 },
  budgetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  budgetLabel: { color: "#5F6D86", fontSize: 12, fontWeight: "700" },
  budgetValue: { flex: 1, textAlign: "right", color: "#182541", fontSize: 12, fontWeight: "900" },
  progressTrack: { height: 7, overflow: "hidden", marginTop: 12, borderRadius: 999, backgroundColor: "#F8DFED" },
  progressFill: { height: "100%", borderRadius: 999 },
  empty: {
    minHeight: 185,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D7DCEC",
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  emptyIcon: { color: "#7695E8", fontSize: 28, fontWeight: "800" },
  emptyTitle: { color: "#27344E", fontSize: 17, fontWeight: "900" },
  emptyCopy: { maxWidth: 310, color: "#76839B", fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "600" },
  emptyAction: { marginTop: 7, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: "#111B34" },
  emptyActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.992 }] },
});
