import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface HomeMessagesStripProps {
  onPress(): void;
}

export function HomeMessagesStrip({ onPress }: HomeMessagesStripProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open travel messages"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={["rgba(240,247,255,0.94)", "rgba(255,255,255,0.97)", "rgba(255,241,248,0.92)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.glass}
      >
        <View style={styles.iconBubble}>
          <View style={styles.chatOutline}>
            <View style={styles.dotRow}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>TRAVEL MESSAGES</Text>
          <Text style={styles.title}>Continue your agency conversations</Text>
          <Text style={styles.subtitle}>Ask about packages, dates, prices, and itinerary details.</Text>
        </View>

        <View style={styles.openButton}>
          <Text style={styles.openText}>Open</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    marginTop: 14,
    marginBottom: 12,
    borderRadius: 22,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.997 }] },
  glass: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 32px rgba(80, 101, 145, 0.09)",
  },
  iconBubble: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(226,238,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  chatOutline: {
    width: 25,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#5C6DE7",
    borderRadius: 8,
  },
  dotRow: { flexDirection: "row", gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#5C6DE7" },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#6A6FE5", fontSize: 9, letterSpacing: 1.1, fontWeight: "900" },
  title: { marginTop: 3, color: "#17233E", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  subtitle: { marginTop: 3, color: "#7B879C", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  openButton: {
    minWidth: 64,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(222,229,244,0.95)",
  },
  openText: { color: "#5568D9", fontSize: 10, fontWeight: "900" },
  chevron: { color: "#5568D9", fontSize: 18, lineHeight: 18, fontWeight: "700" },
});
