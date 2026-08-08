import { type Href, usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const TABS = [
  ["Overview", ""],
  ["Itinerary", "/itinerary"],
  ["Budget", "/budget"],
  ["Expenses", "/expenses"],
  ["Checklist", "/checklist"],
  ["Documents", "/documents"],
  ["Members", "/members"],
] as const;

export function TripWorkspaceHeader({ tripId, title, subtitle }: { tripId: string; title: string; subtitle?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to trips" onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(([label, suffix]) => {
          const target = `/trip/${tripId}${suffix}`;
          const active = suffix ? pathname.endsWith(suffix) : pathname === `/trip/${tripId}`;
          return (
            <Pressable key={label} accessibilityRole="button" onPress={() => router.push(target as Href)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7E9F2" },
  topRow: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F0FF" },
  backGlyph: { color: "#6550D8", fontSize: 30, lineHeight: 32, fontWeight: "700", marginTop: -2 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { color: "#15213A", fontSize: 18, lineHeight: 23, fontWeight: "900" },
  subtitle: { marginTop: 2, color: "#77839A", fontSize: 11, lineHeight: 15, fontWeight: "600" },
  tabs: { paddingHorizontal: 14, paddingBottom: 10, gap: 7 },
  tab: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 13, backgroundColor: "#F6F7FB", borderWidth: 1, borderColor: "#ECEEF5" },
  tabActive: { backgroundColor: "#7157EC", borderColor: "#7157EC" },
  tabText: { color: "#69758B", fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: "#FFFFFF" },
});
