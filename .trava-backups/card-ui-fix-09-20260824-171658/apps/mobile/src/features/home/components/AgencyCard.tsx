import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTravelAgency } from "../types/home.types";

interface AgencyCardProps { agency: HomeTravelAgency; favorite: boolean; onOpen(): void; onToggleFavorite(): void; width?: number; }
const FALLBACK = "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=78";

export function AgencyCard({ agency, favorite, onOpen, onToggleFavorite, width = 318 }: AgencyCardProps) {
  const image = agency.coverImageUrl || agency.logoUrl || FALLBACK;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${agency.name}`} onPress={onOpen} style={({ pressed }) => [s.card, { width }, pressed && s.pressed]}>
    <Image source={{ uri: image }} contentFit="cover" style={StyleSheet.absoluteFill} transition={170}/><LinearGradient colors={["rgba(20,25,36,.02)", "rgba(20,25,36,.18)", "rgba(20,25,36,.92)"]} locations={[0.18, 0.48, 1]} style={StyleSheet.absoluteFill}/>
    <View style={s.top}><View style={s.rating}><Ionicons name="star" size={12} color="#FFD073"/><Text style={s.ratingText}>{agency.rating > 0 ? agency.rating.toFixed(1) : "New"}</Text></View><Pressable onPress={(event) => { event.stopPropagation(); onToggleFavorite(); }} style={s.favorite}><Ionicons name={favorite ? "bookmark" : "bookmark-outline"} size={18} color="#FFFFFF"/></Pressable></View>
    <View style={s.body}><Text numberOfLines={1} style={s.name}>{agency.name}</Text><Text numberOfLines={2} style={s.description}>{agency.description || agency.subtitle || "TRAVA travel partner"}</Text><View style={s.tags}>{(agency.specialties.length ? agency.specialties : ["Curated trips", "Direct chat"]).slice(0, 3).map((tag) => <View key={tag} style={s.tag}><Text numberOfLines={1} style={s.tagText}>{tag}</Text></View>)}</View><View style={s.open}><Text style={s.openText}>View agency</Text><Ionicons name="arrow-forward" size={16} color="#24334A"/></View></View>
  </Pressable>;
}
const s = StyleSheet.create({
  card: { height: 390, borderRadius: 27, overflow: "hidden", backgroundColor: "#DDE5EC", boxShadow: "0 16px 34px rgba(34,45,64,.15)" }, top: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, rating: { minHeight: 31, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(30,39,54,.58)" }, ratingText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" }, favorite: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)" }, body: { position: "absolute", left: 16, right: 16, bottom: 15 }, name: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" }, description: { marginTop: 7, color: "rgba(255,255,255,.86)", fontSize: 10, lineHeight: 15, fontWeight: "600" }, tags: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 6 }, tag: { maxWidth: 110, minHeight: 25, paddingHorizontal: 8, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.13)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" }, tagText: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "800" }, open: { marginTop: 14, height: 44, borderRadius: 22, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF" }, openText: { color: "#24334A", fontSize: 10, fontWeight: "900" }, pressed: { opacity: 0.88, transform: [{ scale: 0.993 }] },
});
