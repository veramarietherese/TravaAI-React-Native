import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface PremiumHomeHeaderProps {
  name: string;
  avatarUrl: string | null;
  notificationCount: number;
  onMessagesPress(): void;
  onNotificationsPress(): void;
  onProfilePress(): void;
  onCommandCenterPress(): void;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function PremiumHomeHeader({
  name,
  avatarUrl,
  notificationCount,
  onMessagesPress,
  onNotificationsPress,
  onProfilePress,
  onCommandCenterPress,
}: PremiumHomeHeaderProps) {
  const firstName = name.trim().split(/\s+/)[0] || "Explorer";
  const initials = firstName.slice(0, 1).toUpperCase();

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Image
            source={require("../../assets/premium-home/trava-wordmark.png")}
            contentFit="contain"
            contentPosition="left center"
            style={styles.wordmark}
          />
          <Text style={styles.greeting}>
            {getGreeting()}, <Text style={styles.name}>{firstName}</Text> 👋
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open messages" onPress={onMessagesPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#14203F" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open notifications${notificationCount ? `, ${notificationCount} unread` : ""}`} onPress={onNotificationsPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="notifications-outline" size={21} color="#14203F" />
            {notificationCount > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={onProfilePress} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={["#B8D3FF", "#F5B6D7"]} style={StyleSheet.absoluteFill} />
            )}
            {!avatarUrl ? <Text style={styles.initials}>{initials}</Text> : null}
          </Pressable>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Open your travel command center" onPress={onCommandCenterPress} style={({ pressed }) => [styles.commandPill, pressed && styles.pressed]}>
        <Text style={styles.commandSparkle}>✦</Text>
        <Text style={styles.commandText}>Your travel command center</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 2 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  wordmark: { width: 148, height: 42 },
  greeting: { marginTop: 2, color: "#1C2545", fontSize: 15.5, lineHeight: 21, fontWeight: "600" },
  name: { color: "#131B37", fontWeight: "900" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(222,221,241,0.82)",
    shadowColor: "#7976A8",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  notificationDot: { position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4F91", borderWidth: 1.5, borderColor: "#FFFFFF" },
  avatarButton: { width: 43, height: 43, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3FF" },
  initials: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  commandPill: { alignSelf: "flex-start", marginTop: 8, minHeight: 36, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D9D0FF" },
  commandSparkle: { color: "#7163FF", fontSize: 14, fontWeight: "900" },
  commandText: { color: "#665BEE", fontSize: 11.5, fontWeight: "800" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
