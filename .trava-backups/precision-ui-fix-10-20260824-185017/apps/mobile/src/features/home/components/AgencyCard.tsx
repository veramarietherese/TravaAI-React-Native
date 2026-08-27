import { Ionicons } from "@expo/vector-icons";
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

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=78";

export function AgencyCard({
  agency,
  favorite,
  onOpen,
  onToggleFavorite,
  width = 344,
}: AgencyCardProps) {
  const specialties = (agency.specialties.length ? agency.specialties : ["Curated trips", "Direct chat"]).slice(0, 3);
  const subtitle = agency.subtitle || agency.description || "TRAVA travel partner";

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${agency.name}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]}
      >
        <Image
          source={{ uri: agency.coverImageUrl || agency.logoUrl || FALLBACK_IMAGE }}
          contentFit="cover"
          transition={160}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.singleImagePager}>
          <View style={styles.pagerActive} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? `Remove ${agency.name} from favorites` : `Save ${agency.name}`}
        onPress={onToggleFavorite}
        style={({ pressed }) => [styles.favoriteButton, pressed && styles.favoritePressed]}
      >
        <Ionicons name={favorite ? "heart" : "heart-outline"} size={24} color="#FFFFFF" />
      </Pressable>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>{agency.name}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={18} color="#EAA33C" />
            <Text style={styles.ratingText}>{agency.rating > 0 ? agency.rating.toFixed(1) : "New"}</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="business-outline" size={20} color="#5F697A" />
          <Text numberOfLines={1} style={styles.locationText}>{subtitle}</Text>
        </View>

        <View style={styles.infoRow}>
          {specialties.map((specialty, index) => (
            <View key={`${agency.id}-${specialty}-${index}`} style={[styles.infoItem, index === specialties.length - 1 && styles.infoItemFlexible]}>
              <Ionicons
                name={index === 0 ? "compass-outline" : index === 1 ? "chatbubble-ellipses-outline" : "sparkles-outline"}
                size={18}
                color="#171B22"
              />
              <Text numberOfLines={1} style={styles.infoText}>{specialty}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.partnerBlock}>
            <Text style={styles.partnerLabel}>TRAVA Partner</Text>
            <Text style={styles.partnerCaption}>{specialties.length} specialt{specialties.length === 1 ? "y" : "ies"}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${agency.name}`}
            onPress={onOpen}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Ionicons name="storefront-outline" size={19} color="#FFFFFF" />
            <Text style={styles.ctaText}>View agency</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 31,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E7E7",
    boxShadow: "0 16px 34px rgba(27,31,38,.10)",
  },
  imageButton: {
    position: "relative",
    height: 264,
    overflow: "hidden",
    borderRadius: 25,
    backgroundColor: "#EEF1F4",
  },
  pressed: { opacity: 0.91 },
  favoriteButton: {
    position: "absolute",
    right: 27,
    top: 27,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,48,57,.62)",
    zIndex: 4,
  },
  favoritePressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  singleImagePager: {
    position: "absolute",
    alignSelf: "center",
    bottom: 14,
    height: 18,
    minWidth: 42,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,48,55,.46)",
  },
  pagerActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  body: { paddingHorizontal: 7, paddingTop: 17, paddingBottom: 7 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: "#111318",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.45,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingText: {
    color: "#2B2D32",
    fontSize: 13,
    fontWeight: "800",
  },
  locationRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    flex: 1,
    color: "#656B74",
    fontSize: 13,
    fontWeight: "650",
  },
  infoRow: {
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoItem: {
    maxWidth: 110,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoItemFlexible: { flex: 1 },
  infoText: {
    flexShrink: 1,
    color: "#25282D",
    fontSize: 10.5,
    fontWeight: "750",
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partnerBlock: { flex: 1 },
  partnerLabel: {
    color: "#111318",
    fontSize: 17,
    fontWeight: "900",
  },
  partnerCaption: {
    marginTop: 2,
    color: "#777D86",
    fontSize: 9,
    fontWeight: "700",
  },
  cta: {
    minWidth: 176,
    height: 58,
    paddingHorizontal: 21,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#090909",
    boxShadow: "0 9px 20px rgba(0,0,0,.14)",
  },
  ctaPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
