import { LinearGradient } from "expo-linear-gradient";
import { type Href, usePathname, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { RoundIconButton, TRAVA } from "./TravaUI";

const TABS = [
  ["Overview", ""],
  ["Itinerary", "/itinerary"],
  ["Budget", "/budget"],
  ["Expenses", "/expenses"],
  ["Checklist", "/checklist"],
  ["Documents", "/documents"],
] as const;

export function TripWorkspaceHeader({ tripId, title }: { tripId: string; title: string; subtitle?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <RoundIconButton label="Back to trips" glyph="←" onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)} />
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={styles.actions}>
          <RoundIconButton label="Trip members" glyph="♙" onPress={() => router.push(`/trip/${tripId}/members` as Href)} />
          <View>
            <RoundIconButton label="Notifications" glyph="♧" onPress={() => Alert.alert("Trip updates", "Trip reminders and shared activity updates will appear here.")} />
            <View style={styles.notificationDot} />
          </View>
          <RoundIconButton label="More options" glyph="•••" onPress={() => Alert.alert("Trip options", "Use Edit Trip from Overview to change trip details.")} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(([label, suffix]) => {
          const target = `/trip/${tripId}${suffix}`;
          const active = suffix ? pathname.endsWith(suffix) : pathname === `/trip/${tripId}`;
          return (
            <Pressable key={label} accessibilityRole="button" onPress={() => router.push(target as Href)} style={({ pressed }) => [styles.tabWrap, pressed && styles.pressed]}>
              {active ? (
                <LinearGradient colors={[TRAVA.pink, "#C55BFF", TRAVA.purple]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.tabActive}>
                  <Text style={styles.tabTextActive}>{label}</Text>
                </LinearGradient>
              ) : <Text style={styles.tabText}>{label}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 4, paddingBottom: 10, backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ECEEF4" },
  topRow: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, gap: 12 },
  title: { flex: 1, minWidth: 0, textAlign: "center", color: TRAVA.ink, fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationDot: { position: "absolute", right: 3, top: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5C8A", borderWidth: 1.5, borderColor: "#FFFFFF" },
  tabs: { flexGrow: 1, paddingHorizontal: 18, gap: 2, justifyContent: "center", alignItems: "center" },
  tabWrap: { minWidth: 92, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: "#ECEEF4", backgroundColor: "#FFFFFF" },
  tabActive: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", borderRadius: 22 },
  tabText: { color: "#1E2943", fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
