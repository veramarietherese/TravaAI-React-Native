import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type HomeQuickActionKey = "itinerary" | "budget" | "expenses" | "checklist" | "documents";

interface QuickActionsProps {
  onPress(action: HomeQuickActionKey): void;
}

const ACTIONS = [
  { key: "itinerary", title: "Itinerary", subtitle: "Plan every stop", glyph: "▦", tone: "violet" },
  { key: "budget", title: "Budget", subtitle: "Track your plan", glyph: "▣", tone: "mint" },
  { key: "expenses", title: "Expenses", subtitle: "Split shared costs", glyph: "₱", tone: "peach" },
  { key: "checklist", title: "Checklist", subtitle: "Stay organized", glyph: "✓", tone: "purple" },
  { key: "documents", title: "Documents", subtitle: "Private device vault", glyph: "▱", tone: "blue" },
] as const;

const TONES = {
  violet: { card: "#F4F0FF", icon: "#D8C8FF", text: "#6548DA" },
  mint: { card: "#ECFBF4", icon: "#B8F0D5", text: "#27825C" },
  peach: { card: "#FFF3EA", icon: "#FFD4AF", text: "#B96526" },
  purple: { card: "#F6EEFF", icon: "#DCBEFF", text: "#7A46C8" },
  blue: { card: "#EDF7FF", icon: "#B9E0FF", text: "#286B9D" },
} as const;

export function QuickActions({ onPress }: QuickActionsProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  return (
    <View style={styles.root}>
      {ACTIONS.map((action, index) => {
        const tone = TONES[action.tone];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${action.title}. ${action.subtitle}`}
            key={action.key}
            onPress={() => onPress(action.key)}
            style={({ pressed }: { pressed: boolean }) => [
              styles.card,
              { backgroundColor: tone.card },
              wide ? styles.cardWide : styles.cardPhone,
              !wide && index === ACTIONS.length - 1 && styles.cardLast,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.icon, { backgroundColor: tone.icon }]}>
              <Text style={[styles.glyph, { color: tone.text }]}>{action.glyph}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{action.title}</Text>
              <Text numberOfLines={2} style={styles.subtitle}>{action.subtitle}</Text>
            </View>
            <Text style={[styles.chevron, { color: tone.text }]}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
  },
  cardPhone: { width: "48.2%", flexGrow: 1 },
  cardLast: { width: "100%" },
  cardWide: { flex: 1, minWidth: 140 },
  icon: { width: 45, height: 45, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 21, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: "#1A2743", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  subtitle: { marginTop: 3, color: "#78849A", fontSize: 9, lineHeight: 13, fontWeight: "600" },
  chevron: { fontSize: 21, fontWeight: "700" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
