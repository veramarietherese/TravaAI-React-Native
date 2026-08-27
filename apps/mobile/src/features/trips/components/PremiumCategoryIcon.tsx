import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type IconMeta = {
  icon: IconName;
  colors: readonly [string, string];
  color: string;
};

const META: Record<string, IconMeta> = {
  flight: { icon: "airplane-outline", colors: ["rgba(225,242,255,.96)", "rgba(201,226,255,.96)"], color: "#2E78C9" },
  airport: { icon: "airplane-outline", colors: ["rgba(225,242,255,.96)", "rgba(201,226,255,.96)"], color: "#2E78C9" },
  transport: { icon: "car-sport-outline", colors: ["rgba(229,246,255,.96)", "rgba(211,235,249,.96)"], color: "#3377A8" },
  transportation: { icon: "car-sport-outline", colors: ["rgba(229,246,255,.96)", "rgba(211,235,249,.96)"], color: "#3377A8" },
  stay: { icon: "bed-outline", colors: ["rgba(241,237,255,.96)", "rgba(222,214,252,.96)"], color: "#6257C8" },
  hotel: { icon: "bed-outline", colors: ["rgba(241,237,255,.96)", "rgba(222,214,252,.96)"], color: "#6257C8" },
  accommodation: { icon: "bed-outline", colors: ["rgba(241,237,255,.96)", "rgba(222,214,252,.96)"], color: "#6257C8" },
  food: { icon: "restaurant-outline", colors: ["rgba(255,241,231,.96)", "rgba(255,219,199,.96)"], color: "#B86538" },
  "food & dining": { icon: "restaurant-outline", colors: ["rgba(255,241,231,.96)", "rgba(255,219,199,.96)"], color: "#B86538" },
  restaurant: { icon: "restaurant-outline", colors: ["rgba(255,241,231,.96)", "rgba(255,219,199,.96)"], color: "#B86538" },
  cafe: { icon: "cafe-outline", colors: ["rgba(255,247,232,.96)", "rgba(244,229,200,.96)"], color: "#956A32" },
  cafes: { icon: "cafe-outline", colors: ["rgba(255,247,232,.96)", "rgba(244,229,200,.96)"], color: "#956A32" },
  shopping: { icon: "bag-handle-outline", colors: ["rgba(255,239,245,.96)", "rgba(250,213,226,.96)"], color: "#B14E78" },
  sightseeing: { icon: "camera-outline", colors: ["rgba(239,237,255,.96)", "rgba(217,212,253,.96)"], color: "#635DCA" },
  landmark: { icon: "business-outline", colors: ["rgba(239,237,255,.96)", "rgba(217,212,253,.96)"], color: "#635DCA" },
  activities: { icon: "ticket-outline", colors: ["rgba(237,248,242,.96)", "rgba(211,238,224,.96)"], color: "#3E8B69" },
  work: { icon: "briefcase-outline", colors: ["rgba(237,248,242,.96)", "rgba(211,238,224,.96)"], color: "#3E8B69" },
  meeting: { icon: "briefcase-outline", colors: ["rgba(237,248,242,.96)", "rgba(211,238,224,.96)"], color: "#3E8B69" },
  park: { icon: "leaf-outline", colors: ["rgba(239,249,239,.96)", "rgba(216,239,216,.96)"], color: "#4E8B55" },
  parks: { icon: "leaf-outline", colors: ["rgba(239,249,239,.96)", "rgba(216,239,216,.96)"], color: "#4E8B55" },
  hiking: { icon: "trail-sign-outline", colors: ["rgba(247,244,236,.96)", "rgba(231,223,206,.96)"], color: "#7E6E46" },
  money: { icon: "wallet-outline", colors: ["rgba(248,244,235,.96)", "rgba(237,225,199,.96)"], color: "#866A2E" },
  budget: { icon: "wallet-outline", colors: ["rgba(248,244,235,.96)", "rgba(237,225,199,.96)"], color: "#866A2E" },
  receipt: { icon: "receipt-outline", colors: ["rgba(244,245,247,.96)", "rgba(227,230,235,.96)"], color: "#5D6570" },
  other: { icon: "document-text-outline", colors: ["rgba(244,245,247,.96)", "rgba(227,230,235,.96)"], color: "#5D6570" },
};

function resolveMeta(category: string): IconMeta {
  const key = category.trim().toLowerCase();
  if (META[key]) return META[key];
  if (key.includes("food")) return META.food;
  if (key.includes("hotel") || key.includes("stay") || key.includes("accomm")) return META.hotel;
  if (key.includes("flight") || key.includes("airport")) return META.flight;
  if (key.includes("shop")) return META.shopping;
  if (key.includes("park") || key.includes("garden")) return META.park;
  if (key.includes("work") || key.includes("meeting")) return META.work;
  return { icon: "location-outline", colors: ["rgba(242,245,249,.96)", "rgba(226,232,240,.96)"], color: "#50627A" };
}

export function PremiumCategoryIcon({ category, size = 46, style }: { category: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const meta = resolveMeta(category);
  return (
    <View style={[styles.host, { width: size, height: size }, style]}>
      <LinearGradient colors={meta.colors} start={{ x: .08, y: .08 }} end={{ x: .92, y: .92 }} style={[styles.tile, { width: size, height: size, borderRadius: size * .31 }]}>
        <View style={[styles.softHighlight, { pointerEvents: "none" }]} />
        <Ionicons name={meta.icon} size={Math.max(18, Math.round(size * .46))} color={meta.color} />
      </LinearGradient>
    </View>
  );
}

export function PremiumActionGlyph({ icon, size = 58, colors = ["rgba(244,246,250,.96)", "rgba(230,234,241,.96)"], color = "#536174" }: { icon: IconName; size?: number; colors?: readonly [string, string]; color?: string }) {
  return (
    <View style={[styles.host, { width: size, height: size }]}>
      <LinearGradient colors={colors} start={{ x: .08, y: .08 }} end={{ x: .92, y: .92 }} style={[styles.tile, { width: size, height: size, borderRadius: size * .31 }]}>
        <View style={[styles.softHighlight, { pointerEvents: "none" }]} />
        <Ionicons name={icon} size={Math.max(19, Math.round(size * .43))} color={color} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: "center", justifyContent: "center" },
  tile: { alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(175,184,198,.16)" },
  softHighlight: { position: "absolute", left: 7, right: 7, top: 5, height: 13, borderRadius: 10, backgroundColor: "rgba(255,255,255,.26)" },
});
