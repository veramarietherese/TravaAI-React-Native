import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTourPackage } from "../types/home.types";
import { formatMoney } from "../utils/home-normalizers";

interface TourPackageCardProps { tour: HomeTourPackage; favorite: boolean; onOpen(): void; onToggleFavorite(): void; width?: number; }

export function TourPackageCard({ tour, favorite, onOpen, onToggleFavorite, width = 252 }: TourPackageCardProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View pointerEvents="none">
        <View style={styles.imageWrap}>
          {tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} transition={150} /> :
            <LinearGradient colors={["#EEF4FF", "#F3EEFF", "#FFF0F6"]} style={styles.imageFallback}><Ionicons name="image-outline" size={31} color="#7186BC" /></LinearGradient>}
          <LinearGradient colors={["rgba(8,17,38,0)", "rgba(8,17,38,.14)"]} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>{tour.title}</Text>
          <View style={styles.metaRow}><Ionicons name="time-outline" size={13} color="#7B879D" /><Text numberOfLines={1} style={styles.meta}>{tour.durationDays || 0} Days{tour.durationNights ? ` · ${tour.durationNights} Nights` : ""}</Text></View>
          <View style={styles.footer}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.price}>{formatMoney(tour.price, tour.currencyCode)}</Text><View style={styles.openButton}><Text style={styles.openText}>Explore</Text><Ionicons name="chevron-forward" size={13} color="#5B6FD2" /></View></View>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${tour.title}`} onPress={onOpen} style={({ pressed }) => [styles.cardHitArea, pressed && styles.cardHitAreaPressed]} />
      <Pressable accessibilityRole="button" accessibilityLabel={favorite ? "Remove from favorites" : "Add to favorites"} onPress={onToggleFavorite} style={({ pressed }) => [styles.favorite, favorite && styles.favoriteActive, pressed && styles.pressed]}>
        <Ionicons name={favorite ? "heart" : "heart-outline"} size={20} color={favorite ? "#FF568E" : "#506079"} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: "relative", overflow: "hidden", borderWidth: 1, borderColor: "#E5E9F0", borderRadius: 24, backgroundColor: "#FFFFFF", boxShadow: "0 13px 30px rgba(49,61,92,.09)" },
  cardHitArea: { ...StyleSheet.absoluteFillObject, zIndex: 1, borderRadius: 24 }, cardHitAreaPressed: { backgroundColor: "rgba(82,101,160,.035)" },
  imageWrap: { height: 165, overflow: "hidden", backgroundColor: "#E8EBF7" }, imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  favorite: { position: "absolute", zIndex: 2, top: 10, right: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(255,255,255,.90)", borderWidth: 1, borderColor: "rgba(255,255,255,.96)", boxShadow: "0 6px 16px rgba(28,39,66,.10)" },
  favoriteActive: { backgroundColor: "#FFF1F6" }, body: { padding: 14 },
  title: { minHeight: 38, color: "#17233E", fontSize: 15, lineHeight: 19, fontWeight: "900" },
  metaRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 5 }, meta: { flex: 1, color: "#7B879D", fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
  footer: { marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { flex: 1, color: "#5265BC", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  openButton: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F5F7FF", borderWidth: 1, borderColor: "#E4E8F7" },
  openText: { color: "#5B6FD2", fontSize: 9.5, fontWeight: "900" }, pressed: { opacity: .65 },
});
