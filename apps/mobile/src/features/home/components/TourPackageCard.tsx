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

const FALLBACK =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=78";

export function TourPackageCard({
  tour,
  favorite,
  onOpen,
  onToggleFavorite,
  width = 292,
}: TourPackageCardProps) {
  const destination = tour.destination || tour.country || "Travel destination";
  const days = Math.max(1, tour.durationDays || 1);
  const nights = Math.max(0, tour.durationNights || Math.max(0, days - 1));

  return (
    <View style={[s.card, { width }]}>
      <Pressable onPress={onOpen} style={({ pressed }) => [s.imageArea, pressed && s.pressed]}>
        <Image source={{ uri: tour.imageUrl || FALLBACK }} contentFit="cover" style={StyleSheet.absoluteFill} transition={150} />
        <View style={s.pager}><View style={s.pagerDot} /><View style={s.pagerDotOff} /><View style={s.pagerDotOff} /></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={favorite ? "Remove saved package" : "Save package"} onPress={onToggleFavorite} style={({ pressed }) => [s.favorite, pressed && s.pressed]}>
        <Ionicons name={favorite ? "heart" : "heart-outline"} size={20} color="#FFFFFF" />
      </Pressable>
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text numberOfLines={1} style={s.title}>{tour.title}</Text>
          <View style={s.rating}><Ionicons name="sparkles" size={13} color="#E3A23A" /><Text style={s.ratingText}>TRAVA</Text></View>
        </View>
        <View style={s.location}>
          <Ionicons name="location-outline" size={16} color="#68707C" />
          <Text numberOfLines={1} style={s.locationText}>{destination}</Text>
        </View>
        <View style={s.details}>
          <View style={s.detail}><Ionicons name="calendar-outline" size={15} color="#23272D" /><Text style={s.detailText}>{days}D</Text></View>
          <View style={s.detail}><Ionicons name="moon-outline" size={15} color="#23272D" /><Text style={s.detailText}>{nights}N</Text></View>
          <View style={[s.detail, { flex: 1 }]}><Ionicons name="pricetag-outline" size={15} color="#23272D" /><Text numberOfLines={1} style={s.detailText}>{tour.category || "Tour"}</Text></View>
        </View>
        <View style={s.footer}>
          <View><Text style={s.price}>{formatMoney(tour.price, tour.currencyCode)}</Text><Text style={s.caption}>per package</Text></View>
          <Pressable onPress={onOpen} style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}>
            <Text style={s.ctaText}>View</Text><Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { overflow: "hidden", borderRadius: 25, padding: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E8EA", boxShadow: "0 12px 28px rgba(24,28,35,.09)" },
  imageArea: { position: "relative", height: 176, overflow: "hidden", borderRadius: 20, backgroundColor: "#EEF1F4" },
  favorite: { position: "absolute", right: 19, top: 19, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(42,48,57,.62)", zIndex: 3 },
  pager: { position: "absolute", alignSelf: "center", bottom: 10, height: 17, paddingHorizontal: 8, borderRadius: 9, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(42,48,57,.45)" },
  pagerDot: { width: 13, height: 5, borderRadius: 3, backgroundColor: "#FFFFFF" },
  pagerDotOff: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,.45)" },
  body: { paddingHorizontal: 5, paddingTop: 12, paddingBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, color: "#111318", fontSize: 16, lineHeight: 20, fontWeight: "900" },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: "#343840", fontSize: 9, fontWeight: "800" },
  location: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 5 },
  locationText: { flex: 1, color: "#6A707A", fontSize: 10, fontWeight: "600" },
  details: { marginTop: 9, flexDirection: "row", gap: 9 },
  detail: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { color: "#30343A", fontSize: 9, fontWeight: "700" },
  footer: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  price: { color: "#111318", fontSize: 15, fontWeight: "900" },
  caption: { marginTop: 1, color: "#858B94", fontSize: 7.5, fontWeight: "700" },
  cta: { height: 40, minWidth: 92, paddingHorizontal: 15, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#090909" },
  ctaText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  ctaPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  pressed: { opacity: 0.88 },
});
