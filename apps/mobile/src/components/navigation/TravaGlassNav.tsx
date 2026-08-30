import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];
type NavKey = "home" | "discover" | "ai" | "trips" | "profile";
type NavItem = { key: NavKey; label: string; href: Href; icon: IconName; activeIcon: IconName };

const NAV_SHELL_HEIGHT = 92;
const AI_OVERHANG = 30;
const TABBAR_TOP_CLEARANCE = AI_OVERHANG + 6;

const ITEMS: readonly NavItem[] = [
  { key: "home", label: "Home", href: "/(traveler)/(tabs)/home" as Href, icon: "home-outline", activeIcon: "home" },
  { key: "discover", label: "Explore", href: "/(traveler)/(tabs)/explore" as Href, icon: "compass-outline", activeIcon: "compass" },
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
      <BlurView intensity={52} tint="light" style={[StyleSheet.absoluteFill, styles.blur]} />
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
                <View pointerEvents="none" style={styles.aiGlow} />
                <LinearGradient
                  colors={["#75C7FF", "#A6A8FF", "#F59BCB"]}
                  start={{ x: 0.08, y: 0.06 }}
                  end={{ x: 0.92, y: 0.94 }}
                  style={[styles.aiButton, active && styles.aiButtonActive]}
                >
                  <View pointerEvents="none" style={styles.aiHighlight} />
                  <Ionicons name="sparkles" size={30} color="#FFFFFF" />
                  <Text style={styles.aiLabel}>AI</Text>
                </LinearGradient>
              </Pressable>
            );
          }

          const iconSize = item.key === "profile" ? 30 : 26;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={iconSize}
                color={active ? "#17213A" : "#718097"}
              />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (placement === "tabbar") {
    /*
     * IMPORTANT:
     * Keep the tab bar IN normal layout flow.
     *
     * The previous implementation absolutely positioned this host at the
     * bottom of the screen. React Navigation therefore measured effectively
     * no tab-bar height, so the AI chat's quick replies/composer continued
     * underneath the glass navigation.
     *
     * This host now reserves enough vertical room for both the 92px glass bar
     * and the raised center AI control. Screens automatically stop above it,
     * so the chat controls never sit behind the navigation.
     */
    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.tabbarHost,
          { paddingBottom: Math.max(8, insets.bottom) },
        ]}
      >
        {bar}
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.floatingHost,
        { bottom: Math.max(8, insets.bottom + 5) },
      ]}
    >
      {bar}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingHost: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 200,
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },

  // Do NOT make this absolute. Its measured height protects tab content from overlap.
  tabbarHost: {
    width: "100%",
    minHeight: NAV_SHELL_HEIGHT + TABBAR_TOP_CLEARANCE,
    zIndex: 200,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: TABBAR_TOP_CLEARANCE,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },

  shell: {
    width: "92%",
    maxWidth: 760,
    height: NAV_SHELL_HEIGHT,
    borderRadius: 46,
    overflow: "visible",
    backgroundColor: "rgba(255,255,255,.58)",
    borderWidth: 1,
    borderColor: "rgba(210,214,220,.72)",
    boxShadow: "0 18px 42px rgba(32,38,50,.13)",
  },
  blur: { borderRadius: 46, overflow: "hidden" },
  frost: {
    ...StyleSheet.absoluteFill,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,.22)",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 13,
  },
  item: {
    width: 98,
    height: 68,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    color: "#718097",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
  },
  labelActive: { color: "#17213A", fontWeight: "900" },
  aiSlot: {
    width: 108,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -AI_OVERHANG,
    position: "relative",
  },
  aiGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(118,166,255,.22)",
    boxShadow: "0 14px 34px rgba(104,103,255,.30)",
  },
  aiButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.92)",
    boxShadow: "0 11px 29px rgba(115,117,242,.30)",
    overflow: "hidden",
  },
  aiButtonActive: { transform: [{ scale: 1.035 }] },
  aiHighlight: {
    position: "absolute",
    left: 8,
    top: 6,
    width: 38,
    height: 21,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.27)",
    transform: [{ rotate: "-18deg" }],
  },
  aiLabel: {
    marginTop: 1,
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "900",
  },
  pressed: { opacity: 0.74, transform: [{ scale: 0.97 }] },
});
