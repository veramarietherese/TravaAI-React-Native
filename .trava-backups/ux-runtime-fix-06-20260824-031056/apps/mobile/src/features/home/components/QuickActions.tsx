import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type HomeQuickActionKey = "itinerary" | "budget" | "expenses" | "checklist" | "documents";
type IconName = ComponentProps<typeof Ionicons>["name"];

interface QuickActionsProps { onPress(action: HomeQuickActionKey): void; }

type Action = { key: HomeQuickActionKey; title: string; subtitle: string; icon: IconName; colors: readonly [string, string, string]; iconColor: string };
const ACTIONS: readonly Action[] = [
  { key: "itinerary", title: "Itinerary", subtitle: "View your plans", icon: "calendar-outline", colors: ["#FFF1F5", "#F8DCE9", "#E9E7FF"], iconColor: "#A45D86" },
  { key: "budget", title: "Budget", subtitle: "Track your budget", icon: "wallet-outline", colors: ["#EEF9F4", "#DCEFE6", "#E8F4FF"], iconColor: "#4F7B69" },
  { key: "expenses", title: "Expenses", subtitle: "Add & manage", icon: "receipt-outline", colors: ["#FFF5EC", "#F6E4D1", "#FFF0F6"], iconColor: "#9C6B48" },
  { key: "checklist", title: "Checklist", subtitle: "Stay organized", icon: "list-outline", colors: ["#F4EEFF", "#E6DEFA", "#EAF3FF"], iconColor: "#725DA4" },
  { key: "documents", title: "Documents", subtitle: "Travel docs", icon: "folder-open-outline", colors: ["#EDF6FF", "#DCEBFC", "#F0EDFF"], iconColor: "#5879AD" },
] as const;

export function QuickActions({ onPress }: QuickActionsProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  return (
    <View style={styles.root}>
      {ACTIONS.map((action, index) => (
        <Pressable key={action.key} accessibilityRole="button" accessibilityLabel={`${action.title}. ${action.subtitle}`} onPress={() => onPress(action.key)}
          style={({ pressed }) => [styles.card, wide ? styles.cardWide : styles.cardPhone, !wide && index === ACTIONS.length - 1 && styles.cardLast, pressed && styles.pressed]}>
          <View style={styles.copy}><Text style={styles.title}>{action.title}</Text><Text style={styles.subtitle}>{action.subtitle}</Text></View>
          <LinearGradient colors={[...action.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
            <View pointerEvents="none" style={styles.highlight} />
            <Ionicons name={action.icon} size={25} color={action.iconColor} />
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { minHeight: 106, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 15, paddingVertical: 14, borderWidth: 1, borderColor: "#E6E9F0", borderRadius: 24, backgroundColor: "rgba(255,255,255,.96)", boxShadow: "0 10px 26px rgba(46,57,86,.07)" },
  cardPhone: { width: "48.2%", flexGrow: 1 }, cardLast: { width: "100%" }, cardWide: { flex: 1, minWidth: 170 },
  copy: { flex: 1, minWidth: 0 }, title: { color: "#18233C", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "#78849A", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  icon: { width: 57, height: 57, overflow: "hidden", borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.95)", boxShadow: "0 9px 20px rgba(58,68,105,.10)" },
  highlight: { position: "absolute", left: 7, right: 7, top: 6, height: 15, borderRadius: 10, backgroundColor: "rgba(255,255,255,.45)" },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
});
