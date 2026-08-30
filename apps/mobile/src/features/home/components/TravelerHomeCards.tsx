import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PLANNING_TOOLS, type PlanningToolKey } from "@/components/travel/planning-tools";
import { tripCoverSource } from "@/components/travel/trip-cover-images";

import type { HomeTourPackage, HomeTripSummary } from "../types/home.types";
import { formatMoney, formatTripDate } from "../utils/home-normalizers";

export interface HomePulseValues {
  checklistTotal: number;
  checklistCompleted: number;
  documentCount: number;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const timestamp = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86400000);
}

export function calculateTripReadiness(trip: HomeTripSummary, pulse: HomePulseValues): number {
  let score = 0;
  if (trip.destination) score += 15;
  if (trip.startDate && trip.endDate) score += 20;
  if (trip.totalBudget > 0) score += 15;
  if (pulse.checklistTotal > 0) {
    score += 25 * (pulse.checklistCompleted / pulse.checklistTotal);
  }
  if (pulse.documentCount > 0) score += 15;
  if (trip.memberCount > 0) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function SoftIcon({
  icon,
  colors,
  size = 46,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string, ...string[]];
  size?: number;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.softIcon, { width: size, height: size, borderRadius: Math.round(size * 0.34) }]}
    >
      <View style={styles.softHighlight} />
      <Ionicons name={icon} size={Math.round(size * 0.48)} color="#FFFFFF" />
    </LinearGradient>
  );
}

export function ActiveTripCard({
  trip,
  readiness,
  onOpen,
}: {
  trip: HomeTripSummary;
  readiness: number;
  onOpen(): void;
}) {
  const countdown = daysUntil(trip.startDate);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${trip.name}`} onPress={onOpen} style={({ pressed }) => [styles.tripCard, pressed && styles.pressed]}>
      <Image source={tripCoverSource({ name: trip.name, destination: trip.destination, coverImageUrl: trip.imageUrl }, 0)} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(22,26,55,0.06)", "rgba(22,26,55,0.65)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.tripContent}>
        <Text style={styles.tripEyebrow}>{countdown !== null && countdown <= 0 ? "ACTIVE TRIP" : "UPCOMING TRIP"}</Text>
        <Text numberOfLines={1} style={styles.tripTitle}>{trip.destination || trip.name}</Text>
        <Text style={styles.tripDate}>{formatTripDate(trip.startDate, trip.endDate)}</Text>
        <View style={styles.tripChips}>
          {countdown !== null && countdown > 0 ? <View style={styles.tripChip}><Ionicons name="time-outline" size={13} color="#FFFFFF" /><Text style={styles.tripChipText}>{countdown} days away</Text></View> : null}
          <View style={styles.tripChip}><Ionicons name="people-outline" size={13} color="#FFFFFF" /><Text style={styles.tripChipText}>{Math.max(1, trip.memberCount)} traveler{Math.max(1, trip.memberCount) === 1 ? "" : "s"}</Text></View>
        </View>
        <View style={styles.readinessRow}>
          <View style={styles.readinessCopy}><Text style={styles.readinessLabel}>Trip readiness</Text><View style={styles.readinessTrack}><LinearGradient colors={["#F05AB2", "#7D8CFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.readinessFill, { width: `${readiness}%` }]} /></View></View>
          <Text style={styles.readinessValue}>{readiness}%</Text>
        </View>
        <View style={styles.viewItinerary}><Text style={styles.viewItineraryText}>View itinerary</Text><Ionicons name="chevron-forward" size={18} color="#6E54DF" /></View>
      </View>
    </Pressable>
  );
}

export function EmptyTripCard({ onPlan }: { onPlan(): void }) {
  return (
    <LinearGradient colors={["#F6F1FF", "#EEF5FF", "#FFF2F7"]} style={styles.emptyTrip}>
      <SoftIcon icon="airplane-outline" colors={["#81A6FF", "#A273F2", "#F487B7"]} size={58} />
      <View style={styles.emptyTripCopy}><Text style={styles.emptyTripTitle}>Ready for your next adventure?</Text><Text style={styles.emptyTripText}>Create a trip and TRAVA will turn Home into a live planning command center.</Text></View>
      <Pressable accessibilityRole="button" onPress={onPlan} style={styles.planTripButton}><Text style={styles.planTripText}>Plan a trip</Text></Pressable>
    </LinearGradient>
  );
}

function PulseCard({
  icon,
  colors,
  value,
  label,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string, ...string[]];
  value: string;
  label: string;
  detail: string;
  onPress?(): void;
}) {
  const body = (
    <View style={styles.pulseCard}>
      <SoftIcon icon={icon} colors={colors} size={46} />
      <Text numberOfLines={1} style={styles.pulseValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.pulseLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.pulseDetail}>{detail}</Text>
    </View>
  );
  if (!onPress) return <View style={styles.pulseSlot}>{body}</View>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pulseSlot, pressed && styles.pressed]}>{body}</Pressable>;
}

export function TravelPulse({
  trip,
  checklistTotal,
  checklistCompleted,
  documentCount,
  onChecklist,
  onDocuments,
  onBudget,
  onTrip,
}: {
  trip: HomeTripSummary;
  checklistTotal: number;
  checklistCompleted: number;
  documentCount: number;
  onChecklist(): void;
  onDocuments(): void;
  onBudget(): void;
  onTrip(): void;
}) {
  const budgetRemaining = Math.max(0, trip.totalBudget - trip.spent);
  const budgetPercent = trip.totalBudget > 0 ? Math.round((budgetRemaining / trip.totalBudget) * 100) : 0;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
  const countdown = daysUntil(trip.startDate);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>TRAVEL PULSE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pulseRow}>
        <PulseCard icon="calendar-outline" colors={["#FF7EA0", "#F19ACD", "#839CF5"]} value={countdown === null ? "Dates" : countdown <= 0 ? "Now" : `${countdown}d`} label="Trip timing" detail={trip.startDate ? formatTripDate(trip.startDate, trip.endDate) : "Set your dates"} onPress={onTrip} />
        <PulseCard icon="checkmark-done-outline" colors={["#A77BEA", "#8F7CE6", "#75A9F1"]} value={checklistTotal ? `${checklistPercent}%` : "Start"} label="Checklist" detail={checklistTotal ? `${checklistCompleted} of ${checklistTotal} completed` : "Build your travel checklist"} onPress={onChecklist} />
        <PulseCard icon="documents-outline" colors={["#63B6EA", "#78A5ED", "#A779E4"]} value={documentCount ? `${documentCount}` : "Add"} label="Documents" detail={documentCount ? `${documentCount} saved securely` : "Passport, tickets & more"} onPress={onDocuments} />
        <PulseCard icon="wallet-outline" colors={["#FF9A63", "#F784A5", "#AF79E7"]} value={trip.totalBudget > 0 ? `${budgetPercent}%` : "Set"} label="Budget left" detail={trip.totalBudget > 0 ? formatMoney(budgetRemaining, trip.currencyCode) : "Create a trip budget"} onPress={onBudget} />
        <PulseCard icon="people-outline" colors={["#6FAAF0", "#8389ED", "#C47EE0"]} value={`${Math.max(1, trip.memberCount)}`} label="Travelers" detail="People on this trip" onPress={onTrip} />
      </ScrollView>
    </View>
  );
}

export function AiConciergeCard({
  trip,
  checklistTotal,
  checklistCompleted,
  documentCount,
  onAskAi,
  onItinerary,
}: {
  trip: HomeTripSummary;
  checklistTotal: number;
  checklistCompleted: number;
  documentCount: number;
  onAskAi(): void;
  onItinerary(): void;
}) {
  const budgetRatio = trip.totalBudget > 0 ? trip.spent / trip.totalBudget : 0;
  let headline = `Make ${trip.destination || trip.name} easier to manage.`;
  let detail = "TRAVA AI can review your current trip context and help you spot planning gaps before departure.";
  if (budgetRatio >= 0.8) {
    headline = "Your trip budget is getting tight.";
    detail = `You've used ${Math.round(budgetRatio * 100)}% of your tracked budget. Ask TRAVA AI for lower-cost alternatives before adding more activities.`;
  } else if (checklistTotal > checklistCompleted) {
    headline = `${checklistTotal - checklistCompleted} checklist item${checklistTotal - checklistCompleted === 1 ? "" : "s"} still need attention.`;
    detail = "TRAVA AI can help prioritize what to finish first based on how soon your trip starts.";
  } else if (documentCount === 0) {
    headline = "Your document vault is still empty.";
    detail = "Before departure, add the documents you rely on most so your trip workspace stays complete.";
  }
  return (
    <LinearGradient colors={["rgba(250,245,255,0.98)", "rgba(243,247,255,0.98)", "rgba(255,244,250,0.98)"]} style={styles.aiCard}>
      <LinearGradient colors={["#F3C7EB", "#C8BDF5", "#A9D2FA"]} style={styles.aiOrb}><View style={styles.aiFace}><View style={styles.aiEyeRow}><View style={styles.aiEye} /><View style={styles.aiEye} /></View><View style={styles.aiSmile} /></View><Ionicons name="sparkles" size={13} color="#FFFFFF" style={styles.aiSparkle} /></LinearGradient>
      <View style={styles.aiCopy}>
        <Text style={styles.aiEyebrow}>TRAVA AI CONCIERGE</Text>
        <Text style={styles.aiTitle}>{headline}</Text>
        <Text style={styles.aiText}>{detail}</Text>
        <View style={styles.aiActions}>
          <Pressable accessibilityRole="button" onPress={onAskAi} style={({ pressed }) => [styles.aiPrimary, pressed && styles.pressed]}><LinearGradient colors={["#A690E7", "#91A8EA", "#89BFF1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiPrimaryGradient}><Text style={styles.aiPrimaryText}>Ask TRAVA AI</Text><Ionicons name="sparkles" size={15} color="#FFFFFF" /></LinearGradient></Pressable>
          <Pressable accessibilityRole="button" onPress={onItinerary} style={({ pressed }) => [styles.aiSecondary, pressed && styles.pressed]}><Text style={styles.aiSecondaryText}>Review itinerary</Text></Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}


export function PlanningShortcuts({ onOpen }: { onOpen(key: PlanningToolKey): void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>CONTINUE PLANNING</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shortcutRow}
      >
        {PLANNING_TOOLS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.subtitle}`}
            onPress={() => onOpen(item.key)}
            style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
          >
            <SoftIcon icon={item.icon} colors={item.colors} size={62} />
            <Text style={styles.shortcutText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function TodaySuggestions({ tours, onViewAll, onView }: { tours: HomeTourPackage[]; onViewAll(): void; onView(tour: HomeTourPackage): void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionEyebrow}>TODAY'S SUGGESTIONS</Text><Pressable accessibilityRole="button" onPress={onViewAll}><Text style={styles.viewAllText}>View all ›</Text></Pressable></View>
      {tours.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>{tours.slice(0, 5).map((tour) => <Pressable key={String(tour.id)} accessibilityRole="button" onPress={() => onView(tour)} style={({ pressed }) => [styles.suggestionCard, pressed && styles.pressed]}>{tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={styles.suggestionImage} /> : <LinearGradient colors={["#DDEBFF", "#F3E7FF", "#FFE7F0"]} style={styles.suggestionImageFallback}><Ionicons name="compass-outline" size={25} color="#7256DF" /></LinearGradient>}<View style={styles.suggestionCopy}><Text style={styles.suggestionCategory}>{(tour.category || "EXPERIENCE").toUpperCase()}</Text><Text numberOfLines={1} style={styles.suggestionTitle}>{tour.title}</Text><Text numberOfLines={1} style={styles.suggestionPlace}>{tour.destination || tour.country || "Travel experience"}</Text></View><View style={styles.suggestionPlus}><Ionicons name="chevron-forward" size={17} color="#7256DF" /></View></Pressable>)}</ScrollView> : <Pressable accessibilityRole="button" onPress={onViewAll} style={styles.noSuggestions}><View><Text style={styles.noSuggestionsTitle}>No trip-matched suggestions yet</Text><Text style={styles.noSuggestionsText}>Explore places and packages, then TRAVA can surface options that fit your destination.</Text></View><Ionicons name="compass-outline" size={25} color="#7358DF" /></Pressable>}
    </View>
  );
}

export function BudgetSnapshot({ trip, onOpen }: { trip: HomeTripSummary; onOpen(): void }) {
  const used = Math.max(0, trip.spent);
  const remaining = Math.max(0, trip.totalBudget - used);
  const percent = trip.totalBudget > 0 ? Math.min(100, Math.round((used / trip.totalBudget) * 100)) : 0;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>BUDGET SNAPSHOT</Text>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.budgetCard, pressed && styles.pressed]}>
        <SoftIcon icon="wallet-outline" colors={["#FF7FA2", "#A17CE9", "#67B7EE"]} size={58} />
        <View style={styles.budgetCopy}>
          <View style={styles.budgetValues}><View><Text style={styles.budgetLabel}>Total Budget</Text><Text style={styles.budgetValue}>{formatMoney(trip.totalBudget, trip.currencyCode)}</Text></View><View><Text style={styles.budgetLabel}>Used</Text><Text style={styles.budgetValue}>{formatMoney(used, trip.currencyCode)}</Text></View><View><Text style={[styles.budgetLabel, styles.remainingLabel]}>Remaining</Text><Text style={[styles.budgetValue, styles.remainingValue]}>{formatMoney(remaining, trip.currencyCode)}</Text></View></View>
          <View style={styles.budgetProgressRow}><View style={styles.budgetTrack}><LinearGradient colors={["#F051B0", "#7B8DF8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.budgetFill, { width: `${percent}%` }]} /></View><Text style={styles.budgetPercent}>{percent}% used</Text></View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.76, transform: [{ scale: 0.992 }] },
  section: { marginTop: 24 },
  sectionEyebrow: { color: "#7454DE", fontSize: 10, letterSpacing: 0.9, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewAllText: { color: "#7358DF", fontSize: 10, fontWeight: "800" },
  softIcon: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 0, backgroundColor: "transparent", boxShadow: "0 9px 20px rgba(82,75,155,0.20)" },
  softHighlight: { position: "absolute", width: "70%", height: "32%", borderRadius: 20, top: 4, left: 7, backgroundColor: "rgba(255,255,255,0.22)" },
  tripCard: { minHeight: 255, marginTop: 18, borderRadius: 29, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "#EAE9F7", boxShadow: "0 16px 36px rgba(46,44,89,0.11)" },
  tripContent: { minHeight: 255, justifyContent: "flex-end", padding: 20 },
  tripEyebrow: { color: "#FFDAEF", fontSize: 9.5, letterSpacing: 0.7, fontWeight: "900" },
  tripTitle: { marginTop: 5, color: "#FFFFFF", fontSize: 27, lineHeight: 31, fontWeight: "900", letterSpacing: -0.7 },
  tripDate: { marginTop: 5, color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "600" },
  tripChips: { marginTop: 10, flexDirection: "row", gap: 7 },
  tripChip: { minHeight: 29, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 14, backgroundColor: "rgba(33,29,64,0.36)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  tripChipText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  readinessRow: { marginTop: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  readinessCopy: { flex: 1 },
  readinessLabel: { color: "rgba(255,255,255,0.92)", fontSize: 9.5, fontWeight: "700" },
  readinessTrack: { height: 6, marginTop: 6, overflow: "hidden", borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)" },
  readinessFill: { height: "100%", borderRadius: 4 },
  readinessValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  viewItinerary: { position: "absolute", right: 16, top: 18, minHeight: 43, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.93)" },
  viewItineraryText: { color: "#6D53DF", fontSize: 10.5, fontWeight: "900" },
  emptyTrip: { minHeight: 145, marginTop: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.94)" },
  emptyTripCopy: { flex: 1 },
  emptyTripTitle: { color: "#17203F", fontSize: 16, lineHeight: 20, fontWeight: "900" },
  emptyTripText: { marginTop: 5, color: "#6F7892", fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
  planTripButton: { position: "absolute", right: 18, bottom: 15, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 14, backgroundColor: "#7057DF" },
  planTripText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  pulseRow: { width: "100%", minWidth: 720, flexGrow: 1, gap: 12, paddingTop: 10, paddingRight: 0 },
  pulseSlot: { minWidth: 138, flexGrow: 1, flexBasis: 0 },
  pulseCard: { width: "100%", minHeight: 154, padding: 14, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.98)", backgroundColor: "rgba(255,255,255,0.82)", boxShadow: "0 10px 26px rgba(72,65,130,0.06)" },
  pulseValue: { marginTop: 10, color: "#18203E", fontSize: 15, fontWeight: "900" },
  pulseLabel: { marginTop: 2, color: "#303858", fontSize: 9.5, fontWeight: "800" },
  pulseDetail: { marginTop: 6, color: "#747B96", fontSize: 8.5, lineHeight: 12, fontWeight: "600" },
  aiCard: { minHeight: 190, marginTop: 24, padding: 18, flexDirection: "row", gap: 16, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.98)", boxShadow: "0 16px 38px rgba(87,70,153,0.10)" },
  aiOrb: { width: 83, height: 83, borderRadius: 31, alignItems: "center", justifyContent: "center", boxShadow: "0 13px 26px rgba(111,85,223,0.24)" },
  aiFace: { width: 51, height: 51, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.9)" },
  aiEyeRow: { flexDirection: "row", gap: 11, marginTop: 2 },
  aiEye: { width: 6, height: 9, borderRadius: 4, backgroundColor: "#E35BA9" },
  aiSmile: { width: 19, height: 9, marginTop: 7, borderBottomWidth: 3, borderColor: "#E35BA9", borderRadius: 10 },
  aiSparkle: { position: "absolute", right: 8, top: 8 },
  aiCopy: { flex: 1, minWidth: 0 },
  aiEyebrow: { color: "#7556DF", fontSize: 9.5, letterSpacing: 1, fontWeight: "900" },
  aiTitle: { marginTop: 7, color: "#18203F", fontSize: 14, lineHeight: 19, fontWeight: "900" },
  aiText: { marginTop: 5, color: "#5F6886", fontSize: 10.5, lineHeight: 15.5, fontWeight: "500" },
  aiActions: { marginTop: 14, flexDirection: "row", gap: 9 },
  aiPrimary: { flex: 1, borderRadius: 18, overflow: "hidden" },
  aiPrimaryGradient: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 },
  aiPrimaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  aiSecondary: { minHeight: 42, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1, borderColor: "#D7CFF4", backgroundColor: "rgba(255,255,255,0.72)" },
  aiSecondaryText: { color: "#6D55D7", fontSize: 9.5, fontWeight: "900" },
  shortcutRow: { width: "100%", minWidth: 690, flexGrow: 1, gap: 12, paddingTop: 10, paddingRight: 0 },
  shortcutCard: { minWidth: 126, flexGrow: 1, flexBasis: 0, minHeight: 128, alignItems: "center", justifyContent: "center", gap: 11, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.98)", backgroundColor: "rgba(255,255,255,0.82)", boxShadow: "0 10px 25px rgba(70,63,126,0.055)" },
  shortcutText: { color: "#252D4D", fontSize: 9.5, fontWeight: "900" },
  suggestionsRow: { gap: 10, paddingTop: 10, paddingRight: 20 },
  suggestionCard: { width: 235, minHeight: 92, flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderRadius: 23, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.72)" },
  suggestionImage: { width: 75, height: 72, borderRadius: 17, backgroundColor: "#E7EAF2" },
  suggestionImageFallback: { width: 75, height: 72, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  suggestionCopy: { flex: 1, minWidth: 0 },
  suggestionCategory: { color: "#7455DF", fontSize: 8, letterSpacing: 0.4, fontWeight: "900" },
  suggestionTitle: { marginTop: 5, color: "#202744", fontSize: 10.5, fontWeight: "900" },
  suggestionPlace: { marginTop: 3, color: "#747B96", fontSize: 8.5, fontWeight: "600" },
  suggestionPlus: { width: 29, height: 29, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DDD5F7", backgroundColor: "#F8F6FF" },
  noSuggestions: { minHeight: 92, marginTop: 10, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.68)", borderWidth: 1, borderColor: "rgba(255,255,255,0.95)" },
  noSuggestionsTitle: { color: "#202744", fontSize: 11, fontWeight: "900" },
  noSuggestionsText: { maxWidth: 300, marginTop: 4, color: "#747B96", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  budgetCard: { minHeight: 125, marginTop: 10, padding: 15, flexDirection: "row", alignItems: "center", gap: 15, borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.74)", boxShadow: "0 12px 30px rgba(70,63,126,0.07)" },
  budgetCopy: { flex: 1, minWidth: 0 },
  budgetValues: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  budgetLabel: { color: "#69718D", fontSize: 8.5, fontWeight: "600" },
  budgetValue: { marginTop: 3, color: "#1D2442", fontSize: 12, fontWeight: "900" },
  remainingLabel: { color: "#35A56D" },
  remainingValue: { color: "#28A968" },
  budgetProgressRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  budgetTrack: { flex: 1, height: 7, overflow: "hidden", borderRadius: 5, backgroundColor: "#ECEAF4" },
  budgetFill: { height: "100%", borderRadius: 5 },
  budgetPercent: { color: "#545D7A", fontSize: 8.5, fontWeight: "800" },
});
