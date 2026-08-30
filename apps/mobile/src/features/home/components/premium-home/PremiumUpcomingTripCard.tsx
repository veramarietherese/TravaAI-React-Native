import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { HomeTripSummary } from "../../types/home.types";

interface PremiumUpcomingTripCardProps {
  trip: HomeTripSummary | null;
  readiness: number;
  onPress(): void;
  onItineraryPress(): void;
  onCreateTrip(): void;
}

const BARCODE = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 3, 1, 4, 2, 1, 3];

function parseTripDate(value: string | null) {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTripDate(value: string | null) {
  const date = parseTripDate(value);
  if (!date) return "Date not set";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTicketDate(value: string | null) {
  const date = parseTripDate(value);
  if (!date) return "TBD";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function daysUntil(value: string | null) {
  const date = parseTripDate(value);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

function TripTicket({ trip, travelers, compact }: { trip: HomeTripSummary; travelers: number; compact: boolean }) {
  const destination = trip.destination || trip.name || "Your destination";

  return (
    <View pointerEvents="none" style={[styles.ticketWrap, compact && styles.ticketWrapCompact]}>
      <View style={styles.ticketShadowPlate} />
      <View style={styles.ticket}>
        <View style={styles.ticketAccent} />
        <View style={styles.ticketPerforation} />
        <View style={[styles.ticketNotch, styles.ticketNotchTop]} />
        <View style={[styles.ticketNotch, styles.ticketNotchBottom]} />

        <Text style={styles.ticketBrand}>UPCOMING TRIP</Text>
        <Text style={styles.ticketLabel}>DESTINATION</Text>
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.ticketDestination}>
          {destination}
        </Text>

        <View style={styles.ticketRule} />

        <View style={styles.ticketMetaRow}>
          <View style={styles.ticketMetaCell}>
            <Text style={styles.ticketLabel}>DATE</Text>
            <Text style={styles.ticketMetaValue}>{formatTicketDate(trip.startDate)}</Text>
          </View>
          <View style={styles.ticketMetaCell}>
            <Text style={styles.ticketLabel}>TRAVELERS</Text>
            <Text style={styles.ticketMetaValue}>{travelers}</Text>
          </View>
        </View>

        <Text style={styles.ticketLabel}>TRIP</Text>
        <Text numberOfLines={1} style={styles.ticketTripName}>{trip.name || destination}</Text>

        <View style={styles.barcode}>
          {BARCODE.map((width, index) => (
            <View key={`${width}-${index}`} style={[styles.bar, { width }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

function SharedWindow({ compact }: { compact: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.windowOuter, compact && styles.windowOuterCompact]}>
      <View style={styles.windowGlow} />
      <View style={styles.windowFrameOuter}>
        <View style={styles.windowFrameMiddle}>
          <View style={styles.windowInner}>
            <Image
              source={require("../../assets/premium-home/shared-trip-window.png")}
              contentFit="cover"
              contentPosition="center"
              cachePolicy="memory-disk"
              style={styles.windowImage}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function DecorativeSparkle({ style }: { style: object }) {
  return (
    <View pointerEvents="none" style={[styles.sparkle, style]}>
      <View style={styles.sparkleVertical} />
      <View style={styles.sparkleHorizontal} />
    </View>
  );
}

export function PremiumUpcomingTripCard({ trip, readiness, onPress, onItineraryPress, onCreateTrip }: PremiumUpcomingTripCardProps) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const safeReadiness = Math.max(0, Math.min(100, Math.round(readiness)));

  if (!trip) {
    return (
      <Pressable onPress={onCreateTrip} style={({ pressed }) => [styles.emptyShell, pressed && styles.pressed]}>
        <LinearGradient
          colors={["#6A5BE8", "#A77AD5", "#F2A8CB", "#FFC0CB"]}
          locations={[0, 0.34, 0.72, 1]}
          start={{ x: 0, y: 0.7 }}
          end={{ x: 1, y: 0.34 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bigGlowCircle} />
        <SharedWindow compact={compact} />
        <View style={styles.emptyContent}>
          <Text style={styles.emptyEyebrow}>LATEST TRIP</Text>
          <Text style={styles.emptyTitle}>Your next adventure starts here.</Text>
          <Text style={styles.emptyCopy}>Create a trip and TRAVA will turn this card into your live travel pass.</Text>
          <View style={styles.createButton}>
            <Ionicons name="add" size={16} color="#6457EE" />
            <Text style={styles.createButtonText}>Create Trip</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const destination = trip.destination || trip.name || "Destination pending";
  const tripName = trip.name || destination;
  const travelers = Math.max(1, trip.memberCount || 1);
  const days = daysUntil(trip.startDate);

  return (
        <View style={[styles.card, compact && styles.cardCompact]}>
      <LinearGradient
        colors={["#675BE8", "#9471DA", "#C68ED8", "#F0A6CC", "#FFBFCB"]}
        locations={[0, 0.25, 0.52, 0.76, 1]}
        start={{ x: 0, y: 0.72 }}
        end={{ x: 1, y: 0.35 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft layered geometry, matching the approved banner direction. */}
      <View pointerEvents="none" style={styles.bigGlowCircle} />
      <View pointerEvents="none" style={styles.midGlowCircle} />
      <View pointerEvents="none" style={styles.leftVioletWash} />
      <DecorativeSparkle style={styles.sparkleA} />
      <DecorativeSparkle style={styles.sparkleB} />
      <DecorativeSparkle style={styles.sparkleC} />

      <TripTicket trip={trip} travelers={travelers} compact={compact} />
      <SharedWindow compact={compact} />

      <View style={[styles.content, compact && styles.contentCompact]}>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>UPCOMING TRIP</Text>
        </View>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
          style={[styles.tripName, compact && styles.tripNameCompact]}
        >
          {tripName}
        </Text>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color="#FFFFFF" />
          <Text numberOfLines={1} style={styles.locationText}>{destination}</Text>
        </View>

        <View style={styles.pills}>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
            <Text numberOfLines={1} style={styles.pillText}>{formatTripDate(trip.startDate)}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="people-outline" size={13} color="#FFFFFF" />
            <Text numberOfLines={1} style={styles.pillText}>{travelers} {travelers === 1 ? "traveler" : "travelers"}</Text>
          </View>
        </View>

        {days !== null ? (
          <Text style={styles.daysCopy}>{days === 0 ? "Departure day" : `${days} ${days === 1 ? "day" : "days"} away`}</Text>
        ) : null}
      </View>

      <View style={[styles.progressBlock, compact && styles.progressBlockCompact]}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Trip readiness</Text>
          <Text style={styles.progressValue}>{safeReadiness}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={["#6856FF", "#62BFFF"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.progressFill, { width: `${safeReadiness}%` }]}
          />
        </View>
      </View>

      <Pressable


        accessibilityRole="button"


        accessibilityLabel={`Open ${tripName} trip`}


        onPress={onPress}


        style={({ pressed }) => [


          StyleSheet.absoluteFill,


          { zIndex: 2 },


          pressed && { backgroundColor: "rgba(255,255,255,0.035)" },


        ]}


      />


      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View itinerary"
        onPress={(event) => {
          event.stopPropagation();
          onItineraryPress();
        }}
        style={({ pressed }) => [styles.itineraryButton, compact && styles.itineraryButtonCompact, pressed && styles.pressed]}
      >
        <Text style={styles.itineraryText}>View itinerary</Text>
        <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
      </Pressable>
        </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    height: 220,
    borderRadius: 29,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    shadowColor: "#8B74D0",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 11 },
    elevation: 4,
  },
  cardCompact: { height: 214 },
  bigGlowCircle: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    right: -72,
    top: -74,
    backgroundColor: "rgba(255,238,244,0.22)",
  },
  midGlowCircle: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    right: 78,
    top: -46,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  leftVioletWash: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 62,
    backgroundColor: "rgba(83,70,219,0.30)",
  },

  sparkle: { position: "absolute", width: 12, height: 12, opacity: 0.8 },
  sparkleVertical: { position: "absolute", left: 5.5, top: 0, width: 1, height: 12, backgroundColor: "#FFFFFF", borderRadius: 1 },
  sparkleHorizontal: { position: "absolute", left: 0, top: 5.5, width: 12, height: 1, backgroundColor: "#FFFFFF", borderRadius: 1 },
  sparkleA: { left: "56%", top: 56 },
  sparkleB: { left: "62%", top: 130, transform: [{ scale: 0.65 }] },
  sparkleC: { right: 9, top: 78, transform: [{ scale: 0.5 }] },

  ticketWrap: { position: "absolute", left: 9, top: 10, bottom: 10, width: 126, zIndex: 5 },
  ticketWrapCompact: { width: 112 },
  ticketShadowPlate: {
    position: "absolute",
    left: -3,
    top: 0,
    bottom: 0,
    width: 20,
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
    backgroundColor: "#FF6B35",
  },
  ticket: {
    flex: 1,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.985)",
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 10,
    overflow: "hidden",
    shadowColor: "#4B3F87",
    shadowOpacity: 0.15,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
  },
  ticketAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: "#FF6A3C",
  },
  ticketPerforation: {
    position: "absolute",
    right: 0,
    top: 13,
    bottom: 13,
    width: 1,
    borderRightWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D4D3DE",
  },
  ticketNotch: {
    position: "absolute",
    right: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#B98BD8",
  },
  ticketNotchTop: { top: 34 },
  ticketNotchBottom: { bottom: 34 },
  ticketBrand: { color: "#5F56DD", fontSize: 8.3, fontWeight: "900", letterSpacing: 1.35, marginBottom: 9 },
  ticketLabel: { color: "#7A8195", fontSize: 6.4, lineHeight: 8, fontWeight: "900", letterSpacing: 0.6 },
  ticketDestination: { marginTop: 2, color: "#F25B33", fontSize: 17.5, lineHeight: 19, fontWeight: "900", minHeight: 20 },
  ticketRule: { height: 1, backgroundColor: "#D9DCE5", marginVertical: 7 },
  ticketMetaRow: { flexDirection: "row", gap: 7, marginBottom: 8 },
  ticketMetaCell: { flex: 1, minWidth: 0 },
  ticketMetaValue: { marginTop: 2, color: "#1B2238", fontSize: 8.4, fontWeight: "900" },
  ticketTripName: { marginTop: 2, color: "#1B2238", fontSize: 8.4, fontWeight: "900" },
  barcode: { marginTop: "auto", height: 24, flexDirection: "row", alignItems: "stretch", gap: 1, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: "#161616" },

  content: { position: "absolute", left: 151, top: 22, right: 112, zIndex: 4 },
  contentCompact: { left: 132, right: 100, top: 21 },
  livePill: {
    alignSelf: "flex-start",
    height: 23,
    paddingHorizontal: 9,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,78,239,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  livePillText: { color: "#FFFFFF", fontSize: 7.6, fontWeight: "900", letterSpacing: 0.5 },
  tripName: { marginTop: 9, color: "#FFFFFF", fontSize: 29, lineHeight: 33, fontWeight: "900", letterSpacing: -0.9 },
  tripNameCompact: { fontSize: 25, lineHeight: 29 },
  locationRow: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { flex: 1, color: "rgba(255,255,255,0.98)", fontSize: 11.2, lineHeight: 15, fontWeight: "700" },
  pills: { marginTop: 10, gap: 6 },
  pill: {
    alignSelf: "flex-start",
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  pillText: { color: "#FFFFFF", fontSize: 8.2, fontWeight: "800" },
  daysCopy: { marginTop: 5, color: "rgba(255,255,255,0.75)", fontSize: 7.7, fontWeight: "800" },

  windowOuter: { position: "absolute", right: 16, top: 46, width: 96, height: 118, zIndex: 4 },
  windowOuterCompact: { right: 9, width: 86, height: 108, top: 53 },
  windowGlow: {
    position: "absolute",
    left: -12,
    right: -12,
    top: -12,
    bottom: -12,
    borderRadius: 45,
    backgroundColor: "rgba(255,218,220,0.16)",
  },
  windowFrameOuter: {
    flex: 1,
    padding: 5,
    borderRadius: 34,
    backgroundColor: "rgba(255,214,216,0.52)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    shadowColor: "#7A558A",
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
  },
  windowFrameMiddle: {
    flex: 1,
    padding: 5,
    borderRadius: 29,
    backgroundColor: "rgba(255,239,232,0.60)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.56)",
  },
  windowInner: { flex: 1, borderRadius: 23, overflow: "hidden", backgroundColor: "#8D83D7" },
  windowImage: { width: "100%", height: "100%" },

  progressBlock: { position: "absolute", left: 151, right: 18, bottom: 14, zIndex: 6 },
  progressBlockCompact: { left: 132, right: 14 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: "#FFFFFF", fontSize: 9.8, fontWeight: "900" },
  progressValue: { color: "#1B1832", fontSize: 11.5, fontWeight: "900" },
  progressTrack: {
    marginTop: 6,
    height: 7,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
  },
  progressFill: { height: "100%", borderRadius: 99 },

  itineraryButton: { zIndex: 3, position: "absolute",
    top: 11,
    right: 11,
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6757F1",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "#5B4FD4",
    shadowOpacity: 0.20,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  itineraryButtonCompact: { paddingHorizontal: 10 },
  itineraryText: { color: "#FFFFFF", fontSize: 9.8, fontWeight: "900" },

  emptyShell: {
    marginTop: 10,
    minHeight: 190,
    borderRadius: 29,
    overflow: "hidden",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  emptyContent: { zIndex: 3, maxWidth: "68%" },
  emptyEyebrow: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  emptyTitle: { marginTop: 9, color: "#FFFFFF", fontSize: 25, lineHeight: 30, fontWeight: "900", maxWidth: 290 },
  emptyCopy: { marginTop: 7, color: "rgba(255,255,255,0.94)", fontSize: 11, lineHeight: 16, maxWidth: 320, fontWeight: "600" },
  createButton: { marginTop: 13, alignSelf: "flex-start", height: 34, borderRadius: 17, paddingHorizontal: 12, flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: "#FFFFFF" },
  createButtonText: { color: "#6457EE", fontSize: 10.5, fontWeight: "900" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.992 }] },
});
