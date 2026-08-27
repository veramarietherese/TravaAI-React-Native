import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HomeTravelAgency } from "../types/home.types";

const SKY_IMAGE = "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=82";

export function TravelAgencyPromoBanner({
  agency,
  onPress,
}: {
  agency?: HomeTravelAgency | null;
  onPress(): void;
}) {
  const title = agency?.name ? `Fly into something new with ${agency.name}.` : "Your next journey deserves a better takeoff.";
  const sub = agency?.subtitle || agency?.specialties?.slice(0, 2).join(" · ") || "Curated travel packages, expert planning and destination support.";

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open featured travel partner" onPress={onPress} style={({ pressed }) => [s.wrap, pressed && s.pressed]}>
      <LinearGradient colors={["#337BDF", "#718CE8", "#F3A6D0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
        <Image source={{ uri: agency?.coverImageUrl || SKY_IMAGE }} contentFit="cover" cachePolicy="memory-disk" transition={150} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(31,85,173,.90)", "rgba(75,111,205,.52)", "rgba(255,150,197,.18)"]} locations={[0, .55, 1]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={s.sun} />
        <View pointerEvents="none" style={[s.cloud, s.cloudOne]} />
        <View pointerEvents="none" style={[s.cloud, s.cloudTwo]} />

        <View style={s.copy}>
          <View style={s.partnerRow}>
            <View style={s.partnerMark}><Ionicons name="airplane" size={14} color="#FFFFFF" /></View>
            <Text style={s.eyebrow}>{agency?.name ? "FEATURED TRAVA PARTNER" : "TRAVA PARTNER PROMO"}</Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text numberOfLines={2} style={s.subtitle}>{sub}</Text>
          <View style={s.cta}>
            <Text style={s.ctaText}>{agency?.name ? "View partner" : "Explore agencies"}</Text>
            <Ionicons name="arrow-forward" size={15} color="#24518C" />
          </View>
        </View>

        <View pointerEvents="none" style={s.planeOrb}>
          <Ionicons name="airplane" size={78} color="rgba(255,255,255,.93)" style={s.plane} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 4, width: "100%" },
  pressed: { opacity: .92, transform: [{ scale: .995 }] },
  banner: { minHeight: 216, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.88)", boxShadow: "0 18px 42px rgba(50,87,157,.18)" },
  copy: { width: "67%", minWidth: 230, padding: 23, zIndex: 3 },
  partnerRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  partnerMark: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.18)", borderWidth: 1, borderColor: "rgba(255,255,255,.32)" },
  eyebrow: { color: "#FFFFFF", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.15 },
  title: { marginTop: 13, color: "#FFFFFF", fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -.6 },
  subtitle: { marginTop: 8, maxWidth: 420, color: "rgba(255,255,255,.88)", fontSize: 10.5, lineHeight: 15.5, fontWeight: "600" },
  cta: { marginTop: 17, minHeight: 40, alignSelf: "flex-start", paddingHorizontal: 14, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,.94)", borderWidth: 1, borderColor: "#FFFFFF" },
  ctaText: { color: "#24518C", fontSize: 9.5, fontWeight: "900" },
  planeOrb: { position: "absolute", right: 30, top: 55, width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.11)", borderWidth: 1, borderColor: "rgba(255,255,255,.18)", zIndex: 2 },
  plane: { transform: [{ rotate: "-12deg" }] },
  sun: { position: "absolute", left: 130, top: -24, width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(255,223,175,.35)" },
  cloud: { position: "absolute", backgroundColor: "rgba(255,255,255,.14)", borderRadius: 999 },
  cloudOne: { right: -20, bottom: -20, width: 210, height: 85 },
  cloudTwo: { left: 46, bottom: -27, width: 170, height: 70 },
});
