import { type Href, usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const TABS = [
  ["Overview", ""],
  ["Itinerary", "/itinerary"],
  ["Budget", "/budget"],
  ["Expenses", "/expenses"],
  ["Checklist", "/checklist"],
  ["Documents", "/documents"],
] as const;

export function TripWorkspaceHeader({
  tripId,
  title,
  subtitle,
}: {
  tripId: string;
  title: string;
  subtitle?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to trips"
          onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>

        <View pointerEvents="none" style={styles.centerTitle}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trip members"
            onPress={() => router.push(`/trip/${tripId}/members` as Href)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.person}>♙</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trip chat"
            onPress={() => router.push(`/trip/${tripId}/chat` as Href)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.chatGlyph}>◌</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trip settings"
            onPress={() => router.push(`/trip/${tripId}/edit` as Href)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(([label, suffix]) => {
          const target = `/trip/${tripId}${suffix}`;
          const active = suffix ? pathname.endsWith(suffix) : pathname === `/trip/${tripId}`;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => router.push(target as Href)}
              style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E9EAF0",
  },
  topRow: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },
  centerTitle: {
    position: "absolute",
    left: 122,
    right: 122,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#11182A", fontSize: 17, lineHeight: 20, fontWeight: "900" },
  subtitle: { marginTop: 1, color: "#9097A7", fontSize: 8, lineHeight: 10, fontWeight: "700" },
  actions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF0",
  },
  backGlyph: { marginTop: -3, color: "#17213B", fontSize: 27, lineHeight: 28, fontWeight: "500" },
  person: { color: "#17213B", fontSize: 17, fontWeight: "700" },
  chatGlyph: { color: "#17213B", fontSize: 19, lineHeight: 20, fontWeight: "900" },
  more: { marginTop: -4, color: "#17213B", fontSize: 11, letterSpacing: -1, fontWeight: "900" },
  tabs: { paddingHorizontal: 12, paddingBottom: 9, gap: 6 },
  tab: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF2",
  },
  tabActive: { backgroundColor: "#7257EC", borderColor: "#7257EC" },
  tabText: { color: "#747D90", fontSize: 9, lineHeight: 12, fontWeight: "800" },
  tabTextActive: { color: "#FFFFFF" },
  pressed: { opacity: 0.68 },
});
