import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTravelAgency } from "../types/home.types";

interface AgencyCardProps { agency: HomeTravelAgency; favorite: boolean; onOpen(): void; onToggleFavorite(): void; width?: number; }

export function AgencyCard({ agency, favorite, onOpen, onToggleFavorite, width = 286 }: AgencyCardProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View pointerEvents="none">
        <View style={styles.topRow}>
          <View style={styles.logo}>{agency.logoUrl ? <Image source={{ uri: agency.logoUrl }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} transition={140} /> : <Text style={styles.logoText}>{agency.name.slice(0, 1).toUpperCase()}</Text>}</View>
          <View style={styles.copy}>
            <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{agency.name}</Text><Ionicons name="shield-checkmark" size={14} color="#5D86DB" /></View>
            <Text numberOfLines={1} style={styles.subtitle}>{agency.subtitle || "Travel partner"}</Text>
            {agency.rating > 0 ? <View style={styles.ratingRow}><Ionicons name="star" size={12} color="#E7A73F" /><Text style={styles.rating}>{agency.rating.toFixed(1)}</Text></View> : null}
          </View><View style={styles.favoriteSpacer} />
        </View>
        <View style={styles.tags}>{(agency.specialties.length ? agency.specialties : ["Trips", "Support"]).slice(0, 3).map((tag) => <Text key={tag} numberOfLines={1} style={styles.tag}>{tag}</Text>)}</View>
        <View style={styles.openButton}><Text style={styles.openText}>View agency</Text><Ionicons name="chevron-forward" size={15} color="#6175C8" /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${agency.name}`} onPress={onOpen} style={({ pressed }) => [styles.cardHitArea, pressed && styles.cardHitAreaPressed]} />
      <Pressable accessibilityRole="button" accessibilityLabel={favorite ? "Remove agency from favorites" : "Add agency to favorites"} onPress={onToggleFavorite} style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}><Ionicons name={favorite ? "heart" : "heart-outline"} size={19} color={favorite ? "#FF568E" : "#52617A"} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: "relative", padding: 15, borderWidth: 1, borderColor: "#E5E9F0", borderRadius: 23, backgroundColor: "rgba(255,255,255,.97)", boxShadow: "0 12px 28px rgba(53,65,94,.08)" },
  cardHitArea: { ...StyleSheet.absoluteFill, zIndex: 1, borderRadius: 23 }, cardHitAreaPressed: { backgroundColor: "rgba(90,103,150,.035)" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 11 }, logo: { width: 58, height: 58, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#EDEBFF", borderWidth: 1, borderColor: "#E3E1F5" },
  logoText: { color: "#705BD1", fontSize: 22, fontWeight: "900" }, copy: { flex: 1, minWidth: 0 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { flexShrink: 1, color: "#17233E", fontSize: 14, lineHeight: 18, fontWeight: "900" }, subtitle: { marginTop: 3, color: "#758198", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },
  ratingRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 3 }, rating: { color: "#A87722", fontSize: 9.5, fontWeight: "800" }, favoriteSpacer: { width: 34, height: 34 },
  favorite: { position: "absolute", zIndex: 2, top: 15, right: 15, width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#F7F8FC" },
  tags: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 6 }, tag: { maxWidth: 94, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, color: "#5D6CA8", backgroundColor: "#F1F4FB", fontSize: 8.5, fontWeight: "800" },
  openButton: { marginTop: 12, minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#F7F9FD", borderWidth: 1, borderColor: "#EDF0F5" },
  openText: { color: "#33415F", fontSize: 10.5, fontWeight: "800" }, pressed: { opacity: .65 },
});
