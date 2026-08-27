import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTourPackage } from "../types/home.types";
import { formatMoney } from "../utils/home-normalizers";

interface TourPackageCardProps { tour: HomeTourPackage; favorite: boolean; onOpen(): void; onToggleFavorite(): void; width?: number; }
const FALLBACK = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=78";

export function TourPackageCard({ tour, favorite, onOpen, onToggleFavorite, width = 318 }: TourPackageCardProps) {
  const image = tour.imageUrl || FALLBACK;
  const destination = tour.destination || tour.country || "Travel package";
  const description = tour.description || `Explore ${destination} with a curated itinerary from a TRAVA travel partner.`;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${tour.title}`} onPress={onOpen} style={({ pressed }) => [s.card, { width }, pressed && s.pressed]}>
    <Image source={{ uri: image }} contentFit="cover" style={StyleSheet.absoluteFill} transition={170}/>
    <LinearGradient colors={["rgba(12,20,29,.02)", "rgba(12,20,29,.16)", "rgba(12,20,29,.92)"]} locations={[0.2, 0.48, 1]} style={StyleSheet.absoluteFill}/>
    <View style={s.top}><View style={s.pricePill}><Text style={s.price}>{formatMoney(tour.price, tour.currencyCode)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={favorite ? "Remove from favorites" : "Add to favorites"} onPress={(event) => { event.stopPropagation(); onToggleFavorite(); }} style={s.favorite}><Ionicons name={favorite ? "bookmark" : "bookmark-outline"} size={18} color="#FFFFFF"/></Pressable></View>
    <View style={s.body}><Text numberOfLines={1} style={s.title}>{tour.title}</Text><Text numberOfLines={2} style={s.description}>{description}</Text><View style={s.tags}><View style={s.tag}><Ionicons name="star-outline" size={11} color="#FFFFFF"/><Text style={s.tagText}>TRAVA pick</Text></View>{tour.category ? <View style={s.tag}><Text style={s.tagText}>{tour.category}</Text></View> : null}<View style={s.tag}><Text style={s.tagText}>{tour.durationDays || 1} Day{tour.durationDays === 1 ? "" : "s"}</Text></View></View><View style={s.book}><Text style={s.bookText}>Book now</Text><Ionicons name="arrow-forward" size={16} color="#24334A"/></View></View>
  </Pressable>;
}
const s = StyleSheet.create({
  card: { height: 430, borderRadius: 27, overflow: "hidden", backgroundColor: "#D8E1E8", boxShadow: "0 16px 34px rgba(34,45,64,.15)" }, top: { position: "absolute", left: 14, right: 14, top: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pricePill: { minHeight: 31, paddingHorizontal: 11, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(33,42,56,.58)" }, price: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" }, favorite: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)" }, body: { position: "absolute", left: 16, right: 16, bottom: 15 }, title: { color: "#FFFFFF", fontSize: 20, lineHeight: 24, fontWeight: "900" }, description: { marginTop: 7, color: "rgba(255,255,255,.86)", fontSize: 10, lineHeight: 15, fontWeight: "600" }, tags: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 6 }, tag: { minHeight: 25, paddingHorizontal: 8, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,.13)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" }, tagText: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "800" }, book: { marginTop: 14, height: 44, borderRadius: 22, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF" }, bookText: { color: "#24334A", fontSize: 10, fontWeight: "900" }, pressed: { opacity: 0.88, transform: [{ scale: 0.993 }] },
});
