import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTripSummary } from "../../types/home.types";
import type { WorkspaceState } from "@/features/trips/hooks/useLocalTripWorkspace";

interface ConciergeState {
  title: string;
  body: string;
  primaryLabel: string;
  route: "documents" | "checklist" | "budget" | "trip";
  detail: string;
}

function daysUntil(startDate: string | null | undefined) {
  if (!startDate) return Number.POSITIVE_INFINITY;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? `${startDate}T12:00:00` : startDate);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((parsed.getTime() - Date.now()) / 86_400_000);
}

export function getConciergeState(trip: HomeTripSummary | null, workspace: WorkspaceState | null): ConciergeState {
  if (!trip) {
    return {
      title: "Your next trip is waiting.",
      body: "Create a trip and TRAVA AI will surface the most useful next step here.",
      primaryLabel: "Create a Trip",
      route: "trip",
      detail: "Once a trip exists, this card adapts to your documents, checklist, budget, and departure timing.",
    };
  }

  const docs = workspace?.documents ?? [];
  const hasBoardingPass = docs.some((doc) => /boarding|pass|ticket|flight/i.test(`${doc.title} ${doc.type}`));
  const until = daysUntil(trip.startDate);
  if (until <= 2 && until >= 0 && !hasBoardingPass) {
    return {
      title: "Your boarding pass is not saved yet.",
      body: "Departure is close. Add your boarding pass or flight ticket so it stays with this trip.",
      primaryLabel: "Add Boarding Pass",
      route: "documents",
      detail: "TRAVA keeps the travel document in the trip workspace so it remains easy to reach before boarding.",
    };
  }

  if (!docs.length) {
    return {
      title: "Your document vault is still empty.",
      body: "Before departure, add your documents so you can travel worry-free.",
      primaryLabel: "Add Travel Documents",
      route: "documents",
      detail: "Keep reservations, tickets, IDs, insurance files, and other travel documents together inside the active trip.",
    };
  }

  const checklist = workspace?.checklist ?? [];
  const openCount = checklist.filter((item) => !item.completed).length;
  if (openCount > 0) {
    return {
      title: `${openCount} checklist ${openCount === 1 ? "item needs" : "items need"} attention.`,
      body: "Finish the remaining essentials and your readiness score will update automatically.",
      primaryLabel: "Open Checklist",
      route: "checklist",
      detail: "Travel Pulse reacts to completed checklist items, so finishing these tasks directly improves readiness.",
    };
  }

  if ((workspace?.totalBudget ?? trip.totalBudget) <= 0) {
    return {
      title: "Your trip budget is not set yet.",
      body: "Add a spending plan now so you can track the trip without surprises.",
      primaryLabel: "Set Up Budget",
      route: "budget",
      detail: "A trip budget gives TRAVA enough context to show remaining funds and keep expenses visible during planning.",
    };
  }

  return {
    title: "You’re almost travel-ready.",
    body: "Your core trip setup looks good. Review your itinerary one more time before departure.",
    primaryLabel: "Review Trip",
    route: "trip",
    detail: "TRAVA will continue watching your checklist, documents, collaborators, and trip timing for useful next steps.",
  };
}

interface PremiumConciergeCardProps {
  state: ConciergeState;
  infoOpen: boolean;
  onInfoOpen(): void;
  onInfoClose(): void;
  onPrimaryPress(state: ConciergeState): void;
}

export function PremiumConciergeCard({ state, infoOpen, onInfoOpen, onInfoClose, onPrimaryPress }: PremiumConciergeCardProps) {
  return (
    <>
      <LinearGradient colors={["#FAF8FF", "#FFF7FC"]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={styles.card}>
        <Image source={require("../../assets/premium-home/concierge-icon.png")} contentFit="cover" style={styles.icon} />
        <View style={styles.content}>
          <Text style={styles.eyebrow}>TRAVA AI CONCIERGE</Text>
          <Text numberOfLines={2} style={styles.title}>{state.title}</Text>
          <Text numberOfLines={2} style={styles.body}>{state.body}</Text>
          <View style={styles.buttons}>
            <Pressable onPress={() => onPrimaryPress(state)} style={({ pressed }) => [styles.primaryWrap, pressed && styles.pressed]}>
              <LinearGradient colors={["#6A58FF", "#6FA9FF"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primary}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.primaryText}>{state.primaryLabel}　✦</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={onInfoOpen} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>Learn more</Text></Pressable>
          </View>
        </View>
      </LinearGradient>

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={onInfoClose}>
        <Pressable style={styles.modalBackdrop} onPress={onInfoClose}>
          <Pressable onPress={() => undefined} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetIcon}><Ionicons name="sparkles" size={22} color="#6E60F6" /></View>
            <Text style={styles.sheetEyebrow}>TRAVA AI CONCIERGE</Text>
            <Text style={styles.sheetTitle}>{state.title}</Text>
            <Text style={styles.sheetBody}>{state.detail}</Text>
            <Pressable onPress={onInfoClose} style={styles.doneButton}><Text style={styles.doneText}>Got it</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export type { ConciergeState };

const styles = StyleSheet.create({
  card: { marginTop: 15, borderRadius: 25, padding: 13, flexDirection: "row", alignItems: "flex-start", borderWidth: 1, borderColor: "#EEE8FA", overflow: "hidden" },
  icon: { width: 66, height: 66, borderRadius: 19 },
  content: { flex: 1, minWidth: 0, paddingLeft: 10 },
  eyebrow: { color: "#6B60F3", fontSize: 8.5, lineHeight: 11, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 4, color: "#141C38", fontSize: 13.5, lineHeight: 17, fontWeight: "900" },
  body: { marginTop: 2, color: "#58637D", fontSize: 9.5, lineHeight: 13.5, fontWeight: "600" },
  buttons: { marginTop: 10, flexDirection: "row", gap: 8 },
  primaryWrap: { flex: 1, minWidth: 0 },
  primary: { height: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  secondary: { width: 103, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DAD5F0" },
  secondaryText: { color: "#675BF0", fontSize: 10.5, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(18,22,42,0.28)", justifyContent: "flex-end", padding: 14 },
  sheet: { width: "100%", maxWidth: 430, alignSelf: "center", borderRadius: 28, backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "#E2E3EA", marginBottom: 16 },
  sheetIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F2EFFF" },
  sheetEyebrow: { marginTop: 13, color: "#6B60F3", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  sheetTitle: { marginTop: 6, color: "#141C38", fontSize: 21, lineHeight: 27, fontWeight: "900" },
  sheetBody: { marginTop: 8, color: "#5F6981", fontSize: 13, lineHeight: 20, fontWeight: "600" },
  doneButton: { marginTop: 18, height: 48, borderRadius: 18, backgroundColor: "#6B5AF4", alignItems: "center", justifyContent: "center" },
  doneText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
