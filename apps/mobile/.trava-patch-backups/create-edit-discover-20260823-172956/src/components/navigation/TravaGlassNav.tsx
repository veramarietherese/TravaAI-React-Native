import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];
type NavKey = "home" | "discover" | "ai" | "trips" | "profile";
type NavItem = { key: NavKey; label: string; href: Href; icon: IconName; activeIcon: IconName };

const ITEMS: readonly NavItem[] = [
  { key: "home", label: "Home", href: "/(traveler)/(tabs)/home" as Href, icon: "home-outline", activeIcon: "home" },
  { key: "discover", label: "Discover", href: "/(traveler)/(tabs)/explore" as Href, icon: "compass-outline", activeIcon: "compass" },
  { key: "ai", label: "AI", href: "/(traveler)/(tabs)/ai" as Href, icon: "sparkles-outline", activeIcon: "sparkles" },
  { key: "trips", label: "Trips", href: "/(traveler)/(tabs)/trips" as Href, icon: "airplane-outline", activeIcon: "airplane" },
  { key: "profile", label: "Profile", href: "/(traveler)/(tabs)/profile" as Href, icon: "person-outline", activeIcon: "person" },
] as const;

function resolveActiveKey(pathname: string): NavKey | null {
  if (pathname.startsWith("/trip/")) return "trips";
  if (pathname === "/home" || pathname.endsWith("/home")) return "home";
  if (pathname === "/explore" || pathname.endsWith("/explore")) return "discover";
  if (pathname === "/trips" || pathname.endsWith("/trips")) return "trips";
  if (pathname === "/ai" || pathname.endsWith("/ai")) return "ai";
  if (pathname === "/profile" || pathname.endsWith("/profile")) return "profile";
  return null;
}

export function TravaGlassNav({ placement = "floating" }: { placement?: "floating" | "tabbar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const activeKey = resolveActiveKey(pathname);

  const bar = (
    <View style={styles.shell}>
      <BlurView intensity={44} tint="light" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.frost} />
      <View style={styles.row}>
        {ITEMS.map((item) => {
          const active = item.key === activeKey;
          if (item.key === "ai") {
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel="AI chat"
                accessibilityState={{ selected: active }}
                onPress={() => router.replace(item.href)}
                style={({ pressed }) => [styles.aiSlot, pressed && styles.pressed]}
              >
                <View style={[styles.aiButton, active && styles.aiButtonActive]}>
                  <Ionicons name="sparkles" size={22} color="#15171B" />
                  <Text style={styles.aiLabel}>AI</Text>
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.pressed]}
            >
              <Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? "#16181D" : "#7A7F87"} />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (placement === "tabbar") {
    return <View style={[styles.tabbarHost, { paddingBottom: Math.max(10, insets.bottom) }]}>{bar}</View>;
  }
  return <View pointerEvents="box-none" style={[styles.floatingHost, { bottom: Math.max(10, insets.bottom + 4) }]}>{bar}</View>;
}

const styles = StyleSheet.create({
  floatingHost: { position: "absolute", left: 0, right: 0, zIndex: 120, alignItems: "center", paddingHorizontal: 14 },
  tabbarHost: { width: "100%", alignItems: "center", justifyContent: "flex-end", paddingTop: 6, paddingHorizontal: 14, backgroundColor: "transparent" },
  shell: {
    width: "94%", maxWidth: 590, height: 78, overflow: "hidden", borderRadius: 39,
    borderWidth: 1, borderColor: "rgba(190,193,199,0.58)", backgroundColor: "rgba(250,250,250,0.72)",
    boxShadow: "0 16px 42px rgba(25,28,34,0.10)",
  },
  frost: { ...StyleSheet.absoluteFillObject, borderRadius: 39, backgroundColor: "rgba(255,255,255,0.34)" },
  row: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  item: { width: 82, height: 56, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 3 },
  itemActive: { backgroundColor: "rgba(230,231,234,0.78)" },
  label: { color: "#858A91", fontSize: 9.5, lineHeight: 12, fontWeight: "700" },
  labelActive: { color: "#17191D", fontWeight: "800" },
  aiSlot: { width: 88, height: 78, alignItems: "center", justifyContent: "center", marginTop: -8 },
  aiButton: {
    width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "rgba(175,179,186,0.72)",
    boxShadow: "0 10px 28px rgba(23,25,30,0.14)",
  },
  aiButtonActive: { backgroundColor: "#ECEDEF", borderColor: "#B7BBC2" },
  aiLabel: { marginTop: 1, color: "#15171B", fontSize: 9.5, lineHeight: 11, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
