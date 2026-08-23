import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { TravaGlassNav } from "@/components/navigation/TravaGlassNav";

export type TravaIconName = ComponentProps<typeof Ionicons>["name"];

export const PX = {
  ink: "#101A35",
  muted: "#6E7995",
  lightMuted: "#98A1B5",
  purple: "#668FE7",
  pink: "#F18FB9",
  blue: "#69A9EE",
  mint: "#5EC9A8",
  orange: "#F0A06A",
  border: "rgba(226,229,239,0.96)",
  white: "#FFFFFF",
};

export const grad = ["#78B7F2", "#A9B1F0", "#F29AC0"] as const;
export const gradStrong = ["#73ADEB", "#9CAAF0", "#EC91B9"] as const;

export function TravaIcon({ name, size = 22, color = PX.ink }: { name: TravaIconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function FauxStatusBar() {
  if (Platform.OS !== "web") return null;
  return <View style={styles.status}><Text style={styles.statusTime}>9:41</Text><View style={styles.statusIcons}><Ionicons name="cellular" size={14} color="#101522"/><Ionicons name="wifi" size={14} color="#101522"/><Ionicons name="battery-full" size={16} color="#101522"/></View></View>;
}

export function Glass({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

export function GradientPill({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <LinearGradient colors={gradStrong} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={[styles.pill, style]}>{children}</LinearGradient>;
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
      <CircleButton label="Back to trips" onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)}><Ionicons name="chevron-back" size={23} color={PX.ink}/></CircleButton>
      <Text numberOfLines={1} style={styles.tripTitle}>{title || "Japan"}</Text>
      <View style={styles.headerActions}>
        <View style={styles.liveButtonWrap}><CircleButton label="Travel group and live collaboration" onPress={() => router.push(`/trip/${tripId}/members` as Href)}><Ionicons name="people" size={20} color="#38557F"/></CircleButton><View style={styles.liveDot}/></View>
        <View><CircleButton label="Notifications" onPress={() => Alert.alert("Trip notifications", "You’re all caught up for this trip.")}><Ionicons name="notifications-outline" size={20} color={PX.ink}/></CircleButton><View style={styles.dot}/></View>
        <CircleButton label="More trip options" onPress={() => Alert.alert("Trip options", "Use Overview to edit trip details or manage the local workspace.")}><Ionicons name="ellipsis-horizontal" size={21} color={PX.ink}/></CircleButton>
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {workspaceTabs.map(([label, suffix]) => {
        const target = `/trip/${tripId}${suffix}`;
        const active = suffix ? path.endsWith(suffix) : path === `/trip/${tripId}` || path === `/trip/${tripId}/`;
        return <Pressable key={label} onPress={() => router.replace(target as Href)} style={({ pressed }) => [styles.tabSlot, pressed && styles.tabPressed]}>
          {active ? <GradientPill style={styles.activeTab}><Text style={styles.activeTabText}>{label}</Text></GradientPill> : <Text style={styles.tabText}>{label}</Text>}
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function DetailBottomNav() {
  return <TravaGlassNav placement="floating" />;
}

export function ScreenShell({ tripId, title, children }: PropsWithChildren<{ tripId: string; title: string }>) {
  return <View style={styles.screen}><WorkspaceHeader tripId={tripId} title={title}/>{children}<DetailBottomNav/></View>;
}

export function Soft3DIcon({ colors, glyph, icon, size = 62, foreground = "#31567F" }: { colors: readonly [string, string, ...string[]]; glyph?: string; icon?: TravaIconName; size?: number; foreground?: string }) {
  return <View style={[styles.iconShadow, { width: size, height: size, borderRadius: size * .28 }]}>
    <LinearGradient colors={colors} start={{ x: .15, y: .05 }} end={{ x: .85, y: .95 }} style={[styles.iconTile, { width: size, height: size, borderRadius: size * .28 }]}>
      <View style={styles.iconHighlight}/>{icon ? <Ionicons name={icon} size={Math.round(size * .42)} color={foreground}/> : <Text style={[styles.iconGlyph, { fontSize: size * .38, color: foreground }]}>{glyph}</Text>}
    </LinearGradient>
  </View>;
}

export function SectionHeading({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) { return <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>{title}</Text>{sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}</View>{action}</View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  status: { height: 30, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusTime: { color: PX.ink, fontSize: 15, fontWeight: "900" }, statusIcons: { flexDirection: "row", alignItems: "center", gap: 4 },
  glass: { backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: "rgba(235,237,245,.98)", boxShadow: "0 14px 34px rgba(66,67,102,.08)" },
  pill: { alignItems: "center", justifyContent: "center", borderRadius: 999 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEF0F5", boxShadow: "0 8px 22px rgba(62,67,98,.08)" },
  pressed: { opacity: .82, transform: [{ scale: .97 }] }, tabPressed: { backgroundColor: "#F7F9FC" },
  headerWrap: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 22, paddingTop: 6, backgroundColor: "#FFFFFF", zIndex: 20 },
  headerTop: { minHeight: 84, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, tripTitle: { flex: 1, textAlign: "center", color: PX.ink, fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -.8 }, headerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, liveButtonWrap: { position: "relative" }, liveDot: { position: "absolute", right: 1, bottom: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: "#4FC89B", borderWidth: 2, borderColor: "#FFFFFF" }, dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, top: 4, right: 4, backgroundColor: "#F59ABC", borderWidth: 2, borderColor: "#FFF" },
  tabs: { flexGrow: 1, minWidth: "100%", height: 47, borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EBF2", boxShadow: "0 8px 24px rgba(87,86,114,.06)" }, tabSlot: { minWidth: 102, flexGrow: 1, height: 45, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#EEF0F4" }, activeTab: { width: "100%", height: "100%", borderRadius: 23 }, tabText: { color: "#1F2A47", fontSize: 13, fontWeight: "700" }, activeTabText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  bottomOuter: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 100 }, bottomBar: { width: "92%", maxWidth: 620, height: 86, paddingHorizontal: 18, borderRadius: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "rgba(255,255,255,.95)", boxShadow: "0 16px 42px rgba(89,76,142,.11)" }, bottomItem: { width: 72, alignItems: "center", justifyContent: "center", gap: 4 }, bottomPressed: { opacity: .6 }, bottomLabel: { color: "#253657", fontSize: 11, fontWeight: "700" }, bottomActive: { color: "#6F8FEF" }, aiPress: { width: 108, height: 82, marginTop: -16 }, ai: { flex: 1, borderRadius: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "rgba(255,255,255,.95)", boxShadow: "0 14px 34px rgba(124,157,230,.24)" }, aiLabel: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  iconShadow: { alignItems: "center", justifyContent: "center", boxShadow: "0 12px 26px rgba(83,105,148,.18)" }, iconTile: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.82)" }, iconHighlight: { position: "absolute", left: 8, right: 8, top: 7, height: 14, borderRadius: 9, backgroundColor: "rgba(255,255,255,.52)" }, iconGlyph: { color: "#FFF", fontWeight: "900" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: PX.ink, fontSize: 20, fontWeight: "900" }, sectionSub: { marginTop: 3, color: PX.muted, fontSize: 10, fontWeight: "600" },
});
