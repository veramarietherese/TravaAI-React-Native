import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

const CAMPAIGN_IMAGE = "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1600&q=86";

export function TravelAgencyPromoBanner({ onPress }: { onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Explore travel agencies" onPress={onPress} style={({ pressed }) => [s.wrap, pressed && s.pressed]}>
      <View style={s.banner}>
        <Image source={{ uri: CAMPAIGN_IMAGE }} contentFit="cover" cachePolicy="memory-disk" transition={180} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(14,25,49,.93)", "rgba(28,44,76,.74)", "rgba(57,70,105,.16)"]} locations={[0, .54, 1]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={StyleSheet.absoluteFill} />
        <View style={s.copy}>
          <View style={s.eyebrowRow}><Ionicons name="shield-checkmark-outline" size={13} color="#DDE8FF" /><Text style={s.eyebrow}>TRAVA PARTNERS</Text></View>
          <Text style={s.title}>Plan with a local travel expert.</Text>
          <Text style={s.subtitle}>Compare curated packages, destination support and custom itineraries in one place.</Text>
          <View style={s.cta}><Text style={s.ctaText}>Explore agencies</Text><Ionicons name="arrow-forward" size={15} color="#22304F" /></View>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 4, width: "100%" },
  pressed: { opacity: .92, transform: [{ scale: .994 }] },
  banner: { minHeight: 184, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: "#E3E7EF", boxShadow: "0 18px 40px rgba(34,47,74,.12)" },
  copy: { width: "68%", minWidth: 220, padding: 21, justifyContent: "center" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrow: { color: "#DDE8FF", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.05 },
  title: { marginTop: 9, color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -.35 },
  subtitle: { marginTop: 7, maxWidth: 410, color: "#E2E8F3", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  cta: { marginTop: 15, minHeight: 38, alignSelf: "flex-start", paddingHorizontal: 13, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,.94)", borderWidth: 1, borderColor: "#FFFFFF" },
  ctaText: { color: "#22304F", fontSize: 9.5, fontWeight: "900" },
});
