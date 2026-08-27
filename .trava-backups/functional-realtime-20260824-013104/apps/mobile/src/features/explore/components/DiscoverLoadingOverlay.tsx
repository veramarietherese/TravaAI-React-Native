import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

export function DiscoverLoadingOverlay() {
  return (
    <View pointerEvents="none" style={s.overlay}>
      <View style={s.mapGhost}>
        <View style={[s.pin, s.pinOne]}><Ionicons name="location" size={15} color="#FFFFFF" /></View>
        <View style={[s.pin, s.pinTwo]}><Ionicons name="cafe" size={14} color="#FFFFFF" /></View>
        <View style={[s.pin, s.pinThree]}><Ionicons name="leaf" size={14} color="#FFFFFF" /></View>
      </View>
      <View style={s.caption}>
        <View style={s.dot} />
        <Text style={s.text}>Finding nearby places...</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(247,250,255,.68)", borderRadius: 30 },
  mapGhost: { width: 160, height: 88, borderRadius: 24, backgroundColor: "rgba(255,255,255,.68)", borderWidth: 1, borderColor: "rgba(255,255,255,.96)" },
  pin: { position: "absolute", width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  pinOne: { left: 24, top: 32, backgroundColor: "#6E8FEF" },
  pinTwo: { right: 25, top: 15, backgroundColor: "#9C83E8" },
  pinThree: { right: 55, bottom: 8, backgroundColor: "#75B59B" },
  caption: { marginTop: 12, minHeight: 34, paddingHorizontal: 13, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,.90)", borderWidth: 1, borderColor: "#E8EDF5" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#5E87EF" },
  text: { color: "#52617A", fontSize: 10, fontWeight: "800" },
});
