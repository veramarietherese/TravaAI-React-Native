import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function TravelAgencyPromoBanner({ onPress }: { onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Explore verified travel agencies" onPress={onPress} style={({ pressed }) => [s.wrap, pressed && s.pressed]}>
      <LinearGradient colors={["#17191D", "#292D34"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
        <View style={s.iconWell}>
          <Ionicons name="airplane-outline" size={25} color="#FFFFFF" />
        </View>
        <View style={s.copy}>
          <Text style={s.eyebrow}>TRAVA VERIFIED PARTNERS</Text>
          <Text style={s.title}>Need a travel expert?</Text>
          <Text style={s.subtitle}>Compare curated packages, local support and custom itineraries from verified agencies.</Text>
        </View>
        <View style={s.cta}>
          <Text style={s.ctaText}>Explore agencies</Text>
          <Ionicons name="arrow-forward" size={16} color="#17191D" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 4, width: "100%" },
  pressed: { opacity: 0.94, transform: [{ scale: 0.996 }] },
  banner: { minHeight: 126, padding: 20, borderRadius: 30, flexDirection: "row", alignItems: "center", gap: 16, overflow: "hidden", borderWidth: 1, borderColor: "#30343B", boxShadow: "0 18px 42px rgba(22,25,31,.14)" },
  iconWell: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.09)", borderWidth: 1, borderColor: "rgba(255,255,255,.13)" },
  copy: { flex: 1, minWidth: 160 },
  eyebrow: { color: "#AEB6C3", fontSize: 9, fontWeight: "900", letterSpacing: 1.05 },
  title: { marginTop: 5, color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  subtitle: { marginTop: 6, maxWidth: 520, color: "#C6CCD5", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  cta: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFFFFF" },
  ctaText: { color: "#17191D", fontSize: 10, fontWeight: "900" },
});
