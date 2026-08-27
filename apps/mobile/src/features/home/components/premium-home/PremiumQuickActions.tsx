import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type PremiumQuickActionKey = "create-trip" | "collaborate" | "budget" | "expenses" | "checklist";

const ACTIONS: ReadonlyArray<{ key: PremiumQuickActionKey; label: string; image: number }> = [
  { key: "create-trip", label: "Create Trip", image: require("../../assets/premium-home/quick-create-trip.png") },
  { key: "collaborate", label: "Collaborate", image: require("../../assets/premium-home/quick-collaborate.png") },
  { key: "budget", label: "Budget", image: require("../../assets/premium-home/quick-budget.png") },
  { key: "expenses", label: "Expenses", image: require("../../assets/premium-home/quick-expenses.png") },
  { key: "checklist", label: "Checklist", image: require("../../assets/premium-home/quick-checklist.png") },
];

export function PremiumQuickActions({ onPress }: { onPress(action: PremiumQuickActionKey): void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Quick Actions</Text>
      <Text style={styles.subtitle}>Everything you need, one tap away.</Text>
      <View style={styles.row}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => onPress(action.key)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Image source={action.image} contentFit="contain" style={styles.icon} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.label}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 14 },
  title: { color: "#121A38", fontSize: 17, lineHeight: 21, fontWeight: "900", letterSpacing: -0.25 },
  subtitle: { marginTop: 2, color: "#6C7690", fontSize: 10.5, lineHeight: 14, fontWeight: "600" },
  row: { marginTop: 10, flexDirection: "row", gap: 7 },
  card: { flex: 1, minWidth: 0, minHeight: 115, paddingHorizontal: 5, paddingTop: 10, paddingBottom: 10, alignItems: "center", justifyContent: "space-between", borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EFF0F5", shadowColor: "#8A88AA", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  icon: { width: 62, height: 62 },
  label: { color: "#131B37", fontSize: 9.8, lineHeight: 13, fontWeight: "800", textAlign: "center", width: "100%" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
