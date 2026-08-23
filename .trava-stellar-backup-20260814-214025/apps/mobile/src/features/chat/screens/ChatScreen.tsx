import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";
import {
  ensureTripChatRoom,
  getRoomTitle,
  listMessages,
  sendMessage,
  subscribeToRoom,
  type ChatMessage,
} from "../api/chat.api";

const MONEY_ACTIONS = [
  ["▤", "Send funds"],
  ["▥", "Request funds"],
  ["▧", "Recent transactions"],
] as const;

export function ChatScreen() {
  const params = useLocalSearchParams<{ roomId?: string; tripId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [resolvedRoomId, setResolvedRoomId] = useState(params.roomId ? String(params.roomId) : "");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const roomResolve = useQuery({
    queryKey: ["trip-chat-room", params.tripId],
    queryFn: () => ensureTripChatRoom(String(params.tripId)),
    enabled: !params.roomId && Boolean(params.tripId),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (params.roomId) setResolvedRoomId(String(params.roomId));
    else if (roomResolve.data) setResolvedRoomId(roomResolve.data);
  }, [params.roomId, roomResolve.data]);

  const titleQuery = useQuery({
    queryKey: ["chat-room-title", resolvedRoomId],
    queryFn: () => getRoomTitle(resolvedRoomId),
    enabled: Boolean(resolvedRoomId),
    staleTime: 60_000,
  });
  const messagesQuery = useQuery({
    queryKey: ["chat-messages", resolvedRoomId],
    queryFn: () => listMessages(resolvedRoomId),
    enabled: Boolean(resolvedRoomId),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!resolvedRoomId) return;
    const channel = subscribeToRoom(resolvedRoomId, (message) => {
      queryClient.setQueryData<ChatMessage[]>(["chat-messages", resolvedRoomId], (current = []) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    return () => {
      void getSupabaseClient().removeChannel(channel);
    };
  }, [queryClient, resolvedRoomId]);

  const sendMutation = useMutation({
    mutationFn: () => sendMessage(resolvedRoomId, draft),
    onSuccess: (message) => {
      setDraft("");
      queryClient.setQueryData<ChatMessage[]>(["chat-messages", resolvedRoomId], (current = []) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    },
    onError: (error) => Alert.alert("Message", error instanceof Error ? error.message : "Unable to send message."),
  });

  const messages = messagesQuery.data ?? [];
  const grouped = useMemo(() => messages, [messages]);
  const roomTitle = titleQuery.data || "Trip Chat";

  if (!resolvedRoomId) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#171717" />
        <Text style={styles.centerText}>{roomResolve.error instanceof Error ? roomResolve.error.message : "Preparing secure trip chat…"}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable>
          <View style={styles.contactAvatar}><Text style={styles.contactInitial}>{roomTitle.slice(0, 1).toUpperCase()}</Text></View>
          <Text numberOfLines={1} style={styles.contactName}>{roomTitle}</Text>
          <Pressable style={styles.headerButton}><Text style={styles.search}>⌕</Text></Pressable>
          <Pressable style={styles.headerButton}><Text style={styles.more}>•••</Text></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moneyActions}>
          {MONEY_ACTIONS.map(([icon, label]) => (
            <Pressable
              key={label}
              onPress={() => void Share.share({ message: `${label} · ${roomTitle}` })}
              style={({ pressed }) => [styles.moneyCard, pressed && styles.pressed]}
            >
              <Text style={styles.moneyIcon}>{icon}</Text>
              <Text style={styles.moneyLabel}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={styles.messages}
        >
          {messagesQuery.isLoading ? <ActivityIndicator color="#202020" style={{ marginTop: 28 }} /> : null}
          {!messagesQuery.isLoading && grouped.length === 0 ? (
            <View style={styles.emptyChat}><Text style={styles.emptyChatTitle}>Start the conversation</Text><Text style={styles.emptyChatText}>Messages sync in real time with accepted TRAVA chat members.</Text></View>
          ) : null}
          {grouped.map((message, index) => {
            const mine = message.senderId === user?.id;
            const prev = grouped[index - 1];
            const showDate = !prev || new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
            return (
              <View key={message.id}>
                {showDate ? <View style={styles.datePill}><Text style={styles.dateText}>{formatDate(message.createdAt)}</Text></View> : null}
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    {message.attachmentUrl ? <Image source={{ uri: message.attachmentUrl }} contentFit="cover" style={styles.attachment} /> : null}
                    {message.body ? <Text style={styles.bubbleText}>{message.body}</Text> : null}
                    <Text style={styles.messageTime}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composer}>
          <Pressable onPress={() => Alert.alert("Quick add", "Add a useful trip message.", [
            { text: "Location", onPress: () => setDraft((value) => value || "📍 Location: ") },
            { text: "Expense", onPress: () => setDraft((value) => value || "💸 Expense update: ") },
            { text: "Plan update", onPress: () => setDraft((value) => value || "🗓️ Plan update: ") },
            { text: "Cancel", style: "cancel" },
          ])} style={styles.plus}><Text style={styles.plusText}>＋</Text></Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
            placeholder="Enter message"
            placeholderTextColor="#A4A4A4"
            style={styles.input}
            onSubmitEditing={() => draft.trim() && !sendMutation.isPending && sendMutation.mutate()}
          />
          <Pressable
            disabled={!draft.trim() || sendMutation.isPending}
            onPress={() => sendMutation.mutate()}
            style={[styles.send, (!draft.trim() || sendMutation.isPending) && styles.sendDisabled]}
          >
            {sendMutation.isPending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.sendText}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FFFFFF" },
  centerText: { color: "#7F7F7F", fontSize: 11, fontWeight: "700" },
  header: { height: 70, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#EFEFEF", backgroundColor: "#FFFFFF" },
  headerButton: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FBFBFB" },
  back: { marginTop: -4, color: "#171717", fontSize: 33, lineHeight: 35 },
  search: { color: "#171717", fontSize: 25, fontWeight: "500" },
  more: { marginTop: -6, color: "#171717", fontSize: 13, letterSpacing: -1.3, fontWeight: "900" },
  contactAvatar: { width: 32, height: 32, marginLeft: 7, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#ECECEC", overflow: "hidden" },
  contactInitial: { color: "#343434", fontSize: 12, fontWeight: "900" },
  contactName: { flex: 1, minWidth: 0, marginHorizontal: 9, color: "#171717", fontSize: 15, fontWeight: "900" },
  moneyActions: { paddingHorizontal: 16, paddingVertical: 15, gap: 9 },
  moneyCard: { width: 145, height: 92, justifyContent: "center", paddingHorizontal: 18, borderRadius: 25, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECECEC" },
  moneyIcon: { color: "#8B8B8B", fontSize: 23 },
  moneyLabel: { marginTop: 16, color: "#171717", fontSize: 14, fontWeight: "700" },
  messages: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  emptyChat: { marginTop: 70, alignItems: "center", paddingHorizontal: 30 },
  emptyChatTitle: { color: "#202020", fontSize: 15, fontWeight: "900" },
  emptyChatText: { marginTop: 5, maxWidth: 320, textAlign: "center", color: "#8C8C8C", fontSize: 10, lineHeight: 16, fontWeight: "600" },
  datePill: { alignSelf: "center", marginVertical: 16, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: "#F5F5F5" },
  dateText: { color: "#828282", fontSize: 9, fontWeight: "700" },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start", marginVertical: 4 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "79%", paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7, borderRadius: 18 },
  bubbleMine: { borderBottomRightRadius: 6, backgroundColor: "#E9E9E9" },
  bubbleOther: { borderBottomLeftRadius: 6, backgroundColor: "#F5F5F5" },
  bubbleText: { color: "#202020", fontSize: 13, lineHeight: 19, fontWeight: "500" },
  messageTime: { marginTop: 3, alignSelf: "flex-end", color: "#999999", fontSize: 6, fontWeight: "600" },
  attachment: { width: 220, height: 140, marginBottom: 7, borderRadius: 14, backgroundColor: "#F1F1F1" },
  composer: { minHeight: 68, flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 13, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F0F0F0", backgroundColor: "#FFFFFF" },
  plus: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  plusText: { color: "#161616", fontSize: 31, lineHeight: 34, fontWeight: "300" },
  input: { flex: 1, minHeight: 44, maxHeight: 110, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 23, color: "#202020", backgroundColor: "#F7F7F7", fontSize: 12, fontWeight: "600" },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#252525" },
  sendDisabled: { backgroundColor: "#CFCFCF" },
  sendText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  pressed: { opacity: 0.7 },
});
