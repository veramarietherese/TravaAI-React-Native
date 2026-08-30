import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { getTravelMood } from "../../utils/premium-home-readiness";

const MASCOT_ASSETS = {
  worried: require("../../assets/premium-home/mascot-worried-v2.png"),
  building: require("../../assets/premium-home/mascot-building-v2.png"),
  halfway: require("../../assets/premium-home/mascot-halfway-v2.png"),
  almost: require("../../assets/premium-home/mascot-almost-v2.png"),
  ready: require("../../assets/premium-home/mascot-ready-v2.png"),
} as const;

export function PremiumTravelPulse({ readiness }: { readiness: number }) {
  const safeReadiness = Math.max(0, Math.min(100, Math.round(readiness)));
  const mood = getTravelMood(safeReadiness);

  return (
    <View pointerEvents="none">
      <LinearGradient
        colors={["#FAFCFF", "#FFF5FB"]}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.card}
      >
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>TRAVEL PULSE</Text>
          <Text style={styles.title}>
            You’re <Text style={styles.accent}>{safeReadiness}%</Text> ready
          </Text>
          <Text style={styles.subtitle}>{mood.subtitle}</Text>

          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Travel readiness ${safeReadiness} percent`}
            accessibilityValue={{ min: 0, max: 100, now: safeReadiness }}
            style={styles.progressTrack}
          >
            <LinearGradient
              colors={["#765DFF", "#6EA3FF"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.progressFill, { width: `${safeReadiness}%` }]}
            />
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>0%</Text>
            <Text style={styles.legendText}>100%</Text>
          </View>
        </View>

        <View style={styles.mascotSide}>
          <View style={[styles.orbit, styles.orbitOuter]} />
          <View style={[styles.orbit, styles.orbitMid]} />
          <View style={[styles.orbit, styles.orbitInner]} />
          <Image
            source={MASCOT_ASSETS[mood.key]}
            contentFit="contain"
            contentPosition="center"
            cachePolicy="memory-disk"
            transition={180}
            style={styles.mascot}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    height: 174,
    borderRadius: 27,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(239,234,250,0.86)",
  },
  copy: {
    width: "59%",
    paddingLeft: 17,
    paddingTop: 16,
    paddingBottom: 13,
    zIndex: 2,
  },
  eyebrow: {
    color: "#695EF6",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
    color: "#111A38",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  accent: { color: "#6D5AF8" },
  subtitle: {
    marginTop: 5,
    color: "#53607A",
    fontSize: 11.5,
    lineHeight: 16.5,
    fontWeight: "600",
    maxWidth: 245,
  },
  progressTrack: {
    marginTop: 17,
    width: "100%",
    height: 9,
    borderRadius: 99,
    backgroundColor: "#F0EFF8",
    borderWidth: 1,
    borderColor: "#DEDCF0",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 99 },
  legend: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  legendText: { color: "#2B3555", fontSize: 9.5, fontWeight: "800" },
  mascotSide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
  },
  orbitOuter: { width: 200, height: 200, borderRadius: 100 },
  orbitMid: { width: 158, height: 158, borderRadius: 79 },
  orbitInner: { width: 118, height: 118, borderRadius: 59 },
  mascot: { width: 148, height: 148, marginTop: 7 },
});
