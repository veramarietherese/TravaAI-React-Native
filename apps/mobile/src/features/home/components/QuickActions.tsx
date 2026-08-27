import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type HomeQuickActionKey = "itinerary" | "budget" | "expenses" | "checklist" | "documents";
type IconName = ComponentProps<typeof Ionicons>["name"];
interface QuickActionsProps { onPress(action: HomeQuickActionKey): void; }
type Action = { key: HomeQuickActionKey; title: string; subtitle: string; icon: IconName; colors: readonly [string, string]; iconColor: string };
const ACTIONS: Action[] = [
  { key: "itinerary", title: "Itinerary", subtitle: "View your plans", icon: "calendar-outline", colors: ["#FFE7EF", "#F7BED2"], iconColor: "#C96D90" },
  { key: "budget", title: "Budget", subtitle: "Track your budget", icon: "wallet-outline", colors: ["#E7F6FF", "#BFDFF7"], iconColor: "#5A94C7" },
  { key: "expenses", title: "Expenses", subtitle: "Add & manage", icon: "receipt-outline", colors: ["#FFF0E2", "#F7C99F"], iconColor: "#C9854F" },
  { key: "checklist", title: "Checklist", subtitle: "Stay organized", icon: "list-outline", colors: ["#F3ECFF", "#D9C5F4"], iconColor: "#8C70C8" },
  { key: "documents", title: "Documents", subtitle: "Travel docs", icon: "folder-outline", colors: ["#E9F6FF", "#C3E0F5"], iconColor: "#5B96C9" },
];

export function QuickActions({ onPress }: QuickActionsProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  return <View style={s.root}>{ACTIONS.map((action, index) => <Pressable key={action.key} accessibilityRole="button" accessibilityLabel={`${action.title}. ${action.subtitle}`} onPress={() => onPress(action.key)} style={({ pressed }) => [s.card, wide ? s.cardWide : s.cardPhone, !wide && index === ACTIONS.length - 1 && s.cardLast, pressed && s.pressed]}>
    <View style={s.copy}><Text style={s.title}>{action.title}</Text><Text style={s.subtitle}>{action.subtitle}</Text></View>
    <LinearGradient colors={action.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.icon}><View style={[s.softHighlight, { pointerEvents: "none" }]}/><Ionicons name={action.icon} size={27} color={action.iconColor}/></LinearGradient>
  </Pressable>)}</View>;
}
const s = StyleSheet.create({
  root: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, card: { minHeight: 112, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 25, backgroundColor: "#FFFFFF", boxShadow: "0 10px 24px rgba(43,55,78,.055)" }, cardPhone: { width: "48.2%", flexGrow: 1 }, cardLast: { width: "100%" }, cardWide: { flex: 1, minWidth: 175 }, copy: { flex: 1, minWidth: 0 }, title: { color: "#171C29", fontSize: 14, lineHeight: 18, fontWeight: "900" }, subtitle: { marginTop: 5, color: "#7C8492", fontSize: 10, lineHeight: 14, fontWeight: "700" }, icon: { width: 60, height: 60, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", boxShadow: "0 9px 20px rgba(55,68,94,.10)" }, softHighlight: { position: "absolute", left: 9, right: 9, top: 7, height: 17, borderRadius: 10, backgroundColor: "rgba(255,255,255,.34)" }, pressed: { opacity: .76, transform: [{ scale: .987 }] },
});
