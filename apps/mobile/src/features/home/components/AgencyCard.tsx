import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HomeTravelAgency } from "../types/home.types";
import { AgencyBrandMark } from "./AgencyBrandMark";

interface AgencyCardProps {
  agency: HomeTravelAgency;
  favorite: boolean;
  onOpen(): void;
  onToggleFavorite(): void;
  width?: number;
}

const FALLBACK =
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=78";

export function AgencyCard({ agency, favorite, onOpen, onToggleFavorite, width = 292 }: AgencyCardProps) {
  const specialties = (agency.specialties.length ? agency.specialties : ["Curated trips", "Direct chat"]).slice(0, 2);
  return (
    <View style={[s.card, { width }]}>
      <Pressable onPress={onOpen} style={({ pressed }) => [s.imageArea, pressed && s.pressed]}>
        <Image source={{ uri: agency.coverImageUrl || FALLBACK }} contentFit="cover" style={StyleSheet.absoluteFill} transition={150} />
        <LinearGradient colors={["rgba(17,24,36,.02)", "rgba(17,24,36,.22)"]} style={StyleSheet.absoluteFill} />
        <AgencyBrandMark name={agency.name} logoUrl={agency.logoUrl} size={54} style={s.logo} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={favorite ? "Remove saved agency" : "Save agency"} onPress={onToggleFavorite} style={({ pressed }) => [s.favorite, pressed && s.pressed]}>
        <Ionicons name={favorite ? "heart" : "heart-outline"} size={20} color="#FFFFFF" />
      </Pressable>
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text numberOfLines={1} style={s.title}>{agency.name}</Text>
          <View style={s.rating}><Ionicons name="star" size={13} color="#E8A23E" /><Text style={s.ratingText}>{agency.rating > 0 ? agency.rating.toFixed(1) : "New"}</Text></View>
        </View>
        <View style={s.location}><Ionicons name="shield-checkmark-outline" size={16} color="#667180" /><Text numberOfLines={1} style={s.locationText}>{agency.subtitle || "Verified TRAVA travel partner"}</Text></View>
        <View style={s.details}>
          {specialties.map((item, index) => (
            <View key={`${agency.id}-${item}-${index}`} style={s.detail}>
              <Ionicons name={index === 0 ? "compass-outline" : "chatbubble-ellipses-outline"} size={15} color="#23272D" />
              <Text numberOfLines={1} style={s.detailText}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={s.footer}>
          <View><Text style={s.partner}>TRAVA Partner</Text><Text style={s.caption}>{specialties.length} specialties</Text></View>
          <Pressable onPress={onOpen} style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}><Text style={s.ctaText}>View</Text><Ionicons name="arrow-forward" size={15} color="#FFFFFF" /></Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { overflow: "hidden", borderRadius: 25, padding: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E8EA", boxShadow: "0 12px 28px rgba(24,28,35,.09)" },
  imageArea: { position: "relative", height: 176, overflow: "hidden", borderRadius: 20, backgroundColor: "#EEF1F4" },
  logo: { position: "absolute", left: 13, bottom: 13, boxShadow: "0 8px 20px rgba(18,27,42,.18)" },
  favorite: { position: "absolute", right: 19, top: 19, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(42,48,57,.62)", zIndex: 3 },
  body: { paddingHorizontal: 5, paddingTop: 12, paddingBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, color: "#111318", fontSize: 16, lineHeight: 20, fontWeight: "900" },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: "#343840", fontSize: 9, fontWeight: "800" },
  location: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 5 },
  locationText: { flex: 1, color: "#6A707A", fontSize: 10, fontWeight: "600" },
  details: { marginTop: 9, flexDirection: "row", gap: 10 },
  detail: { maxWidth: "48%", minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { flexShrink: 1, color: "#30343A", fontSize: 9, fontWeight: "700" },
  footer: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  partner: { color: "#111318", fontSize: 13, fontWeight: "900" },
  caption: { marginTop: 1, color: "#858B94", fontSize: 7.5, fontWeight: "700" },
  cta: { height: 40, minWidth: 92, paddingHorizontal: 15, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#090909" },
  ctaText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  ctaPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  pressed: { opacity: 0.88 },
});
