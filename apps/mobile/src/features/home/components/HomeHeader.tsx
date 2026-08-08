import { Pressable, StyleSheet, Text, View } from "react-native";

interface HomeHeaderProps {
  name: string;
  notificationCount: number;
  onNotificationsPress(): void;
  onProfilePress(): void;
}

export function HomeHeader({
  name,
  notificationCount,
  onNotificationsPress,
  onProfilePress,
}: HomeHeaderProps) {
  const firstName = name.trim().split(/\s+/)[0] || "Explorer";

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.greeting}>Hi, {firstName}! 👋</Text>
        <Text style={styles.title}>
          Where will TRAVA AI{"\n"}take <Text style={styles.emphasis}>you</Text> next?
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfilePress}
          style={({ pressed }: { pressed: boolean }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconGlyph}>☺</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}
          onPress={onNotificationsPress}
          style={({ pressed }: { pressed: boolean }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconGlyph}>⌁</Text>
          {notificationCount > 0 ? <View style={styles.badge} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  copy: { flex: 1, minWidth: 0 },
  greeting: {
    color: "#7055ED",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    marginBottom: 7,
  },
  title: {
    color: "#0F1B37",
    fontSize: 31,
    lineHeight: 34,
    letterSpacing: -1.2,
    fontWeight: "900",
  },
  emphasis: { color: "#7559EF", fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 9 },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(231,233,247,0.95)",
    shadowColor: "#3F446D",
    shadowOpacity: 0.12,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  iconGlyph: { color: "#405072", fontSize: 23, lineHeight: 26, fontWeight: "800" },
  badge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#FF5B84",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
