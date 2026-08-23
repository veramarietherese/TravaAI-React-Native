import { LinearGradient } from "expo-linear-gradient";
import { type Href, usePathname, useRouter } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const PX = {
  ink: "#101A35",
  muted: "#6E7995",
  lightMuted: "#98A1B5",
  purple: "#7757F6",
  pink: "#F35698",
  blue: "#79BFFF",
  mint: "#64D5AE",
  orange: "#FF9C54",
  border: "rgba(226,229,239,0.96)",
  white: "#FFFFFF",
};

export const grad = ["#F95B91", "#C65BFB", "#7058F5"] as const;

export function FauxStatusBar() {
  if (Platform.OS !== "web") return null;
  return <View style={styles.status}><Text style={styles.statusTime}>9:41</Text><Text style={styles.statusGlyphs}>▮▮▮  ◒  ▰</Text></View>;
}

export function Glass({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

export function GradientPill({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <LinearGradient colors={grad} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={[styles.pill, style]}>{children}</LinearGradient>;
}

export function CircleButton({ children, onPress, label }: { children: ReactNode; onPress?(): void; label: string }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.circle, pressed && styles.pressed]}>{children}</Pressable>;
}

const workspaceTabs = [
  ["Overview", ""], ["Itinerary", "/itinerary"], ["Budget", "/budget"], ["Expenses", "/expenses"], ["Checklist", "/checklist"], ["Documents", "/documents"],
] as const;

export function WorkspaceHeader({ tripId, title }: { tripId: string; title: string }) {
  const router = useRouter();
  const path = usePathname();
  return <View style={styles.headerWrap}>
    <FauxStatusBar />
    <View style={styles.headerTop}>
      <CircleButton label="Back" onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)}><Text style={styles.back}>←</Text></CircleButton>
      <Text numberOfLines={1} style={styles.tripTitle}>{title || "Japan"}</Text>
      <View style={styles.headerActions}>
        <CircleButton label="Travel group" onPress={() => Alert.alert("Travel group", "Group details stay available from the main trip list while this workspace runs local-first.")}><PeopleLineIcon /></CircleButton>
        <View><CircleButton label="Notifications" onPress={() => Alert.alert("Notifications", "No new trip notifications.")}><BellLineIcon /></CircleButton><View style={styles.dot}/></View>
        <CircleButton label="More" onPress={() => Alert.alert("Trip options", "Local workspace is active for this trip.")}><Text style={styles.more}>•••</Text></CircleButton>
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {workspaceTabs.map(([label, suffix]) => {
        const target = `/trip/${tripId}${suffix}`;
        const active = suffix ? path.endsWith(suffix) : path === `/trip/${tripId}` || path === `/trip/${tripId}/`;
        return <Pressable key={label} onPress={() => router.replace(target as Href)} style={styles.tabSlot}>
          {active ? <GradientPill style={styles.activeTab}><Text style={styles.activeTabText}>{label}</Text></GradientPill> : <Text style={styles.tabText}>{label}</Text>}
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function DetailBottomNav() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottomOuter, { bottom: Math.max(10, insets.bottom + 4), pointerEvents: "box-none" }]}>
    <Glass style={styles.bottomBar}>
      <BottomItem label="Home" glyph="⌂" onPress={() => router.replace("/(traveler)/(tabs)/home" as Href)} />
      <BottomItem label="Trips" glyph="▣" active onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)} />
      <Pressable onPress={() => router.push("/(traveler)/(tabs)/ai" as Href)} style={({ pressed }) => [styles.aiPress, pressed && styles.pressed]}><LinearGradient colors={["#AFC9FF", "#8F74FA", "#F48BC7"]} style={styles.ai}><Text style={styles.aiSpark}>✣</Text><Text style={styles.aiLabel}>AI</Text></LinearGradient></Pressable>
      <BottomItem label="Inbox" glyph="◌" onPress={() => router.push("/(traveler)/(tabs)/explore" as Href)} />
      <BottomItem label="Profile" glyph="♙" onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} />
    </Glass>
  </View>;
}
function BottomItem({ label, glyph, active, onPress }: { label: string; glyph: string; active?: boolean; onPress?(): void }) { return <Pressable onPress={onPress} style={styles.bottomItem}><Text style={[styles.bottomGlyph, active && styles.bottomActive]}>{glyph}</Text><Text style={[styles.bottomLabel, active && styles.bottomActive]}>{label}</Text></Pressable>; }

export function ScreenShell({ tripId, title, children }: PropsWithChildren<{ tripId: string; title: string }>) {
  return <View style={styles.screen}><WorkspaceHeader tripId={tripId} title={title}/>{children}<DetailBottomNav/></View>;
}

export function Soft3DIcon({ colors, glyph, size = 62 }: { colors: readonly [string, string, ...string[]]; glyph: string; size?: number }) {
  return <View style={[styles.iconShadow, { width: size, height: size, borderRadius: size * .28 }]}>
    <LinearGradient colors={colors} start={{ x: .15, y: .05 }} end={{ x: .85, y: .95 }} style={[styles.iconTile, { width: size, height: size, borderRadius: size * .28 }]}>
      <View style={styles.iconHighlight}/><Text style={[styles.iconGlyph, { fontSize: size * .42 }]}>{glyph}</Text>
    </LinearGradient>
  </View>;
}

export function SectionHeading({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) { return <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>{title}</Text>{sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}</View>{action}</View>; }

function PeopleLineIcon() { return <View style={{ width: 22, height: 22 }}><View style={styles.headA}/><View style={styles.bodyA}/><View style={styles.headB}/><View style={styles.bodyB}/></View>; }
function BellLineIcon() { return <View style={{ width: 22, height: 22, alignItems: "center" }}><View style={styles.bellBody}/><View style={styles.bellBase}/><View style={styles.bellClapper}/></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  status: { height: 30, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, statusTime: { color: PX.ink, fontSize: 15, fontWeight: "900" }, statusGlyphs: { color: "#0A0D14", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  glass: { backgroundColor: "rgba(255,255,255,0.88)", borderWidth: 1, borderColor: "rgba(235,237,245,.98)", boxShadow: "0 14px 34px rgba(66,67,102,.08)" },
  pill: { alignItems: "center", justifyContent: "center", borderRadius: 999 },
  circle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEF0F5", boxShadow: "0 8px 22px rgba(62,67,98,.08)" },
  pressed: { opacity: .78, transform: [{ scale: .97 }] },
  headerWrap: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 22, paddingTop: 6, backgroundColor: "#FFFFFF", zIndex: 20 },
  headerTop: { minHeight: 84, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, tripTitle: { flex: 1, textAlign: "center", color: PX.ink, fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -.8 }, headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, back: { color: PX.ink, fontSize: 28, lineHeight: 30, fontWeight: "400" }, more: { color: PX.ink, fontSize: 18, letterSpacing: 1, fontWeight: "900" }, dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, top: 4, right: 4, backgroundColor: "#FF5B84", borderWidth: 2, borderColor: "#FFF" },
  tabs: { flexGrow: 1, minWidth: "100%", height: 47, borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EBF2", boxShadow: "0 8px 24px rgba(87,86,114,.06)" }, tabSlot: { minWidth: 102, flexGrow: 1, height: 45, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#EEF0F4" }, activeTab: { width: "100%", height: "100%", borderRadius: 23 }, tabText: { color: "#1F2A47", fontSize: 13, fontWeight: "700" }, activeTabText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  bottomOuter: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 100 }, bottomBar: { width: "92%", maxWidth: 620, height: 86, paddingHorizontal: 18, borderRadius: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "rgba(255,255,255,.94)", boxShadow: "0 16px 42px rgba(89,76,142,.13)" }, bottomItem: { width: 72, alignItems: "center", justifyContent: "center", gap: 4 }, bottomGlyph: { color: "#30436B", fontSize: 25, lineHeight: 28 }, bottomLabel: { color: "#253657", fontSize: 11, fontWeight: "700" }, bottomActive: { color: "#6D4DFF" }, aiPress: { width: 108, height: 82, marginTop: -16 }, ai: { flex: 1, borderRadius: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", boxShadow: "0 14px 34px rgba(137,92,240,.26)" }, aiSpark: { color: "#FFF", fontSize: 27 }, aiLabel: { color: "#FFF", fontSize: 21, fontWeight: "800" },
  iconShadow: { alignItems: "center", justifyContent: "center", boxShadow: "0 12px 24px rgba(96,76,150,.18)" }, iconTile: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.86)" }, iconHighlight: { position: "absolute", left: 6, top: 6, right: 6, height: "32%", borderRadius: 999, backgroundColor: "rgba(255,255,255,.24)" }, iconGlyph: { color: "#FFFFFF", fontWeight: "500" },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }, sectionTitle: { color: PX.ink, fontSize: 20, lineHeight: 25, fontWeight: "900" }, sectionSub: { marginTop: 3, color: PX.muted, fontSize: 11, fontWeight: "600" },
  headA: { position: "absolute", width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: PX.ink, left: 5, top: 3 }, bodyA: { position: "absolute", width: 12, height: 8, borderWidth: 1.5, borderColor: PX.ink, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, left: 2, top: 12 }, headB: { position: "absolute", width: 6, height: 6, borderRadius: 3, borderWidth: 1.4, borderColor: PX.ink, right: 3, top: 8 }, bodyB: { position: "absolute", width: 9, height: 6, borderWidth: 1.4, borderColor: PX.ink, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, right: 0, top: 15 },
  bellBody: { marginTop: 4, width: 13, height: 13, borderWidth: 1.6, borderColor: PX.ink, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 }, bellBase: { marginTop: -2, width: 17, height: 2, borderRadius: 1, backgroundColor: PX.ink }, bellClapper: { marginTop: 2, width: 4, height: 3, borderRadius: 2, backgroundColor: PX.ink },
});
