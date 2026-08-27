import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export function AgencyBrandMark({
  name,
  logoUrl,
  size = 54,
  style,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "T";

  const usableLogo = logoUrl && /logo|brand|icon|avatar/i.test(logoUrl) ? logoUrl : null;

  if (usableLogo) {
    return (
      <View style={[s.logoShell, { width: size, height: size, borderRadius: size * 0.28 }, style]}>
        <Image source={{ uri: usableLogo }} contentFit="contain" style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#132A46", "#294B72"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.fallback, { width: size, height: size, borderRadius: size * 0.28 }, style]}
    >
      <View style={[s.accent, { width: size * 0.44, height: size * 0.44, borderRadius: size * 0.12 }]} />
      <Text style={[s.initials, { fontSize: size * 0.29 }]}>{initials}</Text>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  logoShell: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E8EE" },
  fallback: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  accent: { position: "absolute", right: -6, top: -5, transform: [{ rotate: "24deg" }], backgroundColor: "#F2A86B", opacity: 0.95 },
  initials: { color: "#FFFFFF", fontWeight: "900", letterSpacing: 0.4 },
});
