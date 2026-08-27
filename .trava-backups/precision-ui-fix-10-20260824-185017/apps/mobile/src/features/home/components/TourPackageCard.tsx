import { Ionicons } from "@expo/vector-icons";
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

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=78";

export function TourPackageCard({
  tour,
  favorite,
  onOpen,
  onToggleFavorite,
  width = 344,
}: TourPackageCardProps) {
  const destination = tour.destination || tour.country || "Travel destination";
  const category = tour.category || "Curated tour";
  const days = Math.max(1, tour.durationDays || 1);
  const nights = Math.max(0, tour.durationNights || Math.max(0, days - 1));

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${tour.title}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]}
      >
        <Image
          source={{ uri: tour.imageUrl || FALLBACK_IMAGE }}
          contentFit="cover"
          transition={160}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.singleImagePager}>
          <View style={styles.pagerActive} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${tour.title} from favorites` : `Save ${tour.title}`}
        onPress={onToggleFavorite}
        style={({ pressed }) => [styles.favoriteButton, pressed && styles.favoritePressed]}
      >
        <Ionicons name={favorite ? "heart" : "heart-outline"} size={24} color="#FFFFFF" />
      </Pressable>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>{tour.title}</Text>
          <View style={styles.scopeBadge}>
            <Ionicons name="sparkles" size={15} color="#E3A23A" />
            <Text style={styles.scopeBadgeText}>Tour</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={20} color="#5F697A" />
          <Text numberOfLines={1} style={styles.locationText}>{destination}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={19} color="#171B22" />
            <Text style={styles.infoText}>{days} Day{days === 1 ? "" : "s"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="moon-outline" size={18} color="#171B22" />
            <Text style={styles.infoText}>{nights} Night{nights === 1 ? "" : "s"}</Text>
          </View>
          <View style={[styles.infoItem, styles.infoItemFlexible]}>
            <Ionicons name="pricetag-outline" size={18} color="#171B22" />
            <Text numberOfLines={1} style={styles.infoText}>{category}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{formatMoney(tour.price, tour.currencyCode)}</Text>
            <Text style={styles.priceCaption}>package</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${tour.title}`}
            onPress={onOpen}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Ionicons name="document-text-outline" size={19} color="#FFFFFF" />
            <Text style={styles.ctaText}>View package</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 31,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E7E7",
    boxShadow: "0 16px 34px rgba(27,31,38,.10)",
  },
  imageButton: {
    position: "relative",
    height: 264,
    overflow: "hidden",
    borderRadius: 25,
    backgroundColor: "#EEF1F4",
  },
  pressed: { opacity: 0.91 },
  favoriteButton: {
    position: "absolute",
    right: 27,
    top: 27,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,48,57,.62)",
    zIndex: 4,
  },
  favoritePressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  singleImagePager: {
    position: "absolute",
    alignSelf: "center",
    bottom: 14,
    height: 18,
    minWidth: 42,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,48,55,.46)",
  },
  pagerActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  body: { paddingHorizontal: 7, paddingTop: 17, paddingBottom: 7 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: "#111318",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.45,
  },
  scopeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  scopeBadgeText: {
    color: "#2B2D32",
    fontSize: 13,
    fontWeight: "800",
  },
  locationRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    flex: 1,
    color: "#656B74",
    fontSize: 13,
    fontWeight: "650",
  },
  infoRow: {
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  infoItemFlexible: { flex: 1 },
  infoText: {
    color: "#25282D",
    fontSize: 11,
    fontWeight: "750",
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  priceBlock: { flex: 1 },
  price: {
    color: "#111318",
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "900",
  },
  priceCaption: {
    marginTop: 1,
    color: "#777D86",
    fontSize: 9,
    fontWeight: "700",
  },
  cta: {
    minWidth: 176,
    height: 58,
    paddingHorizontal: 21,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#090909",
    boxShadow: "0 9px 20px rgba(0,0,0,.14)",
  },
  ctaPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
