import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { readRoomIndex, type TravaChatRoomSummary } from "../utils/trava-chat";

function relativeTime(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  if (delta < 60_000) return "now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  return `${Math.floor(delta / 86_400_000)}d`;
}

export function MessagesScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<TravaChatRoomSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRooms(await readRoomIndex());
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TRAVA</Text>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Travel conversations, loaded instantly from this device.</Text>
        </View>
        <View style={styles.shield}><Ionicons name="shield-checkmark-outline" size={21} color="#427765" /></View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#6D69E8" />} contentContainerStyle={styles.content}>
        <View style={styles.securityCard}>
          <Ionicons name="lock-closed-outline" size={19} color="#417663" />
          <Text style={styles.securityText}>TRAVA messaging never includes “request funds” or “send funds” actions. Never share OTPs or passwords, and avoid off-platform transfers.</Text>
        </View>

        {rooms.length ? rooms.map((room) => (
          <Pressable
            key={room.roomId}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${room.agencyName}`}
            onPress={() => router.push(`/chat/${encodeURIComponent(room.roomId)}?agencyId=${encodeURIComponent(room.agencyId || "")}&agencyName=${encodeURIComponent(room.agencyName)}&travelerId=${encodeURIComponent(room.travelerId || "")}&travelerName=${encodeURIComponent(room.travelerName || "")}` as never)}
            style={({ pressed }) => [styles.roomCard, pressed && styles.pressed]}
          >
            <View style={styles.avatar}><Text style={styles.avatarText}>{room.agencyName.slice(0, 1).toUpperCase()}</Text><View style={styles.liveDot} /></View>
            <View style={styles.roomCopy}>
              <View style={styles.roomTop}><Text numberOfLines={1} style={styles.roomName}>{room.agencyName}</Text><Text style={styles.time}>{relativeTime(room.updatedAt)}</Text></View>
              <Text numberOfLines={1} style={styles.preview}>{room.lastMessage || "Open conversation"}</Text>
              {room.packageMeta ? <Text numberOfLines={1} style={styles.context}>Package: {room.packageMeta.packageTitle}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={19} color="#8A93A6" />
          </Pressable>
        )) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={30} color="#6E72EC" /></View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>Open a travel agency or tour package on Home and tap Inquire to start a secure conversation.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  eyebrow: { color: "#6D64E5", fontSize: 9, letterSpacing: 1.2, fontWeight: "900" },
  title: { marginTop: 3, color: "#14203A", fontSize: 27, lineHeight: 31, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { marginTop: 3, color: "#7E899D", fontSize: 10, fontWeight: "600" },
  shield: { width: 44, height: 44, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#F0FAF6", borderWidth: 1, borderColor: "#D9EEE5" },
  content: { paddingHorizontal: 18, paddingBottom: 110 },
  securityCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, marginBottom: 14, borderRadius: 16, backgroundColor: "#F3FAF7", borderWidth: 1, borderColor: "#DCEFE7" },
  securityText: { flex: 1, color: "#537066", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  roomCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 9, borderRadius: 20, borderWidth: 1, borderColor: "#E8EBF2", backgroundColor: "#FFFFFF", boxShadow: "0 10px 24px rgba(45,56,87,0.07)" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.994 }] },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF4FF" },
  avatarText: { color: "#5573C5", fontSize: 18, fontWeight: "900" },
  liveDot: { position: "absolute", right: 0, bottom: 2, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "#36BA6E" },
  roomCopy: { flex: 1, minWidth: 0 },
  roomTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  roomName: { flex: 1, color: "#17233E", fontSize: 13.5, fontWeight: "900" },
  time: { color: "#A0A8B7", fontSize: 9, fontWeight: "700" },
  preview: { marginTop: 4, color: "#6D788D", fontSize: 10.5, fontWeight: "600" },
  context: { marginTop: 3, color: "#7666D9", fontSize: 9, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 90, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F2FF" },
  emptyTitle: { marginTop: 16, color: "#17233E", fontSize: 16, fontWeight: "900" },
  emptyText: { marginTop: 7, maxWidth: 330, color: "#7D899C", fontSize: 11, lineHeight: 17, textAlign: "center", fontWeight: "600" },
});
