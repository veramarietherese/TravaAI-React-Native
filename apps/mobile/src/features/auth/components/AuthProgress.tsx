import { StyleSheet, Text, View } from "react-native";

interface AuthProgressProps {
  steps: readonly string[];
  current: number;
  light?: boolean;
}

export function AuthProgress({ steps, current, light = false }: AuthProgressProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}
      style={styles.container}
    >
      <View style={styles.tiles}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={[
              styles.tile,
              light && styles.lightTile,
              index <= current && styles.completedTile,
              index === current && styles.activeTile,
            ]}
          />
        ))}
      </View>
      <Text numberOfLines={1} style={[styles.label, light && styles.lightLabel]}>
        {steps[current]} · {current + 1} of {steps.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  tiles: { flexDirection: "row", gap: 7 },
  tile: { flex: 1, height: 5, borderRadius: 999, backgroundColor: "rgba(100,116,139,0.22)" },
  lightTile: { backgroundColor: "rgba(255,255,255,0.30)" },
  completedTile: { backgroundColor: "rgba(78,228,238,0.58)" },
  activeTile: { backgroundColor: "#4EE4EE" },
  label: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.35,
  },
  lightLabel: { color: "rgba(255,255,255,0.90)" },
});
