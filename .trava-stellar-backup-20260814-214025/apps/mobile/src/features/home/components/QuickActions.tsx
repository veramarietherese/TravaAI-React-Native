import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export type HomeQuickActionKey = "create" | "explore" | "budget" | "invite";

interface QuickActionsProps {
  onPress(action: HomeQuickActionKey): void;
}

const ACTIONS = [
  {
    key: "create",
    title: "Create Trip",
    asset: require("../../../../assets/images/home/globe.png"),
    colors: ["#F7F0FF", "#FFF1F6"] as const,
  },
  {
    key: "explore",
    title: "Explore Destinations",
    asset: require("../../../../assets/images/home/luggage.png"),
    colors: ["#FFF2F7", "#FFF4F0"] as const,
  },
  {
    key: "budget",
    title: "Budget Planner",
    asset: require("../../../../assets/images/home/wallet.png"),
    colors: ["#EEF4FF", "#F5F8FF"] as const,
  },
  {
    key: "invite",
    title: "Invite Friends",
    asset: require("../../../../assets/images/home/invite.png"),
    colors: ["#F6F0FF", "#FBF6FF"] as const,
  },
] as const;

export function QuickActions({ onPress }: QuickActionsProps) {
  const { width } = useWindowDimensions();
  const compact = width < 520;

  return (
    <View style={styles.root}>
      {ACTIONS.map((action) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.title}
          key={action.key}
          onPress={() => onPress(action.key)}
          style={({ pressed }) => [
            styles.pressable,
            compact ? styles.cardCompact : styles.cardWide,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={[action.colors[0], action.colors[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Image
              source={action.asset}
              contentFit="contain"
              transition={120}
              cachePolicy="memory-disk"
              style={styles.asset}
            />
            <Text numberOfLines={1} style={styles.title}>{action.title}</Text>
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pressable: { minWidth: 0 },
  cardWide: { flex: 1, minWidth: 150 },
  cardCompact: { width: "48.4%", flexGrow: 1 },
  card: {
    minHeight: 104,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.94)",
    overflow: "hidden",
  },
  asset: { width: 48, height: 48 },
  title: { marginTop: 7, color: "#16213A", fontSize: 11, lineHeight: 14, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.988 }] },
});
