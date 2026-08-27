import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TripSummary } from "@trava/shared";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { listTrips } from "@/features/trips/api/trips.api";
import { searchWorldPlaces } from "@/features/maps/utils/world-place-search";
import { resolveFreePlaceImage } from "@/features/maps/utils/place-photo";
import { addDiscoverPlaceToItinerary } from "@/features/explore/utils/add-place-to-itinerary";
import type { DiscoverPlace } from "@/features/explore/components/DiscoverMap.types";
import { sendAiMessage, type AiHistoryTurn } from "../api/ai.api";

type Recommendation = {
  id: string;
  name: string;
  detail: string;
  place?: DiscoverPlace | null;
};

type UiMessage = AiHistoryTurn & {
  id: string;
  createdAt: string;
  recommendations?: Recommendation[];
};

const QUICK = [
  "✈ Suggest day itinerary",
  "🍜 Food recommendations",
  "🧳 Budget travel tips",
  "🗺 Best time to visit",
  "🏨 Hotel suggestions",
  "📝 Plan a new trip",
];

export function AiScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState(QUICK);
  const [tripPicker, setTripPicker] = useState<Recommendation | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [day, setDay] = useState(1);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const storageKey = useMemo(() => `trava-ai-native:${user?.id || "guest"}`, [user?.id]);

  const avatar =
    profile?.avatar_url ||
    (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = JSON.parse(raw) as UiMessage[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-40));
      } catch {
        // Ignore stale chat cache.
      }
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    void AsyncStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 70);
    return () => clearTimeout(timer);
  }, [messages, sending, storageKey]);

  async function attachFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      const asset = !result.canceled ? result.assets?.[0] : null;
      if (!asset) return;
      setInput((current) => `${current}${current.trim() ? "\n" : ""}Attached travel file: ${asset.name}`.slice(0, 4000));
    } catch {
      // The picker can be cancelled or unavailable without breaking chat.
    }
  }

  async function submit(raw = input) {
    const text = stripPromptEmoji(raw).trim();
    if (!text || sending) return;

    const userMessage: UiMessage = {
      id: makeId(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
    };
    const history = messages.map(({ role, text: value }) => ({ role, text: value }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    try {
      const result = await sendAiMessage(text, history);
      const clean = cleanAssistantText(result.reply);
      const recommendations = await hydrateRecommendations(extractRecommendations(result.reply));

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          text: clean,
          recommendations,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (result.quickReplies?.length) {
        setQuickReplies(result.quickReplies.slice(0, 6).map((item) => cleanAssistantText(item)));
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          text: cleanAssistantText(error instanceof Error ? error.message : "TRAVA AI could not answer right now."),
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function openTripPicker(recommendation: Recommendation) {
    setTripPicker(recommendation);
    setDay(1);
    if (!trips.length) {
      try {
        const result = (await listTrips()).filter((trip) => trip.status !== "completed");
        setTrips(result);
        setTripId(result[0]?.id ? String(result[0].id) : null);
      } catch {
        setTrips([]);
      }
    }
  }

  async function addRecommendation() {
    if (!tripPicker?.place || !tripId || adding) return;
    const trip = trips.find((item) => String(item.id) === tripId);
    if (!trip) return;

    setAdding(true);
    try {
      await addDiscoverPlaceToItinerary({
        trip,
        place: tripPicker.place,
        dayNumber: day,
        startTime: "09:00",
      });
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          text: `Done. ${tripPicker.name} has been added to Day ${day} of ${trip.name}.`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTripPicker(null);
    } finally {
      setAdding(false);
    }
  }

  const visible: UiMessage[] = messages.length
    ? messages
    : [
        { id: "welcome-1", role: "assistant", text: "Hey there! 👋", createdAt: new Date().toISOString() },
        { id: "welcome-2", role: "assistant", text: "I’m Trava AI, here to help you plan smarter trips and unforgettable experiences.", createdAt: new Date().toISOString() },
      ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={72}>
        <LinearGradient colors={["#F4F8FF", "#FBFDFF", "#F4F8FF"]} style={s.flex}>
          <View style={s.shell}>
            <View style={s.header}>
              <View style={s.brand}>
                <BotAvatar size={45} />
                <View>
                  <Text style={s.title}>Trava AI Assistant</Text>
                  <Text style={s.subtitle}>Your smart travel companion</Text>
                </View>
              </View>

              <View style={s.headerActions}>
                <Pressable onPress={() => { setMessages([]); setQuickReplies(QUICK); }} style={s.headerButton}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="#28354B" />
                </Pressable>
                <Pressable onPress={() => router.back()} style={s.headerButton}>
                  <Ionicons name="close" size={28} color="#28354B" />
                </Pressable>
              </View>
            </View>

            <View style={s.divider} />

            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.messages}
            >
              <Text style={s.today}>Today</Text>

              {visible.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  avatar={avatar}
                  onAdd={(rec) => void openTripPicker(rec)}
                  onMap={(rec) => router.push(`/(traveler)/(tabs)/explore?query=${encodeURIComponent(rec.name)}` as Href)}
                />
              ))}

              {sending ? (
                <View style={s.aiRow}>
                  <BotAvatar size={38} />
                  <View style={s.typing}>
                    <ActivityIndicator color="#6B7FE7" />
                    <Text style={s.typingText}>Planning your answer…</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={s.quickArea}>
              <View style={s.quickWrap}>
                {quickReplies.map((prompt) => (
                  <Pressable key={prompt} disabled={sending} onPress={() => void submit(prompt)} style={({ pressed }) => [s.quick, pressed && s.quickPressed]}>
                    <Text style={s.quickText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.composerArea}>
              <View style={s.composer}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={4000}
                  placeholder="Ask me anything about your trip..."
                  placeholderTextColor="#A1ACBE"
                  style={s.input}
                />
                <Pressable accessibilityLabel="Attach travel file" onPress={() => void attachFile()} style={s.attach}><Ionicons name="attach-outline" size={25} color="#5F6C82" /></Pressable>
              </View>
              <Pressable disabled={!input.trim() || sending} onPress={() => void submit()} style={[s.send, (!input.trim() || sending) && s.sendOff]}>
                <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={s.disclaimer}>Trava AI can make mistakes. Please double-check important details.</Text>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>

      <TripPicker
        recommendation={tripPicker}
        trips={trips}
        tripId={tripId}
        day={day}
        adding={adding}
        onTrip={setTripId}
        onDay={setDay}
        onClose={() => setTripPicker(null)}
        onAdd={() => void addRecommendation()}
      />
    </SafeAreaView>
  );
}

function MessageRow({
  message,
  avatar,
  onAdd,
  onMap,
}: {
  message: UiMessage;
  avatar: string | null;
  onAdd(rec: Recommendation): void;
  onMap(rec: Recommendation): void;
}) {
  const appear = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [appear]);

  const translateY = appear.interpolate({ inputRange: [0, 1], outputRange: [7, 0] });

  if (message.role === "user") {
    return (
      <Animated.View style={[s.userRow, { opacity: appear, transform: [{ translateY }] }]}>
        <View style={s.userBubble}><Text style={s.userText}>{message.text}</Text></View>
        <View style={s.userAvatar}>
          {avatar ? <Image source={{ uri: avatar }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={s.userAvatarText}>🙂</Text>}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[s.aiRow, { opacity: appear, transform: [{ translateY }] }]}>
      <BotAvatar size={38} />
      <View style={s.aiContent}>
        <View style={s.aiBubble}>
          {message.text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
            <Text key={`${message.id}-p-${index}`} style={[s.aiText, index > 0 && { marginTop: 8 }]}>{paragraph.trim()}</Text>
          ))}
        </View>

        {message.recommendations?.length ? (
          <View style={s.recommendationCard}>
            {message.recommendations.map((rec, index) => (
              <View key={rec.id} style={[s.recommendation, index > 0 && s.recommendationBorder]}>
                <View style={s.recImage}>
                  {rec.place?.imageUrl ? <Image source={{ uri: rec.place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <LinearGradient colors={["#EAF4FF", "#F8ECFF"]} style={StyleSheet.absoluteFill} />}
                </View>
                <View style={s.recCopy}>
                  <Text numberOfLines={1} style={s.recName}>{rec.name}</Text>
                  <Text numberOfLines={2} style={s.recDetail}>{rec.detail}</Text>
                  <View style={s.recActions}>
                    <Pressable disabled={!rec.place} onPress={() => onMap(rec)} style={s.recLink}><Text style={s.recLinkText}>View on map</Text></Pressable>
                    <Pressable disabled={!rec.place} onPress={() => onAdd(rec)} style={[s.addRec, !rec.place && s.addRecOff]}>
                      <Ionicons name="add" size={15} color="#56627A" />
                      <Text style={s.addRecText}>Add to Itinerary</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function BotAvatar({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={["#7CDDF1", "#A48AF5", "#F19CC7"]}
      start={{ x: 0.05, y: 0.8 }}
      end={{ x: 0.95, y: 0.15 }}
      style={[s.bot, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View style={[s.botFace, { width: size * 0.55, height: size * 0.32, borderRadius: size * 0.13 }]}>
        <View style={s.botEye} /><View style={s.botEye} />
      </View>
    </LinearGradient>
  );
}

function TripPicker(props: {
  recommendation: Recommendation | null;
  trips: TripSummary[];
  tripId: string | null;
  day: number;
  adding: boolean;
  onTrip(value: string): void;
  onDay(value: number): void;
  onClose(): void;
  onAdd(): void;
}) {
  if (!props.recommendation) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalTitle}>Add to itinerary</Text>
              <Text style={s.modalSub}>{props.recommendation.name}</Text>
            </View>
            <Pressable onPress={props.onClose} style={s.close}><Ionicons name="close" size={20} color="#617088" /></Pressable>
          </View>

          <Text style={s.label}>Choose trip</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tripRow}>
            {props.trips.map((trip) => (
              <Pressable key={String(trip.id)} onPress={() => props.onTrip(String(trip.id))} style={[s.tripChip, props.tripId === String(trip.id) && s.tripChipOn]}>
                <Text style={[s.tripChipText, props.tripId === String(trip.id) && s.tripChipTextOn]}>{trip.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={s.label}>Day</Text>
          <View style={s.dayControl}>
            <Pressable onPress={() => props.onDay(Math.max(1, props.day - 1))} style={s.dayButton}><Ionicons name="remove" size={18} color="#617088" /></Pressable>
            <Text style={s.dayValue}>Day {props.day}</Text>
            <Pressable onPress={() => props.onDay(props.day + 1)} style={s.dayButton}><Ionicons name="add" size={18} color="#617088" /></Pressable>
          </View>

          <Pressable disabled={!props.tripId || !props.recommendation.place || props.adding} onPress={props.onAdd} style={[s.modalAction, (!props.tripId || !props.recommendation.place) && s.modalActionOff]}>
            {props.adding ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" /><Text style={s.modalActionText}>Add place</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

async function hydrateRecommendations(items: Recommendation[]) {
  return Promise.all(items.slice(0, 3).map(async (item) => {
    try {
      const result = await searchWorldPlaces(item.name, null, 1);
      const found = result[0];
      if (!found) return item;
      const imageUrl = await resolveFreePlaceImage(found);
      return {
        ...item,
        place: {
          id: found.id,
          name: found.name,
          subtitle: found.displayName,
          latitude: found.latitude,
          longitude: found.longitude,
          imageUrl,
          rating: 0,
          distance: "Suggested by Trava AI",
          category: found.category || "Sightseeing",
          city: found.city,
          country: found.country,
        },
      };
    } catch {
      return item;
    }
  }));
}

function extractRecommendations(raw: string): Recommendation[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const output: Recommendation[] = [];

  for (const line of lines) {
    const match = line.match(/^(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (!match) continue;
    const cleaned = cleanAssistantText(match[1] || "");
    const parts = cleaned.split(/\s+[–—-]\s+|:\s+/);
    const name = (parts.shift() || "").trim();
    const detail = parts.join(" — ").trim();
    if (name.length < 3 || name.length > 75) continue;
    output.push({ id: `rec-${output.length}-${name}`, name, detail: detail || "Recommended by Trava AI." });
    if (output.length >= 3) break;
  }

  return output;
}

function cleanAssistantText(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripPromptEmoji(value: string) {
  return value.replace(/^[^\p{L}\p{N}]+/u, "");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#F4F8FF" },
  shell: { flex: 1, width: "100%", maxWidth: 820, alignSelf: "center", backgroundColor: "rgba(255,255,255,.74)", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#E8EDF5" },
  header: { minHeight: 92, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 13 },
  bot: { alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(128,120,222,.20)" },
  botFace: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", backgroundColor: "#4C43B9" },
  botEye: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF" },
  title: { color: "#17213A", fontSize: 19, fontWeight: "800" },
  subtitle: { marginTop: 4, color: "#8B96AA", fontSize: 12, fontWeight: "500" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: "#E6EBF2" },
  messages: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 20, gap: 12 },
  today: { alignSelf: "center", color: "#8E99AA", fontSize: 12, fontWeight: "500", marginBottom: 8 },
  aiRow: { width: "100%", flexDirection: "row", alignItems: "flex-end", gap: 10 },
  aiContent: { flex: 1, maxWidth: "86%" },
  aiBubble: { alignSelf: "flex-start", maxWidth: "82%", paddingHorizontal: 16, paddingVertical: 13, borderRadius: 19, borderBottomLeftRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EDF3", boxShadow: "0 7px 20px rgba(42,58,88,.06)" },
  aiText: { color: "#1D273A", fontSize: 14, lineHeight: 20, fontWeight: "500" },
  userRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 9 },
  userBubble: { maxWidth: "72%", paddingHorizontal: 18, paddingVertical: 13, borderRadius: 19, borderBottomRightRadius: 7, backgroundColor: "#132030" },
  userText: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "500" },
  userAvatar: { width: 38, height: 38, overflow: "hidden", borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F7C2D2" },
  userAvatarText: { fontSize: 19 },
  typing: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF" },
  typingText: { color: "#7B879A", fontSize: 10, fontWeight: "600" },
  recommendationCard: { marginTop: 8, overflow: "hidden", borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EBF1" },
  recommendation: { minHeight: 104, padding: 12, flexDirection: "row", gap: 12 },
  recommendationBorder: { borderTopWidth: 1, borderTopColor: "#E9EDF2" },
  recImage: { width: 80, height: 76, overflow: "hidden", borderRadius: 13, backgroundColor: "#EEF2F7" },
  recCopy: { flex: 1, minWidth: 0 },
  recName: { color: "#17213A", fontSize: 14, fontWeight: "800" },
  recDetail: { marginTop: 4, color: "#69768B", fontSize: 10, lineHeight: 14, fontWeight: "500" },
  recActions: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recLink: { minHeight: 30, justifyContent: "center" },
  recLinkText: { color: "#4773CE", fontSize: 9, fontWeight: "800" },
  addRec: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFD", borderWidth: 1, borderColor: "#E3E8F0" },
  addRecOff: { opacity: 0.45 },
  addRecText: { color: "#56627A", fontSize: 8.5, fontWeight: "800" },
  quickArea: { paddingHorizontal: 22, paddingTop: 8 },
  quickWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  quick: { minHeight: 38, paddingHorizontal: 13, borderRadius: 19, justifyContent: "center", backgroundColor: "rgba(255,255,255,.94)", borderWidth: 1, borderColor: "#E4E9F0" },
  quickPressed: { opacity: 0.72 },
  quickText: { color: "#5F6D82", fontSize: 10, fontWeight: "600" },
  composerArea: { paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 9 },
  composer: { flex: 1, minHeight: 58, paddingLeft: 17, paddingRight: 10, borderRadius: 22, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5EAF1", boxShadow: "0 8px 22px rgba(43,59,87,.05)" },
  input: { flex: 1, maxHeight: 100, minHeight: 42, paddingVertical: 10, color: "#243047", fontSize: 13, lineHeight: 18 },
  attach: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#142A43", boxShadow: "0 8px 18px rgba(20,42,67,.18)" },
  sendOff: { opacity: 0.42 },
  disclaimer: { paddingVertical: 13, textAlign: "center", color: "#939EAF", fontSize: 9, fontWeight: "500" },
  modalBackdrop: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(12,19,33,.42)" },
  modal: { width: "100%", maxWidth: 520, padding: 20, borderRadius: 27, backgroundColor: "#FFFFFF", boxShadow: "0 24px 70px rgba(25,35,58,.20)" },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  modalTitle: { color: "#17213A", fontSize: 19, fontWeight: "900" },
  modalSub: { marginTop: 4, color: "#7E899A", fontSize: 10, fontWeight: "600" },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F8" },
  label: { marginTop: 15, marginBottom: 8, color: "#68768C", fontSize: 9, fontWeight: "900" },
  tripRow: { gap: 7 },
  tripChip: { minHeight: 36, paddingHorizontal: 11, borderRadius: 18, justifyContent: "center", backgroundColor: "#F4F6F9" },
  tripChipOn: { backgroundColor: "#EAF1FF" },
  tripChipText: { color: "#748095", fontSize: 9, fontWeight: "800" },
  tripChipTextOn: { color: "#5474BA" },
  dayControl: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F8" },
  dayValue: { minWidth: 80, textAlign: "center", color: "#233149", fontSize: 12, fontWeight: "900" },
  modalAction: { marginTop: 18, height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#142A43" },
  modalActionOff: { opacity: 0.45 },
  modalActionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
