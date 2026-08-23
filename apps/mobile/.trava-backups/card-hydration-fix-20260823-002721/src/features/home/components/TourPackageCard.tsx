import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HomeTourPackage } from "../types/home.types";
import { formatMoney } from "../utils/home-normalizers";

interface TourPackageCardProps {
  tour: HomeTourPackage;
  favorite: boolean;
  onOpen(): void;
  onToggleFavorite(): void;
  width?: number;
}

export function TourPackageCard({ tour, favorite, onOpen, onToggleFavorite, width = 252 }: TourPackageCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${tour.title}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
    >
      <View style={styles.imageWrap}>
        {tour.imageUrl ? (
          <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} transition={170} />
        ) : (
          <View style={styles.imageFallback}><Text style={styles.fallbackIcon}>⌖</Text></View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Remove from favorites" : "Add to favorites"}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={({ pressed }) => [styles.favorite, favorite && styles.favoriteActive, pressed && styles.pressed]}
        >
          <Text style={[styles.favoriteGlyph, favorite && styles.favoriteGlyphActive]}>{favorite ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{tour.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {tour.durationDays || 0} Days{tour.durationNights ? ` • ${tour.durationNights} Nights` : ""}
        </Text>
        <View style={styles.footer}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.price}>{formatMoney(tour.price, tour.currencyCode)}</Text>
          <View style={styles.openButton}><Text style={styles.openText}>Explore ›</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E7EAF1",
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    boxShadow: "0 12px 28px rgba(55,64,99,0.09)",
  },
  cardPressed: { opacity: 0.94, transform: [{ scale: 0.992 }] },
  imageWrap: { height: 165, overflow: "hidden", backgroundColor: "#E8EBF7" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF1FF" },
  fallbackIcon: { color: "#7558F0", fontSize: 32, fontWeight: "900" },
  favorite: { position: "absolute", top: 10, right: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)" },
  favoriteActive: { backgroundColor: "#FFF0F6" },
  favoriteGlyph: { color: "#53617B", fontSize: 24, lineHeight: 27, fontWeight: "700" },
  favoriteGlyphActive: { color: "#FF4E91" },
  body: { padding: 14 },
  title: { minHeight: 38, color: "#1A2743", fontSize: 15, lineHeight: 19, fontWeight: "900" },
  meta: { marginTop: 4, color: "#7B879D", fontSize: 11, lineHeight: 15, fontWeight: "600" },
  footer: { marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { flex: 1, color: "#684CDC", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  openButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#D8CEFF" },
  openText: { color: "#6A51DD", fontSize: 10, fontWeight: "900" },
  pressed: { opacity: 0.65 },
});
