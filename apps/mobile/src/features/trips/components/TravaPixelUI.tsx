import { Ionicons } from "@expo/vector-icons";
import { type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { TravaGlassNav } from "@/components/navigation/TravaGlassNav";

export type TravaIconName = ComponentProps<typeof Ionicons>["name"];

export const PX = {
  ink: "#111318",
  muted: "#747982",
  lightMuted: "#9AA0A8",
  purple: "#666B74",
  pink: "#8A8F97",
  blue: "#777C85",
  mint: "#777C85",
  orange: "#777C85",
  border: "#E2E3E6",
  white: "#FFFFFF",
};

export function TravaIcon({ name, size = 22, color = PX.ink }: { name: TravaIconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function FauxStatusBar() {
  if (Platform.OS !== "web") return null;
  return <View style={styles.status}><Text style={styles.statusTime}>9:41</Text><View style={styles.statusIcons}><Ionicons name="cellular" size={14} color="#111318"/><Ionicons name="wifi" size={14} color="#111318"/><Ionicons name="battery-full" size={16} color="#111318"/></View></View>;
}

export function Glass({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

export function GradientPill({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.pill, style]}>{children}</View>;
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
      <Text numberOfLines={1} style={styles.tripTitle}>{title || "Trip"}</Text>
      <View style={styles.headerActions}>
        <View style={styles.liveButtonWrap}><CircleButton label="Travel group and live collaboration" onPress={() => router.push(`/trip/${tripId}/members` as Href)}><Ionicons name="people-outline" size={20} color={PX.ink}/></CircleButton><View style={styles.liveDot}/></View>
        <View><CircleButton label="Notifications" onPress={() => Alert.alert("Trip notifications", "You’re all caught up for this trip.")}><Ionicons name="notifications-outline" size={20} color={PX.ink}/></CircleButton><View style={styles.dot}/></View>
        <CircleButton label="More trip options" onPress={() => Alert.alert("Trip options", "Use Overview to edit trip details or manage the local workspace.")}><Ionicons name="ellipsis-horizontal" size={21} color={PX.ink}/></CircleButton>
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {workspaceTabs.map(([label, suffix], index) => {
        const target = `/trip/${tripId}${suffix}`;
        const active = suffix ? path.endsWith(suffix) : path === `/trip/${tripId}` || path === `/trip/${tripId}/`;
        return <Pressable key={label} onPress={() => router.replace(target as Href)} style={({ pressed }) => [styles.tabSlot, index === workspaceTabs.length - 1 && styles.tabSlotLast, active && styles.activeTab, pressed && styles.tabPressed]}>
          <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function DetailBottomNav() { return <TravaGlassNav placement="floating" />; }

export function ScreenShell({ tripId, title, children }: PropsWithChildren<{ tripId: string; title: string }>) {
  return <View style={styles.screen}><WorkspaceHeader tripId={tripId} title={title}/>{children}<DetailBottomNav/></View>;
}

export function Soft3DIcon({
  colors,
  glyph,
  icon,
  size = 62,
  foreground = "#FFFFFF",
  tilt = -4,
}: {
  colors: readonly [string, string, ...string[]];
  glyph?: string;
  icon?: TravaIconName;
  size?: number;
  foreground?: string;
  tilt?: number;
}) {
  return <View style={[styles.iconShadow, { width: size, height: size }]}> 
    <View style={styles.iconTilt}> 
      <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * .28, backgroundColor: colors[0] }]}> 
        <View style={[styles.iconTint, { backgroundColor: colors[1] }]} />
        <View style={styles.iconHighlight}/>
        {icon ? <Ionicons name={icon} size={Math.round(size * .42)} color={foreground}/> : <Text style={[styles.iconGlyph, { fontSize: size * .38, color: foreground }]}>{glyph}</Text>}
      </View>
    </View>
  </View>;
}

export function SectionHeading({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) { return <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>{title}</Text>{sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}</View>{action}</View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  status: { height: 30, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusTime: { color: PX.ink, fontSize: 15, fontWeight: "900" },
  statusIcons: { flexDirection: "row", alignItems: "center", gap: 4 },
  glass: { backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "#E4E5E8", boxShadow: "0 12px 30px rgba(22,24,28,.07)" },
  pill: { alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#EEEFF1" },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E5E8", boxShadow: "0 8px 20px rgba(24,26,31,.06)" },
  pressed: { opacity: .72, transform: [{ scale: .97 }] },
  tabPressed: { backgroundColor: "#F4F4F5" },
  headerWrap: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 22, paddingTop: 6, backgroundColor: "#FFFFFF", zIndex: 20 },
  headerTop: { minHeight: 84, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  tripTitle: { flex: 1, textAlign: "center", color: PX.ink, fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -.8 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveButtonWrap: { position: "relative" },
  liveDot: { position: "absolute", right: 1, bottom: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: "#42B884", borderWidth: 2, borderColor: "#FFFFFF" },
  dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, top: 4, right: 4, backgroundColor: "#D95264", borderWidth: 2, borderColor: "#FFF" },
  tabs: { flexGrow: 1, minWidth: "100%", minHeight: 48, borderRadius: 24, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E2E5", boxShadow: "0 6px 18px rgba(22,24,28,.05)" },
  tabSlot: { minWidth: 102, flexGrow: 1, height: 46, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "#E7E8EA" },
  tabSlotLast: { borderRightWidth: 0 },
  activeTab: { backgroundColor: "#ECEDEF", borderRadius: 23 },
  tabText: { color: "#30343A", fontSize: 13, fontWeight: "700" },
  activeTabText: { color: "#111318", fontSize: 13, fontWeight: "900" },
  iconShadow: { alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  iconTilt: { backgroundColor: "transparent", boxShadow: "0 10px 22px rgba(76,70,145,.18)" },
  iconTile: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 0, borderColor: "transparent", backgroundColor: "transparent" },
  iconTint: { ...StyleSheet.absoluteFill, opacity: .62 },
  iconHighlight: { position: "absolute", left: 8, right: 8, top: 7, height: 16, borderRadius: 13, backgroundColor: "rgba(255,255,255,.22)" },
  iconGlyph: { fontWeight: "900" },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: PX.ink, fontSize: 20, fontWeight: "900" },
  sectionSub: { marginTop: 3, color: PX.muted, fontSize: 10, fontWeight: "600" },
});
