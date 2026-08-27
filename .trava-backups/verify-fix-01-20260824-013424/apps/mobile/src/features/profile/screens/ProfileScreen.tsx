import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { ProfileSettingsModal } from "../components/ProfileSettingsModal";
import { listTrips } from "@/features/trips/api/trips.api";

const MENU = [
  { key: "settings", icon: "settings-outline", label: "Settings", badge: null },
  { key: "favorites", icon: "heart-outline", label: "Favorites", badge: null },
  { key: "payments", icon: "wallet-outline", label: "Payments & Wallet", badge: "Coming soon" },
  { key: "reviews", icon: "star-outline", label: "Reviews", badge: null },
  { key: "help", icon: "help-circle-outline", label: "Help & Support", badge: null },
] as const;
const PASSPORT_VISUAL = require("../../../../assets/images/profile/passport.png");
const STREAK_MASCOT = require("../../../../assets/images/profile/luggage-mascot.gif");

export function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, profile, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips, staleTime: 60_000 });
  const trips = tripsQuery.data ?? [];\n  const travelStreak = useMemo(() => calculateMonthlyTravelStreak(trips), [trips]);\n  const travelDots = useMemo(() => recentTravelDayIndexes(trips), [trips]);

  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const fullName = profile?.full_name || metadataName || user?.email?.split("@")[0] || "Traveler";
  const avatar =
    (profile as { avatar_url?: string | null } | null)?.avatar_url ||
    (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);
  const countries = new Set(trips.map((trip) => trip.destination.split(",").slice(-1)[0]?.trim()).filter(Boolean));
  const completed = trips.filter((trip) => trip.status === "completed");
  const points = Number((profile as { points?: number } | null)?.points ?? 0);
  const premium = Boolean((profile as { is_premium?: boolean } | null)?.is_premium);
  const contentWidth = Math.min(width - 28, 520);

  function handleMenuPress(key: (typeof MENU)[number]["key"]) {
    if (key === "favorites") { router.navigate("/(traveler)/(tabs)/home" as Href); return; }
    if (key === "help") { router.navigate("/(traveler)/(tabs)/ai" as Href); return; }
    if (key === "reviews") {
      Alert.alert("Your TRAVA reviews", completed.length ? `You have ${completed.length} completed trip${completed.length === 1 ? "" : "s"} eligible for travel memories and reviews.` : "Complete a trip to unlock package and travel reviews.");
      return;
    }
    if (key === "payments") { Alert.alert("Payments & Wallet", "TRAVA Wallet is not enabled in this build yet."); return; }
    setSettingsOpen(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.maxWidth, { width: contentWidth }]}>
          <LinearGradient colors={["#ECF3FF", "#FFF0F8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGlow}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Profile<Text style={styles.sparkle}>✣</Text></Text>
                <Text style={styles.subtitle}>Manage your travel world</Text>
              </View>
              <View style={styles.headerActions}><CircleIconButton icon="sparkles-outline" label="Open TRAVA AI" onPress={() => router.navigate("/(traveler)/(tabs)/ai" as Href)} /><CircleIconButton icon="settings-outline" label="Settings" onPress={() => setSettingsOpen(true)} /></View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.identity}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatar}>
                    {avatar ? <Image source={{ uri: avatar }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : <Text style={styles.avatarLetter}>{fullName.slice(0, 1).toUpperCase()}</Text>}
                  </View>
                  <View style={styles.level}><Text style={styles.levelText}>{Math.max(1, completed.length + 1)}</Text></View>
                </View>
                <View style={styles.identityCopy}>
                  <Text numberOfLines={1} style={styles.name}>{fullName}</Text>
                  <Text numberOfLines={1} style={styles.email}>{user?.email || "TRAVA traveler"}</Text>
                  <Text style={styles.city}>⌖ Add your home city</Text>
                  <View style={styles.planPill}><Text style={styles.planText}>✣ TRAVA AI {premium ? "Premium" : "Explorer"}</Text></View>
                </View>
                <Text style={styles.arrow}>›</Text>
              </View>

              <View style={styles.stats}>
                <Stat icon="✈" value={trips.length} label="Trips" />
                <Stat icon="◈" value={countries.size} label="Countries" />
                <Stat icon="▥" value={new Set(trips.map((t) => t.destination)).size} label="Cities" />
                <Stat icon="♙" value={points} label="Points" />
              </View>
            </View>
          </LinearGradient>

          <LinearGradient colors={["#FFF3FA", "#EEE5FF"]} style={styles.passportCard}>
            <View style={styles.passportCopy}>
              <Text style={styles.passportTitle}>Passport{"\n"}Memories</Text>
              <Text style={styles.passportSpark}>✣</Text>
              <Text style={styles.passportText}>Your journey, beautifully{"\n"}collected.</Text>
              <Pressable onPress={() => router.push("/passport" as Href)} style={({ pressed }) => [styles.openPassport, pressed && styles.pressed]}>
                <Text style={styles.openPassportText}>Open Passport  ›</Text>
              </Pressable>
            </View>
            <View style={styles.passportVisual}>
              <Image source={PASSPORT_VISUAL} contentFit="contain" cachePolicy="memory" style={styles.passportImage} />
            </View>
          </LinearGradient>

          <LinearGradient colors={["#EDF5FF", "#F7F2FF"]} style={styles.streakCard}>
            <View style={styles.streakCopy}>
              <Text style={styles.streakEyebrow}>Monthly Travel Streak ♨</Text>
              <Text style={styles.streakTitle}>0-day{"\n"}streak</Text>
              <Text style={styles.streakText}>Check in today and begin{"\n"}your monthly travel streak.</Text>
              <Pressable onPress={() => Alert.alert("Travel streak", "Complete travel check-ins and finished trips to build your monthly streak.")} style={styles.challenge}><Ionicons name="trophy-outline" size={13} color="#5D72D5" /><Text style={styles.challengeText}>View Challenges</Text><Ionicons name="chevron-forward" size={12} color="#5D72D5" /></Pressable>
            </View>
            <View style={styles.streakRing}><Text style={styles.fire}>⌁</Text><Text style={styles.zero}>{travelStreak}</Text><Text style={styles.days}>days</Text></View>
            <View style={styles.miniMascot}><Image source={STREAK_MASCOT} contentFit="contain" cachePolicy="memory-disk" autoplay style={styles.streakMascotImage} /></View>
            <View style={styles.dots}>{Array.from({ length: 14 }, (_, index) => <View key={index} style={[styles.dot, travelDots.has(index) && styles.dotActive]}><Text style={styles.dotLabel}>{recentDateLabel(index)}</Text></View>)}</View>
          </LinearGradient>

          <View style={styles.menu}>
            {MENU.map((item, index) => (
              <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => handleMenuPress(item.key)}
                style={({ pressed }) => [styles.menuRow, index < MENU.length - 1 && styles.menuBorder, pressed && styles.pressed]}>
                <View style={styles.menuIcon}><Ionicons name={item.icon} size={16} color="#6C68CE" /></View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View> : null}
                <Ionicons name="chevron-forward" size={16} color="#8B94A5" />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <ProfileSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} onSignOut={signOut} />
    </SafeAreaView>
  );
}


function tripCoversDate(trip: { startDate?: string | null; endDate?: string | null }, day: string) {
  const start = trip.startDate?.slice(0, 10);
  const end = (trip.endDate || trip.startDate)?.slice(0, 10);
  return Boolean(start && end && start <= day && day <= end);
}
function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function recentDateLabel(index: number) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - (13 - index));
  return String(day.getUTCDate());
}
function recentTravelDayIndexes(trips: Array<{ startDate?: string | null; endDate?: string | null }>) {
  const active = new Set<number>();
  for (let index = 0; index < 14; index += 1) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (13 - index));
    if (trips.some((trip) => tripCoversDate(trip, dateKey(day)))) active.add(index);
  }
  return active;
}
function calculateMonthlyTravelStreak(trips: Array<{ startDate?: string | null; endDate?: string | null }>) {
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const month = cursor.getUTCMonth();
  const year = cursor.getUTCFullYear();
  let streak = 0;
  while (cursor.getUTCFullYear() === year && cursor.getUTCMonth() === month) {
    if (!trips.some((trip) => tripCoversDate(trip, dateKey(cursor)))) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function CircleIconButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}><Ionicons name={icon} size={17} color="#33415F" /></Pressable>;
}
function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statIcon}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFD" },
  content: { alignItems: "center", paddingBottom: 125 },
  maxWidth: { maxWidth: 520 },
  headerGlow: { paddingHorizontal: 14, paddingBottom: 16, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 3, paddingBottom: 8 },
  title: { color: "#16264F", fontSize: 27, lineHeight: 29, fontWeight: "900", letterSpacing: -0.8 },
  sparkle: { color: "#8767F6", fontSize: 13 },
  subtitle: { marginTop: 3, color: "#65718E", fontSize: 9, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 7 },
  circleButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "#EEF0F5" },
  circleText: { color: "#243050", fontSize: 14, fontWeight: "800" },
  profileCard: { padding: 14, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.91)", borderWidth: 1, borderColor: "rgba(255,255,255,0.98)" },
  identity: { flexDirection: "row", alignItems: "center" },
  avatarRing: { width: 68, height: 68, borderRadius: 34, padding: 4, backgroundColor: "#DCEBFF" },
  avatar: { flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 30, backgroundColor: "#F4EFFF" },
  avatarLetter: { color: "#7358EE", fontSize: 26, fontWeight: "900" },
  level: { position: "absolute", right: 0, bottom: 0, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#7358EE", borderWidth: 2, borderColor: "#FFFFFF" },
  levelText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900" },
  identityCopy: { flex: 1, minWidth: 0, paddingHorizontal: 11 },
  name: { color: "#17203A", fontSize: 16, lineHeight: 19, fontWeight: "900" },
  email: { marginTop: 2, color: "#68748E", fontSize: 8, fontWeight: "700" },
  city: { marginTop: 5, color: "#73809A", fontSize: 8, fontWeight: "700" },
  planPill: { marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: "#EEE8FF" },
  planText: { color: "#795EED", fontSize: 7, fontWeight: "900" },
  arrow: { color: "#7D879B", fontSize: 22 },
  stats: { marginTop: 14, paddingTop: 12, flexDirection: "row", borderTopWidth: 1, borderTopColor: "#EEF0F4" },
  stat: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: "#EEF0F4" },
  statIcon: { color: "#6D66F0", fontSize: 12 },
  statValue: { marginTop: 2, color: "#1B2540", fontSize: 10, fontWeight: "900" },
  statLabel: { marginTop: 2, color: "#858EA1", fontSize: 6, fontWeight: "700" },
  passportCard: { marginTop: 12, minHeight: 188, flexDirection: "row", overflow: "hidden", borderRadius: 24, padding: 18 },
  passportCopy: { flex: 1, zIndex: 2 },
  passportTitle: { color: "#1B2642", fontSize: 23, lineHeight: 23, fontWeight: "900", letterSpacing: -0.6 },
  passportSpark: { marginTop: 5, color: "#7E67F0", fontSize: 12 },
  passportText: { marginTop: 12, color: "#66728B", fontSize: 9, lineHeight: 13, fontWeight: "700" },
  openPassport: { marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.88)" },
  openPassportText: { color: "#7358EE", fontSize: 8, fontWeight: "900" },
  passportVisual: { width: "46%", alignItems: "center", justifyContent: "center" },
  passportImage: { width: 142, height: 156 },
  ticketBack: { position: "absolute", width: 90, height: 125, right: 1, top: 20, borderRadius: 8, transform: [{ rotate: "19deg" }], backgroundColor: "#F5F0E7", borderWidth: 1, borderColor: "#DBD8D1" },
  ticketStripe: { height: 13, marginTop: 14, backgroundColor: "#E47083" },
  ticketDots: { margin: 12, height: 55, borderRadius: 8, backgroundColor: "#D7D5D3" },
  passportBook: { width: 100, height: 135, borderRadius: 10, padding: 11, transform: [{ rotate: "-7deg" }], backgroundColor: "#7198E6", borderWidth: 1, borderColor: "#5677B5", boxShadow: "0px 8px 14px rgba(36,52,92,0.18)" },
  passportTag: { alignSelf: "flex-start", paddingHorizontal: 4, paddingVertical: 2, backgroundColor: "#FF6484" },
  passportTagText: { color: "#FFFFFF", fontSize: 6, fontWeight: "900" },
  globeGlyph: { marginTop: 10, color: "#F3F6FF", fontSize: 43, textAlign: "center", fontWeight: "300" },
  passportLines: { marginTop: 5 },
  linePink: { height: 7, borderRadius: 2, backgroundColor: "#EF6684" },
  lineBlue: { width: "70%", height: 6, marginTop: 5, borderRadius: 2, backgroundColor: "#436DB5" },
  streakCard: { marginTop: 12, minHeight: 228, overflow: "hidden", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,.92)", boxShadow: "0 14px 32px rgba(64,79,124,.09)" },
  streakCopy: { zIndex: 2 },
  streakEyebrow: { color: "#3E64C1", fontSize: 7, fontWeight: "900" },
  streakTitle: { marginTop: 7, color: "#17264D", fontSize: 23, lineHeight: 27, fontWeight: "900" },
  streakText: { marginTop: 6, color: "#687797", fontSize: 8, lineHeight: 12, fontWeight: "700" },
  challenge: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.9)" },
  challengeText: { color: "#5D72D5", fontSize: 7, fontWeight: "900" },
  streakRing: { position: "absolute", right: 22, top: 19, width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 7, borderColor: "rgba(255,255,255,0.96)" },
  fire: { color: "#FF7D3D", fontSize: 11 },
  zero: { color: "#17264D", fontSize: 15, lineHeight: 16, fontWeight: "900" },
  days: { color: "#8A96B0", fontSize: 6, fontWeight: "800" },
  miniMascot: { position: "absolute", right: 38, bottom: 24, width: 148, height: 150, alignItems: "center", justifyContent: "center", transform: [{ rotate: "2deg" }] },
  streakMascotImage: { width: 148, height: 150 },
  mascotFace: { color: "#28345C", fontSize: 9 },
  mascotBody: { color: "#79A3E9", fontSize: 28 },
  dots: { position: "absolute", left: 16, right: 16, bottom: 12, flexDirection: "row", justifyContent: "space-between" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D5DCEC" },
  dotActive: { borderColor: "#7295EE", borderWidth: 2 },
  dotLabel: { position: "absolute", top: 10, width: 12, color: "#8794AF", fontSize: 4, textAlign: "center" },
  menu: { marginTop: 12, overflow: "hidden", borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF4" },
  menuRow: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: "#F0F1F4" },
  menuIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F4FF" },
  menuGlyph: { color: "#6C68EE", fontSize: 12, fontWeight: "900" },
  menuLabel: { flex: 1, marginLeft: 9, color: "#273149", fontSize: 9, fontWeight: "800" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F0E9FF" },
  badgeText: { color: "#8268F1", fontSize: 5, fontWeight: "900" },
  menuArrow: { marginLeft: 7, color: "#8B94A5", fontSize: 18 },
  pressed: { opacity: 0.72 },
});
