import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];
type NavKey = "home" | "trips" | "ai" | "messages" | "profile";

type NavItem = {
  key: NavKey;
  label: string;
  href: Href;
  icon: IconName;
  activeIcon: IconName;
};

const ITEMS: readonly NavItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/(traveler)/(tabs)/home" as Href,
    icon: "home-outline",
    activeIcon: "home",
  },
  {
    key: "trips",
    label: "Trips",
    href: "/(traveler)/(tabs)/trips" as Href,
    icon: "airplane-outline",
    activeIcon: "airplane",
  },
  {
    key: "ai",
    label: "AI",
    href: "/(traveler)/(tabs)/ai" as Href,
    icon: "sparkles-outline",
    activeIcon: "sparkles",
  },
  {
    key: "messages",
    label: "Messages",
    href: "/(traveler)/(tabs)/messages" as Href,
    icon: "chatbubble-ellipses-outline",
    activeIcon: "chatbubble-ellipses",
  },
  {
    key: "profile",
    label: "Profile",
    href: "/(traveler)/(tabs)/profile" as Href,
    icon: "person-outline",
    activeIcon: "person",
  },
] as const;

function resolveActiveKey(pathname: string): NavKey | null {
  if (pathname.startsWith("/trip/")) return "trips";
  if (pathname.startsWith("/chat/")) return "messages";
  if (pathname === "/home" || pathname.endsWith("/home")) return "home";
  if (pathname === "/trips" || pathname.endsWith("/trips")) return "trips";
  if (pathname === "/ai" || pathname.endsWith("/ai")) return "ai";
  if (pathname === "/messages" || pathname.endsWith("/messages")) return "messages";
  if (pathname === "/profile" || pathname.endsWith("/profile")) return "profile";
  return null;
}

export function TravaGlassNav({ placement = "floating" }: { placement?: "floating" | "tabbar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const activeKey = resolveActiveKey(pathname);

  const bar = (
    <View style={styles.glassShell}>
      <BlurView intensity={58} tint="light" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.frostLayer} />
      <View pointerEvents="none" style={styles.topHighlight} />

      <View style={styles.itemsRow}>
        {ITEMS.map((item) => {
          const active = activeKey === item.key;
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
                <View style={[styles.aiGlow, active && styles.aiGlowActive]} />
                <LinearGradient
                  colors={["#7DBBFA", "#A8B9FA", "#F3A5CF"]}
                  start={{ x: 0.05, y: 0.1 }}
                  end={{ x: 0.95, y: 0.9 }}
                  style={[styles.aiButton, active && styles.aiButtonActive]}
                >
                  <View pointerEvents="none" style={styles.aiHighlight} />
                  <Ionicons name="sparkles" size={22} color="#FFFFFF" />
                  <Text style={styles.aiText}>AI</Text>
                </LinearGradient>
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
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={21}
                color={active ? "#172033" : "#7E8795"}
              />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (placement === "tabbar") {
    return (
      <View pointerEvents="box-none" style={[styles.tabbarHost, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {bar}
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floatingHost, { bottom: Math.max(10, insets.bottom + 4) }]}
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
    zIndex: 120,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  tabbarHost: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 6,
    paddingHorizontal: 14,
    backgroundColor: "transparent",
  },
  glassShell: {
    width: "94%",
    maxWidth: 590,
    height: 82,
    overflow: "visible",
    borderRadius: 41,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(255,255,255,0.57)",
    boxShadow: "0 18px 48px rgba(42,52,76,0.14)",
  },
  frostLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.31)",
  },
  topHighlight: {
    position: "absolute",
    left: 25,
    right: 25,
    top: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  itemsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 9,
  },
  item: {
    width: 82,
    height: 58,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  itemActive: {
    backgroundColor: "rgba(235,237,241,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
  },
  label: {
    color: "#8A919D",
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "700",
  },
  labelActive: {
    color: "#172033",
    fontWeight: "800",
  },
  aiSlot: {
    width: 88,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
  },
  aiGlow: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(129,185,249,0.16)",
    boxShadow: "0 10px 30px rgba(112,166,239,0.22)",
  },
  aiGlowActive: {
    backgroundColor: "rgba(241,164,207,0.20)",
    boxShadow: "0 13px 34px rgba(118,166,243,0.30)",
  },
  aiButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 28px rgba(115,160,233,0.26)",
  },
  aiButtonActive: {
    transform: [{ scale: 1.025 }],
  },
  aiHighlight: {
    position: "absolute",
    top: 7,
    left: 12,
    right: 12,
    height: 15,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.23)",
  },
  aiText: {
    marginTop: 1,
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
