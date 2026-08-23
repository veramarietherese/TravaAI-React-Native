import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export const TRAVA = {
  ink: "#101A35",
  inkSoft: "#24304E",
  muted: "#727D9B",
  purple: "#7C3AED",
  violet: "#8B5CF6",
  pink: "#EC4899",
  coral: "#FF7A6C",
  orange: "#F97316",
  blue: "#5B8CFF",
  mint: "#55CDA0",
  surface: "rgba(255,255,255,0.78)",
  border: "rgba(255,255,255,0.82)",
};

export function GlassCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

export function GradientPill({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <LinearGradient
      colors={["#F759A5", "#C45CFF", "#7657F5"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.gradientPill, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function RoundIconButton({ label, glyph, onPress }: { label: string; glyph: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <Text style={styles.roundGlyph}>{glyph}</Text>
    </Pressable>
  );
}

export function MetricCard({ icon, label, value, accent = "#7C3AED", detail }: { icon: string; label: string; value: string; accent?: string; detail?: string }) {
  return (
    <GlassCard style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}16` }]}><Text style={[styles.metricGlyph, { color: accent }]}>{icon}</Text></View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
        {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
      </View>
    </GlassCard>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>;
}

export function money(value: number, code = "PHP") {
  const numeric = Number(value || 0);
  if (code === "PHP" || code === "₱") return `₱${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${code} ${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatShortDate(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: TRAVA.surface,
    borderWidth: 1,
    borderColor: TRAVA.border,
    boxShadow: "0px 16px 42px rgba(77,65,126,0.10)",
    elevation: 5,
  },
  gradientPill: { alignItems: "center", justifyContent: "center", borderRadius: 999 },
  roundButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.94)",
    backgroundColor: "rgba(255,255,255,0.78)",
    boxShadow: "0px 10px 24px rgba(65,58,103,0.11)",
  },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.82 },
  roundGlyph: { color: TRAVA.ink, fontSize: 19, lineHeight: 22, fontWeight: "800" },
  metricCard: { flex: 1, minWidth: 0, minHeight: 104, borderRadius: 24, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  metricIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  metricGlyph: { fontSize: 22, fontWeight: "800" },
  metricCopy: { flex: 1, minWidth: 0 },
  metricLabel: { color: TRAVA.muted, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  metricValue: { marginTop: 4, color: TRAVA.ink, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  metricDetail: { marginTop: 3, color: TRAVA.muted, fontSize: 10, lineHeight: 14, fontWeight: "600" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: TRAVA.ink, fontSize: 20, lineHeight: 24, fontWeight: "900" },
});
