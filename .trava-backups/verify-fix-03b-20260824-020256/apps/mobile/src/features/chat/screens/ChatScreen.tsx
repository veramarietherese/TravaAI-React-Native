import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  appendUnique,
  createRoomRealtime,
  looksLikePaymentScam,
  makeMessage,
  readRoomMessages,
  type TravaChatMessage,
  type TravaChatPackageMeta,
  upsertRoomIndex,
  writeRoomMessages,
} from "../utils/trava-chat";

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const roomId = single(params.roomId) || "travel-chat";
  const agencyId = single(params.agencyId);
  const agencyName = single(params.agencyName) || "Travel Agency";
  const travelerId = single(params.travelerId) || user?.id || "traveler";
  const travelerName = single(params.travelerName) || profile?.full_name || user?.email?.split("@")[0] || "Traveler";
  const senderId = user?.id || travelerId;
  const senderName = profile?.full_name || travelerName;

  const packageMeta = useMemo<TravaChatPackageMeta | undefined>(() => {
    const packageId = single(params.packageId);
    if (!packageId) return undefined;
    return {
      packageId,
      packageTitle: single(params.packageTitle) || "Travel package",
      packagePrice: single(params.packagePrice) || "0",
      currencyCode: single(params.currencyCode) || "PHP",
      packageDays: single(params.packageDays) || "0",
      packageNights: single(params.packageNights) || "0",
      destination: single(params.destination),
      packageImage: single(params.packageImage) || undefined,
    };
  }, [params]);

  const [messages, setMessages] = useState<TravaChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof createRoomRealtime> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    void readRoomMessages(roomId).then((saved) => {
      if (!active) return;
      setMessages(saved);
      setHydrated(true);
    });

    const realtime = createRoomRealtime(roomId, (incoming) => {
      setMessages((current) => {
        const next = appendUnique(current, incoming);
        void writeRoomMessages(roomId, next);
        void upsertRoomIndex({
          roomId,
          agencyId,
          agencyName,
          travelerId,
          travelerName,
          lastMessage: incoming.kind === "package" ? `Shared ${incoming.packageMeta?.packageTitle || "a package"}` : incoming.body,
          updatedAt: incoming.createdAt,
          packageMeta: incoming.packageMeta,
        });
        return next;
      });
    });
    realtimeRef.current = realtime;

    return () => {
      active = false;
      void realtime.close();
      realtimeRef.current = null;
    };
  }, [agencyId, agencyName, roomId, travelerId, travelerName]);

  useEffect(() => {
    if (!hydrated || !packageMeta) return;
    if (messages.some((message) => message.kind === "package" && message.packageMeta?.packageId === packageMeta.packageId)) return;

    const packageMessage = makeMessage({
      roomId,
      senderId,
      senderName,
      body: `I’d like to ask about ${packageMeta.packageTitle}.`,
      kind: "package",
      packageMeta,
    });
    const next = appendUnique(messages, packageMessage);
    setMessages(next);
    void writeRoomMessages(roomId, next);
    void upsertRoomIndex({ roomId, agencyId, agencyName, travelerId, travelerName, lastMessage: `Shared ${packageMeta.packageTitle}`, updatedAt: packageMessage.createdAt, packageMeta });
    void realtimeRef.current?.send(packageMessage).catch(() => undefined);
  }, [agencyId, agencyName, hydrated, messages, packageMeta, roomId, senderId, senderName, travelerId, travelerName]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  async function sendText() {
    const body = draft.trim();
    if (!body) return;
    const message = makeMessage({ roomId, senderId, senderName, body, kind: "text" });
    const next = appendUnique(messages, message);
    setMessages(next);
    setDraft("");
    await writeRoomMessages(roomId, next);
    await upsertRoomIndex({ roomId, agencyId, agencyName, travelerId, travelerName, lastMessage: body, updatedAt: message.createdAt, packageMeta });
    await realtimeRef.current?.send(message).catch(() => undefined);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.roundButton}>
            <Ionicons name="chevron-back" size={23} color="#17233E" />
          </Pressable>
          <View style={styles.avatar}><Text style={styles.avatarText}>{agencyName.slice(0, 1).toUpperCase()}</Text><View style={styles.onlineDot} /></View>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>{agencyName}</Text>
            <Text style={styles.onlineText}>Live TRAVA chat</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="View agency" onPress={() => agencyId && router.push(`/agency/${encodeURIComponent(agencyId)}` as never)} style={styles.viewAgency}>
            <Text style={styles.viewAgencyText}>View agency</Text>
          </Pressable>
        </View>

        <View style={styles.securityBanner}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#347A64" />
          <Text style={styles.securityText}>For your safety, never share passwords or OTPs. Avoid off-platform bank transfers; use verified agency checkout only.</Text>
        </View>

        <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color="#7A83EE" />
              <Text style={styles.emptyTitle}>Start your conversation</Text>
              <Text style={styles.emptyText}>Ask about dates, inclusions, itinerary details, availability, or verified booking steps.</Text>
            </View>
          ) : null}

          {messages.map((message) => {
            const mine = message.senderId === senderId;
            const risky = !mine && looksLikePaymentScam(message.body);
            return (
              <View key={message.id} style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                {message.kind === "package" && message.packageMeta ? (
                  <View style={[styles.packageBubble, mine && styles.packageBubbleMine]}>
                    {message.packageMeta.packageImage ? <Image source={{ uri: message.packageMeta.packageImage }} contentFit="cover" style={styles.packageImage} /> : <View style={[styles.packageImage, styles.packageImageFallback]} />}
                    <View style={styles.packageCopy}>
                      <Text numberOfLines={1} style={styles.packageTitle}>{message.packageMeta.packageTitle}</Text>
                      <Text style={styles.packageMeta}>{message.packageMeta.packageDays} Days • {message.packageMeta.packageNights} Nights{message.packageMeta.destination ? ` • ${message.packageMeta.destination}` : ""}</Text>
                      <Text style={styles.packagePrice}>{message.packageMeta.currencyCode} {Number(message.packageMeta.packagePrice || 0).toLocaleString()}</Text>
                      <Pressable accessibilityRole="button" onPress={() => router.push(`/package/${encodeURIComponent(message.packageMeta!.packageId)}` as never)} style={styles.viewPackageButton}>
                        <Text style={styles.viewPackageText}>View package</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <LinearGradient
                    colors={mine ? ["#6E69F5", "#7199F4"] : ["#FFFFFF", "#FBFCFF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                  >
                    <Text style={[styles.messageText, mine && styles.messageTextMine]}>{message.body}</Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>{formatTime(message.createdAt)}</Text>
                  </LinearGradient>
                )}
                {risky ? (
                  <View style={styles.riskWarning}>
                    <Ionicons name="warning-outline" size={15} color="#A46519" />
                    <Text style={styles.riskText}>Potential scam signal detected. Do not send money, passwords, or OTPs through chat.</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void sendText()}
              placeholder={`Message ${agencyName}`}
              placeholderTextColor="#9BA5B7"
              returnKeyType="send"
              style={styles.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim()} onPress={() => void sendText()} style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}>
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#EEF0F5" },
  roundButton: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECF3", boxShadow: "0 8px 20px rgba(48,60,90,0.08)" },
  avatar: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF7FF", borderWidth: 1, borderColor: "#D7EAF8" },
  avatarText: { color: "#4A6EBA", fontSize: 17, fontWeight: "900" },
  onlineDot: { position: "absolute", right: -1, bottom: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "#33B96B" },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: "#14203A", fontSize: 16, lineHeight: 20, fontWeight: "900" },
  onlineText: { marginTop: 2, color: "#35A966", fontSize: 10, fontWeight: "700" },
  viewAgency: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: "#F7F5FF" },
  viewAgencyText: { color: "#6654D8", fontSize: 10, fontWeight: "900" },
  securityBanner: { marginHorizontal: 16, marginTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, borderRadius: 15, backgroundColor: "#F0FAF6", borderWidth: 1, borderColor: "#D8EFE5" },
  securityText: { flex: 1, color: "#4C6B61", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 24 },
  emptyState: { alignItems: "center", paddingVertical: 58, paddingHorizontal: 28 },
  emptyTitle: { marginTop: 12, color: "#17233E", fontSize: 16, fontWeight: "900" },
  emptyText: { marginTop: 7, maxWidth: 390, color: "#7D899D", fontSize: 11, lineHeight: 17, textAlign: "center", fontWeight: "600" },
  messageRow: { marginBottom: 12, maxWidth: "84%" },
  messageRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageRowOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { minWidth: 88, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderRadius: 20 },
  bubbleMine: { borderBottomRightRadius: 7 },
  bubbleOther: { borderWidth: 1, borderColor: "#E8EBF3", borderBottomLeftRadius: 7, boxShadow: "0 6px 16px rgba(49,60,92,0.06)" },
  messageText: { color: "#1D2A47", fontSize: 14, lineHeight: 20, fontWeight: "500" },
  messageTextMine: { color: "#FFFFFF" },
  time: { marginTop: 5, color: "#9AA4B4", fontSize: 9, textAlign: "right", fontWeight: "600" },
  timeMine: { color: "rgba(255,255,255,0.76)" },
  packageBubble: { width: 390, maxWidth: "100%", flexDirection: "row", gap: 12, padding: 11, borderRadius: 20, borderWidth: 1, borderColor: "#E7EAF4", backgroundColor: "#FFFFFF", boxShadow: "0 8px 22px rgba(49,60,92,0.08)" },
  packageBubbleMine: { backgroundColor: "#FBFAFF" },
  packageImage: { width: 92, height: 92, borderRadius: 15, backgroundColor: "#E9EDF6" },
  packageImageFallback: { backgroundColor: "#EAF1FF" },
  packageCopy: { flex: 1, minWidth: 0 },
  packageTitle: { color: "#17233E", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  packageMeta: { marginTop: 4, color: "#7D899C", fontSize: 9.5, lineHeight: 13, fontWeight: "600" },
  packagePrice: { marginTop: 7, color: "#654EE0", fontSize: 12, fontWeight: "900" },
  viewPackageButton: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11, backgroundColor: "#F2EFFF" },
  viewPackageText: { color: "#6652D7", fontSize: 9.5, fontWeight: "900" },
  riskWarning: { marginTop: 6, maxWidth: 360, flexDirection: "row", gap: 6, padding: 8, borderRadius: 11, backgroundColor: "#FFF7E8", borderWidth: 1, borderColor: "#F5DEB6" },
  riskText: { flex: 1, color: "#8B641F", fontSize: 9, lineHeight: 13, fontWeight: "700" },
  composerWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderTopColor: "#EEF0F5", backgroundColor: "rgba(255,255,255,0.97)" },
  composer: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 15, paddingRight: 6, borderRadius: 22, borderWidth: 1, borderColor: "#E5E8F0", backgroundColor: "#FFFFFF", boxShadow: "0 8px 24px rgba(45,56,87,0.08)" },
  input: { flex: 1, minHeight: 48, color: "#19243D", fontSize: 14 },
  sendButton: { width: 42, height: 42, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#6C72EE" },
  sendButtonDisabled: { opacity: 0.35 },
});
