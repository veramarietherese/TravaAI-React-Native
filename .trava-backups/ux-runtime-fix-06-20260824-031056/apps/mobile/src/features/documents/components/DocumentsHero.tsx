import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

const FOLDER = require("../../../../assets/trava-premium/documents-folder.png");

export function DocumentsHero({ documentCount }: { documentCount: number }) {
  return (
    <LinearGradient colors={["#F3F8FF", "#F0F0FF", "#FFF3F8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View style={s.copy}>
        <View style={s.eyebrowRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#5F77C9" />
          <Text style={s.eyebrow}>PRIVATE TRIP VAULT</Text>
        </View>
        <Text style={s.title}>Your travel files, always within reach.</Text>
        <Text style={s.subtitle}>{documentCount} local {documentCount === 1 ? "entry" : "entries"} - kept with this trip workspace.</Text>
        <View style={s.badges}>
          <View style={s.badge}><Ionicons name="phone-portrait-outline" size={13} color="#566781" /><Text style={s.badgeText}>On this device</Text></View>
          <View style={s.badge}><Ionicons name="lock-closed-outline" size={13} color="#566781" /><Text style={s.badgeText}>Private</Text></View>
        </View>
      </View>
      <View pointerEvents="none" style={s.visual}>
        <Image source={FOLDER} contentFit="contain" cachePolicy="memory" style={s.folder} />
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero: { minHeight: 238, borderRadius: 32, padding: 26, justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#E3E8F3", boxShadow: "0 18px 46px rgba(65,78,112,.10)" },
  copy: { maxWidth: 470, paddingRight: 148, zIndex: 2 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { color: "#6076B7", fontSize: 9, fontWeight: "900", letterSpacing: 1.15 },
  title: { marginTop: 12, color: "#15223F", fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -.6 },
  subtitle: { marginTop: 9, color: "#64728A", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  badges: { marginTop: 17, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  badge: { minHeight: 31, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,.70)", borderWidth: 1, borderColor: "rgba(255,255,255,.96)" },
  badgeText: { color: "#566781", fontSize: 8.5, fontWeight: "800" },
  visual: { position: "absolute", right: 6, top: 23, width: 164, height: 178, alignItems: "center", justifyContent: "center" },
  folder: { width: 164, height: 164 },
});
