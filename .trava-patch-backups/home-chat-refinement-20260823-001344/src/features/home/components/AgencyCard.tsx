import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HomeTravelAgency } from "../types/home.types";

interface AgencyCardProps {
  agency: HomeTravelAgency;
  favorite: boolean;
  onOpen(): void;
  onToggleFavorite(): void;
  width?: number;
}

export function AgencyCard({ agency, favorite, onOpen, onToggleFavorite, width = 286 }: AgencyCardProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.topRow}>
        <View style={styles.logo}>
          {agency.logoUrl ? (
            <Image source={{ uri: agency.logoUrl }} contentFit="cover" style={StyleSheet.absoluteFill} transition={150} />
          ) : (
            <Text style={styles.logoText}>{agency.name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.name}>{agency.name}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{agency.subtitle || "Verified travel partner"}</Text>
          {agency.rating > 0 ? <Text style={styles.rating}>★ {agency.rating.toFixed(1)}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Remove agency from favorites" : "Add agency to favorites"}
          onPress={onToggleFavorite}
          style={({ pressed }: { pressed: boolean }) => [styles.favorite, pressed && styles.pressed]}
        >
          <Text style={[styles.favoriteGlyph, favorite && styles.favoriteActive]}>{favorite ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      <View style={styles.tags}>
        {(agency.specialties.length ? agency.specialties : ["Trips", "Support"]).slice(0, 3).map((tag) => (
          <Text key={tag} numberOfLines={1} style={styles.tag}>{tag}</Text>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${agency.name}`}
        onPress={onOpen}
        style={({ pressed }: { pressed: boolean }) => [styles.openButton, pressed && styles.pressed]}
      >
        <Text style={styles.openText}>View agency</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#E8EAF1",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#374063",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: {
    width: 58,
    height: 58,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#7558F0",
  },
  logoText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0 },
  name: { color: "#1A2743", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  subtitle: { marginTop: 3, color: "#758198", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  rating: { marginTop: 4, color: "#E29A1A", fontSize: 10, fontWeight: "800" },
  favorite: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#F7F6FF" },
  favoriteGlyph: { color: "#53617B", fontSize: 22, lineHeight: 24, fontWeight: "700" },
  favoriteActive: { color: "#FF4E91" },
  tags: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { maxWidth: 94, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, color: "#654CDA", backgroundColor: "#F0ECFF", fontSize: 9, fontWeight: "800" },
  openButton: { marginTop: 12, minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F7F8FF" },
  openText: { color: "#33415F", fontSize: 11, fontWeight: "800" },
  chevron: { color: "#7558F0", fontSize: 21, fontWeight: "800" },
  pressed: { opacity: 0.65 },
});
