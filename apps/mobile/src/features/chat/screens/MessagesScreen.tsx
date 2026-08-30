import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  markRoomRead,
  readRoomIndex,
  roomContextLabel,
  roomUnreadCount,
  toggleRoomPinned,
  type TravaChatRoomSummary,
} from "../utils/trava-chat";

const SAFE_BANNER_KEY = "trava:messages:safety-banner-dismissed:v1";
type MessageFilter = "all" | "unread" | "agencies" | "bookings";

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const delta = Math.max(0, Date.now() - date.getTime());
  if (delta < 60_000) return "now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (delta < 172_800_000) return "Yesterday";
  if (delta < 604_800_000) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 1) || "T").toUpperCase();
}

function roomHref(room: TravaChatRoomSummary): string {
  const params: Array<[string, string]> = [
    ["agencyId", room.agencyId || ""],
    ["agencyName", room.agencyName],
    ["travelerId", room.travelerId || ""],
    ["travelerName", room.travelerName || ""],
  ];
  if (room.packageMeta) {
    params.push(
      ["packageId", room.packageMeta.packageId],
      ["packageTitle", room.packageMeta.packageTitle],
      ["packagePrice", room.packageMeta.packagePrice],
      ["currencyCode", room.packageMeta.currencyCode],
      ["packageDays", room.packageMeta.packageDays],
      ["packageNights", room.packageMeta.packageNights],
      ["destination", room.packageMeta.destination],
      ["packageImage", room.packageMeta.packageImage || ""],
    );
  }
  const query = params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  return `/chat/${encodeURIComponent(room.roomId)}?${query}`;
}

function filterRoom(room: TravaChatRoomSummary, filter: MessageFilter): boolean {
  if (filter === "unread") return roomUnreadCount(room) > 0;
  if (filter === "bookings") return room.contextType === "booking" || Boolean(room.bookingStatus) || Boolean(room.packageMeta);
  if (filter === "agencies") return Boolean(room.agencyId || room.agencyName);
  return true;
}

function priorityScore(room: TravaChatRoomSummary): number {
  let score = 0;
  if (room.isPinned) score += 50;
  if (room.contextType === "booking" || room.bookingStatus) score += 35;
  score += Math.min(25, roomUnreadCount(room) * 6);
  if (room.packageMeta) score += 10;
  return score;
}

function InboxIconButton({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color="#5044B9" />
      {badge ? <View style={styles.iconBadge} /> : null}
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  dot,
  onPress,
}: {
  label: string;
  active: boolean;
  dot?: boolean;
  onPress(): void;
}) {
  if (active) {
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ selected: true }} onPress={onPress} style={styles.filterSlot}>
        <LinearGradient colors={["#7B82FF", "#D96FEA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterActive}>
          <Text style={styles.filterActiveText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: false }} onPress={onPress} style={[styles.filterSlot, styles.filterInactive]}>
      <Text style={styles.filterText}>{label}</Text>
      {dot ? <View style={styles.filterDot} /> : null}
    </Pressable>
  );
}

function Avatar({ room, size = 54 }: { room: TravaChatRoomSummary; size?: number }) {
  return (
    <LinearGradient
      colors={["#EAF3FF", "#EDE9FF", "#FFECEF"]}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.max(16, size * 0.34) }]}>{initials(room.agencyName)}</Text>
      <View style={styles.onlineDot} />
    </LinearGradient>
  );
}

function ConversationRow({ room, onOpen }: { room: TravaChatRoomSummary; onOpen(): void }) {
  const unread = roomUnreadCount(room);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open conversation with ${room.agencyName}`} onPress={onOpen} style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}>
      <Avatar room={room} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.rowName}>{room.agencyName}</Text>
          <Text style={styles.rowTime}>{relativeTime(room.updatedAt)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.rowContext}>{roomContextLabel(room)}</Text>
        <Text numberOfLines={1} style={styles.rowPreview}>{room.contactName ? `${room.contactName}: ` : ""}{room.lastMessage || "Open conversation"}</Text>
      </View>
      <View style={styles.rowAside}>
        {unread > 0 ? <LinearGradient colors={["#7A78FF", "#A75CF2"]} style={styles.unreadBubble}><Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text></LinearGradient> : null}
        <Ionicons name="chevron-forward" size={22} color="#6E73A4" />
      </View>
    </Pressable>
  );
}

function FeaturedConversation({
  room,
  onOpen,
  onPin,
}: {
  room: TravaChatRoomSummary;
  onOpen(): void;
  onPin(): void;
}) {
  const unread = roomUnreadCount(room);
  return (
    <View style={styles.featuredCard}>
      <View style={styles.featuredLabelRow}>
        <View style={styles.featuredLabel}><Ionicons name="pin" size={14} color="#7654E7" /><Text style={styles.featuredLabelText}>FEATURED</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={room.isPinned ? "Unpin conversation" : "Pin conversation"} onPress={onPin} hitSlop={10}>
          <Ionicons name={room.isPinned ? "pin" : "pin-outline"} size={19} color="#7654E7" />
        </Pressable>
      </View>
      <View style={styles.featuredBody}>
        {room.packageMeta?.packageImage ? (
          <Image source={{ uri: room.packageMeta.packageImage }} contentFit="cover" style={styles.featuredImage} />
        ) : (
          <LinearGradient colors={["#DCEBFF", "#F1E7FF", "#FFE7F1"]} style={styles.featuredImageFallback}>
            <Ionicons name="airplane-outline" size={38} color="#7654E7" />
          </LinearGradient>
        )}
        <View style={styles.featuredCopy}>
          <View style={styles.featuredNameRow}>
            <Avatar room={room} size={44} />
            <View style={styles.featuredNameCopy}>
              <View style={styles.nameBadgeRow}>
                <Text numberOfLines={1} style={styles.featuredName}>{room.agencyName}</Text>
                <View style={styles.agencyBadge}><Text style={styles.agencyBadgeText}>Agency</Text></View>
              </View>
              <Text numberOfLines={1} style={styles.featuredContext}>{roomContextLabel(room)}</Text>
            </View>
            <Text style={styles.featuredTime}>{relativeTime(room.updatedAt)}</Text>
          </View>
          <Text numberOfLines={2} style={styles.featuredPreview}>{room.contactName ? `${room.contactName}: ` : ""}{room.lastMessage || "Open conversation"}</Text>
        </View>
      </View>
      <View style={styles.featuredDivider} />
      <View style={styles.featuredFooter}>
        <View style={styles.bookingStatus}>
          <Ionicons name={room.bookingStatus ? "checkmark-circle-outline" : "chatbubble-ellipses-outline"} size={19} color={room.bookingStatus ? "#20A764" : "#7160DE"} />
          <Text style={styles.bookingStatusText}>{room.bookingStatus || "Active conversation"}</Text>
        </View>
        {unread > 0 ? <View style={styles.featuredUnread}><Text style={styles.featuredUnreadText}>{unread} unread</Text></View> : null}
        <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.viewChatButton, pressed && styles.pressed]}>
          <Text style={styles.viewChatText}>View chat</Text><Ionicons name="chevron-forward" size={18} color="#6B54DF" />
        </Pressable>
      </View>
    </View>
  );
}

export function MessagesScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<TravaChatRoomSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MessageFilter>("all");
  const [safetyVisible, setSafetyVisible] = useState(false);

  const load = useCallback(async () => {
    setRooms(await readRoomIndex());
  }, []);

  useEffect(() => {
    void load();
    void AsyncStorage.getItem(SAFE_BANNER_KEY).then((value) => setSafetyVisible(value !== "1"));
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [load]);

  const unreadTotal = useMemo(() => rooms.reduce((sum, room) => sum + roomUnreadCount(room), 0), [rooms]);
  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (!filterRoom(room, filter)) return false;
      if (!normalized) return true;
      const haystack = [
        room.agencyName,
        room.contactName,
        room.travelerName,
        room.lastMessage,
        room.contextLabel,
        room.packageMeta?.packageTitle,
        room.packageMeta?.destination,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [filter, query, rooms]);

  const featured = useMemo(() => {
    if (!visibleRooms.length) return null;
    return visibleRooms.slice().sort((a, b) => {
      const priority = priorityScore(b) - priorityScore(a);
      return priority || b.updatedAt.localeCompare(a.updatedAt);
    })[0];
  }, [visibleRooms]);
  const remaining = useMemo(() => visibleRooms.filter((room) => room.roomId !== featured?.roomId), [featured?.roomId, visibleRooms]);

  async function refresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function openRoom(room: TravaChatRoomSummary) {
    await markRoomRead(room.roomId);
    setRooms((current) => current.map((item) => item.roomId === room.roomId ? { ...item, unreadCount: 0, lastReadAt: new Date().toISOString() } : item));
    router.push(roomHref(room) as never);
  }

  async function dismissSafety() {
    setSafetyVisible(false);
    await AsyncStorage.setItem(SAFE_BANNER_KEY, "1");
  }

  async function pin(room: TravaChatRoomSummary) {
    await toggleRoomPinned(room.roomId);
    await load();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={["#FBFAFF", "#FFFFFF", "#FFF8FC"]} style={StyleSheet.absoluteFill} />
      <View style={styles.screenWidth}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.brand}>TRAVA</Text>
            <Text style={styles.title}>Messages</Text>
            <Text style={styles.subtitle}>Chat with agencies and manage trip conversations.</Text>
          </View>
          <View style={styles.headerActions}>
            <InboxIconButton icon={searchOpen ? "close" : "search-outline"} label={searchOpen ? "Close search" : "Search conversations"} onPress={() => { setSearchOpen((value) => !value); if (searchOpen) setQuery(""); }} />
            <InboxIconButton icon="options-outline" label="Show or hide filters" badge={filter !== "all"} onPress={() => setFiltersVisible((value) => !value)} />
            <InboxIconButton icon="create-outline" label="New conversation" onPress={() => setComposeOpen(true)} />
          </View>
        </View>

        {searchOpen ? (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#7771B9" />
            <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search agency, package, trip, or message" placeholderTextColor="#9B9AB3" style={styles.searchInput} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color="#9B9AB3" /></Pressable> : null}
          </View>
        ) : null}

        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#765BE7" />} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {safetyVisible ? (
            <View style={styles.securityCard}>
              <View style={styles.securityIcon}><Ionicons name="shield-checkmark-outline" size={24} color="#6E59E6" /></View>
              <View style={styles.securityCopy}>
                <Text style={styles.securityTitle}>Travel safe with TRAVA</Text>
                <Text style={styles.securityText}>Keep conversations here and avoid off-platform payments. Never share OTPs or passwords.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss safety reminder" onPress={() => void dismissSafety()} hitSlop={10}><Ionicons name="close" size={21} color="#777AA1" /></Pressable>
            </View>
          ) : null}

          {filtersVisible ? (
            <View style={styles.filters}>
              <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
              <FilterChip label="Unread" active={filter === "unread"} dot={unreadTotal > 0} onPress={() => setFilter("unread")} />
              <FilterChip label="Agencies" active={filter === "agencies"} onPress={() => setFilter("agencies")} />
              <FilterChip label="Bookings" active={filter === "bookings"} onPress={() => setFilter("bookings")} />
            </View>
          ) : null}

          {featured ? <FeaturedConversation room={featured} onOpen={() => void openRoom(featured)} onPin={() => void pin(featured)} /> : null}
          {remaining.map((room) => <ConversationRow key={room.roomId} room={room} onOpen={() => void openRoom(room)} />)}

          {(filter === "all" || filter === "agencies") && !query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Open TRAVA AI Concierge" onPress={() => router.push("/ai" as never)} style={({ pressed }) => [styles.aiRow, pressed && styles.pressed]}>
              <LinearGradient colors={["#F6E9FF", "#E9F0FF", "#FFEAF4"]} style={styles.aiAvatar}><Ionicons name="sparkles" size={24} color="#7959E9" /></LinearGradient>
              <View style={styles.rowCopy}>
                <View style={styles.aiNameRow}><Text style={styles.rowName}>TRAVA AI Concierge</Text><View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View></View>
                <Text style={styles.rowContext}>✦ Your trip assistant</Text>
                <Text numberOfLines={1} style={styles.rowPreview}>Ask TRAVA AI about your active trip, route, budget, or itinerary.</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#6E73A4" />
            </Pressable>
          ) : null}

          {!featured && remaining.length === 0 && !(filter === "all" || filter === "agencies") ? (
            <View style={styles.empty}>
              <LinearGradient colors={["#F0E9FF", "#EAF3FF"]} style={styles.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={30} color="#7261E7" /></LinearGradient>
              <Text style={styles.emptyTitle}>{filter === "unread" ? "You're all caught up" : "No conversations found"}</Text>
              <Text style={styles.emptyText}>{filter === "unread" ? "There are no unread travel conversations right now." : "Try a different search or filter, or start a valid conversation from Explore."}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push("/explore" as never)} style={styles.exploreButton}><Text style={styles.exploreButtonText}>Explore agencies</Text></Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Modal visible={composeOpen} transparent animationType="fade" onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.composeSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.composeHeader}><View><Text style={styles.composeTitle}>New conversation</Text><Text style={styles.composeSubtitle}>Continue with a valid TRAVA contact.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setComposeOpen(false)}><Ionicons name="close" size={23} color="#5D6181" /></Pressable></View>
            <Pressable accessibilityRole="button" onPress={() => { setComposeOpen(false); router.push("/ai" as never); }} style={styles.composeRow}><LinearGradient colors={["#F4E6FF", "#E9F0FF"]} style={styles.composeAvatar}><Ionicons name="sparkles" size={20} color="#7959E9" /></LinearGradient><View style={styles.composeCopy}><Text style={styles.composeName}>TRAVA AI Concierge</Text><Text style={styles.composeMeta}>Trip planning assistant</Text></View><Ionicons name="chevron-forward" size={20} color="#8386A5" /></Pressable>
            {rooms.slice(0, 8).map((room) => (
              <Pressable key={room.roomId} accessibilityRole="button" onPress={() => { setComposeOpen(false); void openRoom(room); }} style={styles.composeRow}><Avatar room={room} size={42} /><View style={styles.composeCopy}><Text numberOfLines={1} style={styles.composeName}>{room.agencyName}</Text><Text numberOfLines={1} style={styles.composeMeta}>{roomContextLabel(room)}</Text></View><Ionicons name="chevron-forward" size={20} color="#8386A5" /></Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => { setComposeOpen(false); router.push("/explore" as never); }} style={styles.findAgencyButton}><Ionicons name="compass-outline" size={18} color="#FFFFFF" /><Text style={styles.findAgencyText}>Find an agency in Explore</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBFAFF" },
  screenWidth: { width: "100%", maxWidth: 760, flex: 1, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  brand: { color: "#9A66EB", fontSize: 27, lineHeight: 31, letterSpacing: -1.1, fontWeight: "800" },
  title: { marginTop: 12, color: "#131B45", fontSize: 31, lineHeight: 35, letterSpacing: -1.1, fontWeight: "900" },
  subtitle: { marginTop: 5, color: "#646A96", fontSize: 12, lineHeight: 17, fontWeight: "500" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { width: 45, height: 45, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.76)", boxShadow: "0 8px 22px rgba(77,67,140,0.10)" },
  iconBadge: { position: "absolute", right: 9, top: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: "#E84F95", borderWidth: 1.5, borderColor: "#FFFFFF" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.988 }] },
  searchBox: { marginHorizontal: 20, marginBottom: 10, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: "#E9E6F6", backgroundColor: "rgba(255,255,255,0.90)" },
  searchInput: { flex: 1, color: "#1D244A", fontSize: 12, fontWeight: "600" },
  content: { paddingHorizontal: 20, paddingBottom: 125 },
  securityCard: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, marginTop: 5, marginBottom: 18, borderRadius: 25, borderWidth: 1, borderColor: "rgba(255,255,255,0.98)", backgroundColor: "rgba(255,255,255,0.70)", boxShadow: "0 12px 32px rgba(67,61,125,0.07)" },
  securityIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F0FF" },
  securityCopy: { flex: 1 },
  securityTitle: { color: "#19204B", fontSize: 13, fontWeight: "900" },
  securityText: { marginTop: 5, color: "#56608A", fontSize: 10.5, lineHeight: 15, fontWeight: "500" },
  filters: { flexDirection: "row", gap: 9, marginBottom: 18 },
  filterSlot: { flex: 1, minWidth: 0, height: 48, borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  filterActive: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", borderRadius: 24 },
  filterInactive: { backgroundColor: "rgba(255,255,255,0.64)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" },
  filterText: { color: "#4E527D", fontSize: 11, fontWeight: "700" },
  filterActiveText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  filterDot: { position: "absolute", right: 20, width: 7, height: 7, borderRadius: 4, backgroundColor: "#7657E8" },
  featuredCard: { padding: 15, marginBottom: 15, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.72)", boxShadow: "0 16px 40px rgba(70,62,131,0.09)" },
  featuredLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  featuredLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredLabelText: { color: "#7654E7", fontSize: 9.5, letterSpacing: 0.4, fontWeight: "900" },
  featuredBody: { flexDirection: "row", gap: 13 },
  featuredImage: { width: 122, height: 122, borderRadius: 20, backgroundColor: "#EEF0F7" },
  featuredImageFallback: { width: 122, height: 122, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  featuredCopy: { flex: 1, minWidth: 0 },
  featuredNameRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  featuredNameCopy: { flex: 1, minWidth: 0 },
  nameBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredName: { flexShrink: 1, color: "#131A43", fontSize: 16, fontWeight: "900" },
  featuredContext: { marginTop: 4, color: "#6E50DF", fontSize: 10.5, fontWeight: "700" },
  featuredTime: { color: "#74799B", fontSize: 9.5, fontWeight: "600" },
  agencyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "#F0E9FF" },
  agencyBadgeText: { color: "#7654E7", fontSize: 8.5, fontWeight: "800" },
  featuredPreview: { marginTop: 16, color: "#626989", fontSize: 12, lineHeight: 17, fontWeight: "500" },
  featuredDivider: { height: 1, marginVertical: 14, backgroundColor: "#E8E7F0" },
  featuredFooter: { flexDirection: "row", alignItems: "center", gap: 10 },
  bookingStatus: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  bookingStatusText: { color: "#535A7D", fontSize: 9.5, fontWeight: "700" },
  featuredUnread: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "#F0E9FF" },
  featuredUnreadText: { color: "#7255E3", fontSize: 8.5, fontWeight: "800" },
  viewChatButton: { height: 40, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, borderColor: "#D8D0F8", backgroundColor: "rgba(255,255,255,0.82)" },
  viewChatText: { color: "#6B54DF", fontSize: 10.5, fontWeight: "900" },
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)" },
  avatarText: { color: "#5E58CC", fontWeight: "900" },
  onlineDot: { position: "absolute", right: 0, bottom: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "#2CBB65" },
  rowCard: { minHeight: 94, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 11, borderRadius: 25, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.70)", boxShadow: "0 12px 30px rgba(68,61,123,0.07)" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 },
  rowName: { flex: 1, color: "#171E46", fontSize: 13.5, fontWeight: "900" },
  rowTime: { color: "#767B9D", fontSize: 9.5, fontWeight: "600" },
  rowContext: { marginTop: 4, color: "#7156DF", fontSize: 9.8, fontWeight: "700" },
  rowPreview: { marginTop: 5, color: "#656B8A", fontSize: 10.5, fontWeight: "500" },
  rowAside: { alignItems: "center", justifyContent: "center", gap: 8 },
  unreadBubble: { minWidth: 25, height: 25, paddingHorizontal: 7, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" },
  aiRow: { minHeight: 98, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 11, borderRadius: 25, borderWidth: 1, borderColor: "rgba(255,255,255,0.96)", backgroundColor: "rgba(255,255,255,0.70)" },
  aiAvatar: { width: 58, height: 58, borderRadius: 22, alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(114,84,232,0.16)" },
  aiNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  aiBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "#E8E8FF" },
  aiBadgeText: { color: "#665FE1", fontSize: 8.5, fontWeight: "900" },
  empty: { alignItems: "center", paddingVertical: 65, paddingHorizontal: 30 },
  emptyIcon: { width: 68, height: 68, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 14, color: "#171E46", fontSize: 16, fontWeight: "900" },
  emptyText: { marginTop: 7, maxWidth: 320, color: "#747A99", fontSize: 11, lineHeight: 16, textAlign: "center", fontWeight: "500" },
  exploreButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 15, backgroundColor: "#6F59DF" },
  exploreButtonText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,25,50,0.20)" },
  composeSheet: { maxHeight: "78%", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#FCFBFF" },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", backgroundColor: "#D8D6E4", marginBottom: 12 },
  composeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  composeTitle: { color: "#171E46", fontSize: 19, fontWeight: "900" },
  composeSubtitle: { marginTop: 3, color: "#747A99", fontSize: 10.5, fontWeight: "500" },
  composeRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#ECEAF3" },
  composeAvatar: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  composeCopy: { flex: 1, minWidth: 0 },
  composeName: { color: "#1B2147", fontSize: 12.5, fontWeight: "900" },
  composeMeta: { marginTop: 3, color: "#7A809E", fontSize: 9.5, fontWeight: "600" },
  findAgencyButton: { minHeight: 48, marginTop: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 17, backgroundColor: "#6D57DF" },
  findAgencyText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
