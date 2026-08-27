import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type HomeQuickActionKey = "itinerary" | "budget" | "expenses" | "checklist" | "documents";
type IconName = ComponentProps<typeof Ionicons>["name"];

interface QuickActionsProps { onPress(action: HomeQuickActionKey): void; }

type Action = { key: HomeQuickActionKey; title: string; subtitle: string; icon: IconName; base: string; tint: string; tilt: number };
const ACTIONS: Action[] = [
  { key: "itinerary", title: "Itinerary", subtitle: "View your plans", icon: "calendar-outline", base: "#FF8FA7", tint: "#FFB5C4", tilt: -4 },
  { key: "budget", title: "Budget", subtitle: "Track your budget", icon: "wallet-outline", base: "#6BD7A5", tint: "#A6EBCB", tilt: 3 },
  { key: "expenses", title: "Expenses", subtitle: "Add & manage", icon: "receipt-outline", base: "#FFB066", tint: "#FFD0A2", tilt: -3 },
  { key: "checklist", title: "Checklist", subtitle: "Stay organized", icon: "list-outline", base: "#A875EC", tint: "#CFB0F5", tilt: 4 },
  { key: "documents", title: "Documents", subtitle: "Travel docs", icon: "folder-outline", base: "#76B7EA", tint: "#AED7F5", tilt: -3 },
];

export function QuickActions({ onPress }: QuickActionsProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  return <View style={styles.root}>{ACTIONS.map((action, index) => (
    <Pressable
      key={action.key}
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.subtitle}`}
      onPress={() => onPress(action.key)}
      style={({ pressed }) => [styles.card, wide ? styles.cardWide : styles.cardPhone, !wide && index === ACTIONS.length - 1 && styles.cardLast, pressed && styles.pressed]}
    >
      <View style={styles.copy}><Text style={styles.title}>{action.title}</Text><Text style={styles.subtitle}>{action.subtitle}</Text></View>
      <View style={[styles.iconShadow, { transform: [{ rotate: `${action.tilt}deg` }] }]}> 
        <View style={[styles.icon, { backgroundColor: action.base }]}>
          <View style={[styles.iconTint, { backgroundColor: action.tint }]} />
          <View style={styles.highlight}/>
          <Ionicons name={action.icon} size={26} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  ))}</View>;
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { minHeight: 108, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#E2E3E6", borderRadius: 24, backgroundColor: "#FFFFFF", boxShadow: "0 10px 24px rgba(25,27,31,.055)" },
  cardPhone: { width: "48.2%", flexGrow: 1 }, cardLast: { width: "100%" }, cardWide: { flex: 1, minWidth: 170 },
  copy: { flex: 1, minWidth: 0 }, title: { color: "#17191E", fontSize: 13, lineHeight: 17, fontWeight: "900" }, subtitle: { marginTop: 4, color: "#777D87", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  iconShadow: { borderRadius: 18, boxShadow: "0 10px 18px rgba(38,39,43,.13)" },
  icon: { width: 58, height: 58, overflow: "hidden", borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.9)" },
  iconTint: { ...StyleSheet.absoluteFillObject, opacity: .55 }, highlight: { position: "absolute", left: 8, right: 8, top: 7, height: 16, borderRadius: 10, backgroundColor: "rgba(255,255,255,.33)" },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
});
