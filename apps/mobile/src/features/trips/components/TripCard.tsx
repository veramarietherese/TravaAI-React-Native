import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TripSummary } from "@trava/shared";

const STATUS_LABELS = { draft: "Draft", upcoming: "Upcoming", ongoing: "Ongoing", completed: "Completed" } as const;

export function TripCard({ trip, onPress }: { trip: TripSummary; onPress(): void }) {
  const date = trip.startDate
    ? `${formatDate(trip.startDate)}${trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}`
    : "Dates not set";
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {trip.coverImageUrl ? (
        <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" style={styles.image} />
      ) : (
        <View style={styles.fallback}><Text style={styles.fallbackIcon}>✈</Text></View>
      )}
      <View style={styles.body}>
        <View style={styles.topLine}>
          <View style={[styles.status, styles[`status_${trip.status}`]]}><Text style={styles.statusText}>{STATUS_LABELS[trip.status]}</Text></View>
          <Text style={styles.members}>{trip.memberCount} traveler{trip.memberCount === 1 ? "" : "s"}</Text>
        </View>
        <Text numberOfLines={1} style={styles.name}>{trip.name}</Text>
        <Text numberOfLines={1} style={styles.destination}>{trip.destination}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>◷ {date}</Text>
          <Text style={styles.meta}>{trip.numberOfDays} day{trip.numberOfDays === 1 ? "" : "s"}</Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : value;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", minHeight: 124, borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5", boxShadow: "0px 7px 12px rgba(42,53,85,0.07)", elevation: 3 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.992 }] },
  image: { width: 116, height: "100%", minHeight: 124 },
  fallback: { width: 116, minHeight: 124, alignItems: "center", justifyContent: "center", backgroundColor: "#EDE8FF" },
  fallbackIcon: { fontSize: 38, color: "#6F54E8" },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, minWidth: 0 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  status_draft: { backgroundColor: "#EEF0F5" },
  status_upcoming: { backgroundColor: "#E7F8EF" },
  status_ongoing: { backgroundColor: "#EEE9FF" },
  status_completed: { backgroundColor: "#E9F3FF" },
  statusText: { color: "#34405A", fontSize: 9, fontWeight: "900" },
  members: { color: "#8791A5", fontSize: 9, fontWeight: "700" },
  name: { marginTop: 10, color: "#18233D", fontSize: 17, lineHeight: 21, fontWeight: "900" },
  destination: { marginTop: 2, color: "#6E7A92", fontSize: 12, lineHeight: 16, fontWeight: "700" },
  metaRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  meta: { color: "#7D879B", fontSize: 9, lineHeight: 13, fontWeight: "700" },
  chevron: { alignSelf: "center", marginRight: 12, color: "#7160CD", fontSize: 28, fontWeight: "500" },
});
