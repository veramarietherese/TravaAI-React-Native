import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

export function DocumentsHero({ documentCount }: { documentCount: number }) {
  return (
    <LinearGradient colors={["#F4F8FF", "#F0EEFF", "#FFF3F8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
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

      <View pointerEvents="none" style={s.folderScene}>
        <View style={s.folderShadow} />
        <LinearGradient colors={["#A8C8FF", "#A6A9F7"]} style={s.folderBack}><View style={s.folderTab} /></LinearGradient>
        <View style={s.paper}><View style={s.paperLine} /><View style={[s.paperLine, s.paperLineShort]} /></View>
        <LinearGradient colors={["rgba(151,199,255,.94)", "rgba(174,169,249,.94)", "rgba(238,190,226,.90)"]} style={s.folderFront}>
          <View style={s.folderHighlight} />
          <View style={s.lock}><Ionicons name="lock-closed" size={17} color="#FFFFFF" /></View>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hero: { minHeight: 238, borderRadius: 32, padding: 26, justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#E3E8F3", boxShadow: "0 18px 46px rgba(65,78,112,.10)" },
  copy: { maxWidth: 470, paddingRight: 132, zIndex: 2 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { color: "#6076B7", fontSize: 9, fontWeight: "900", letterSpacing: 1.15 },
  title: { marginTop: 12, color: "#15223F", fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -.6 },
  subtitle: { marginTop: 9, color: "#64728A", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  badges: { marginTop: 17, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  badge: { minHeight: 31, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,.66)", borderWidth: 1, borderColor: "rgba(255,255,255,.94)" },
  badgeText: { color: "#566781", fontSize: 8.5, fontWeight: "800" },
  folderScene: { position: "absolute", right: 19, top: 49, width: 120, height: 128, transform: [{ rotate: "-4deg" }] },
  folderShadow: { position: "absolute", left: 13, right: 3, bottom: 4, height: 29, borderRadius: 18, backgroundColor: "rgba(89,112,180,.13)" },
  folderBack: { position: "absolute", left: 8, right: 3, top: 22, bottom: 13, borderRadius: 23, borderWidth: 1, borderColor: "rgba(255,255,255,.86)" },
  folderTab: { position: "absolute", left: 11, top: -13, width: 48, height: 25, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: "#A8C8FF" },
  paper: { position: "absolute", left: 24, right: 17, top: 35, height: 66, padding: 13, gap: 7, borderRadius: 14, backgroundColor: "rgba(255,255,255,.88)", borderWidth: 1, borderColor: "#FFFFFF" },
  paperLine: { height: 5, borderRadius: 3, backgroundColor: "#C8D6F3" },
  paperLineShort: { width: "63%", backgroundColor: "#E1CDE8" },
  folderFront: { position: "absolute", left: 6, right: 0, top: 58, bottom: 4, borderRadius: 23, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.92)" },
  folderHighlight: { position: "absolute", left: 10, right: 10, top: 8, height: 14, borderRadius: 8, backgroundColor: "rgba(255,255,255,.25)" },
  lock: { position: "absolute", right: 13, bottom: 12, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(75,95,175,.42)", borderWidth: 1, borderColor: "rgba(255,255,255,.64)" },
});
