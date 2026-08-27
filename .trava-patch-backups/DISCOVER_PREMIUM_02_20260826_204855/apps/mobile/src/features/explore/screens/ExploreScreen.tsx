import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { hydratePlacePhotos } from "@/features/maps/utils/place-photo";
import { searchNearbyPlaces, searchWorldPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import { readSavedPlaces, savePinnedPlace, writeSavedPlaces } from "../utils/discover-storage";

type CategoryName = "Cafes" | "Food" | "Shopping" | "Hiking" | "Work" | "Parks";
type Coordinates = { latitude: number; longitude: number };
type IconName = ComponentProps<typeof Ionicons>["name"];

const CATEGORIES: { name: CategoryName; api: string; icon: IconName }[] = [
  { name: "Cafes", api: "cafes", icon: "cafe-outline" },
  { name: "Food", api: "food", icon: "restaurant-outline" },
  { name: "Shopping", api: "shopping", icon: "bag-handle-outline" },
  { name: "Hiking", api: "hiking", icon: "footsteps-outline" },
  { name: "Work", api: "work", icon: "briefcase-outline" },
  { name: "Parks", api: "parks", icon: "leaf-outline" },
];

export function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const { width } = useWindowDimensions();
  const { profile, user } = useAuth();
  const avatar =
    profile?.avatar_url ||
    (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);

  const initialQuery = typeof params.query === "string" ? params.query : "";
  const [query, setQuery] = useState(initialQuery);
  const [openSearch, setOpenSearch] = useState(Boolean(initialQuery));
  const [activeCategory, setActiveCategory] = useState<CategoryName | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverPlace[]>([]);
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [searching, setSearching] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    let live = true;
    void readSavedPlaces().then((items) => { if (live) setSaved(items); });
    void Location.requestForegroundPermissionsAsync().then(async (permission) => {
      if (!live) return;
      if (permission.status !== "granted") {
        setCoords({ latitude: 10.3157, longitude: 123.8854 });
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (live) setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch {
        if (live) setCoords({ latitude: 10.3157, longitude: 123.8854 });
      }
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!coords || places.length) return;
    let live = true;
    void (async () => {
      const groups = await Promise.allSettled([
        searchNearbyPlaces("cafes", coords.latitude, coords.longitude, 4),
        searchNearbyPlaces("food", coords.latitude, coords.longitude, 4),
        searchNearbyPlaces("shopping", coords.latitude, coords.longitude, 4),
        searchNearbyPlaces("parks", coords.latitude, coords.longitude, 4),
      ]);
      const world = groups.flatMap((item) => item.status === "fulfilled" ? item.value : []);
      const hydrated = await toDiscover(world.slice(0, 12), coords);
      if (!live) return;
      setPlaces(hydrated);
      setSelectedId(hydrated[0]?.id ?? null);
    })();
    return () => { live = false; };
  }, [coords, places.length]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;

    const current = ++sequence.current;
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const world = await searchWorldPlaces(text, coords, 9);
          if (current !== sequence.current) return;
          const hydrated = await toDiscover(world, coords);
          if (current === sequence.current) setSuggestions(hydrated);
        } finally {
          if (current === sequence.current) setSearching(false);
        }
      })();
    }, 280);

    return () => clearTimeout(timer);
  }, [coords, query]);

  const selected = useMemo(
    () => places.find((item) => item.id === selectedId) ?? places[0] ?? null,
    [places, selectedId],
  );

  async function selectSearchResult(place: DiscoverPlace) {
    setQuery(place.name);
    setOpenSearch(false);
    setActiveCategory(null);
    const related = suggestions.filter((item) => item.id !== place.id);
    setPlaces([place, ...related].slice(0, 10));
    setSelectedId(place.id);
  }

  async function chooseCategory(category: CategoryName) {
    const anchor = selected ?? (coords ? { latitude: coords.latitude, longitude: coords.longitude } : null);
    if (!anchor) return;
    setActiveCategory(category);
    const api = CATEGORIES.find((item) => item.name === category)?.api ?? category.toLowerCase();
    const world = await searchNearbyPlaces(api, anchor.latitude, anchor.longitude, 14);
    const hydrated = await toDiscover(world, { latitude: anchor.latitude, longitude: anchor.longitude }, category);
    setPlaces(hydrated);
    setSelectedId(hydrated[0]?.id ?? null);
  }

  function toggleSaved(place: DiscoverPlace) {
    setSaved((current) => {
      const exists = current.includes(place.id);
      const next = exists ? current.filter((id) => id !== place.id) : [...current, place.id];
      void writeSavedPlaces(next);
      if (!exists) void savePinnedPlace(place);
      return next;
    });
  }

  const maxWidth = Math.min(940, Math.max(320, width - 24));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={[s.page, { maxWidth }]}>
          <View style={s.header}>
            <Text style={s.heading}>Discover</Text>
            <Pressable onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} style={s.avatar}>
              {avatar ? <Image source={{ uri: avatar }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="person" size={24} color="#17213A" />}
              <View style={s.badge}><Text style={s.badgeText}>3</Text></View>
            </Pressable>
          </View>

          <View style={s.searchWrap}>
            <View style={s.search}>
              <Ionicons name="search-outline" size={29} color="#74829B" />
              <TextInput
                value={query}
                onFocus={() => setOpenSearch(true)}
                onChangeText={(value) => { setQuery(value); setOpenSearch(true); if (value.trim().length < 2) { setSuggestions([]); setSearching(false); } }}
                placeholder="Search places, cafes, parks, landmarks..."
                placeholderTextColor="#8793A8"
                autoCorrect={false}
                style={s.searchInput}
              />
              {searching ? <ActivityIndicator color="#547BFF" /> : (
                <Pressable onPress={() => query && setQuery("")} style={s.mic}>
                  <Ionicons name={query ? "close" : "mic"} size={22} color="#416FFF" />
                </Pressable>
              )}
            </View>

            {openSearch && query.trim().length >= 2 ? (
              <View style={s.dropdown}>
                <Text style={s.dropdownLabel}>SEARCHED PLACES</Text>
                {suggestions.map((place) => (
                  <Pressable key={place.id} onPress={() => void selectSearchResult(place)} style={({ pressed }) => [s.result, pressed && s.pressed]}>
                    <Image source={{ uri: place.imageUrl }} contentFit="cover" style={s.resultImage} />
                    <View style={s.resultCopy}>
                      <Text numberOfLines={1} style={s.resultName}>{place.name}</Text>
                      <Text numberOfLines={1} style={s.resultAddress}>{place.subtitle}</Text>
                      <View style={s.exactRow}>
                        <Ionicons name="location" size={11} color="#6184C8" />
                        <Text style={s.exactText}>Exact venue image when available; otherwise exact map location</Text>
                      </View>
                    </View>
                    <Ionicons name="navigate-outline" size={19} color="#8290A5" />
                  </Pressable>
                ))}
                {!searching && !suggestions.length ? <Text style={s.noResults}>No matching place yet. Try the full venue and city name.</Text> : null}
              </View>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {CATEGORIES.map((item) => (
              <Pressable key={item.name} onPress={() => void chooseCategory(item.name)} style={[s.chip, activeCategory === item.name && s.chipOn]}>
                <Ionicons name={item.icon} size={18} color="#27334A" /><Text style={s.chipText}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <DiscoverMap places={places} selectedId={selectedId} center={selected ? { latitude: selected.latitude, longitude: selected.longitude } : coords} onSelect={setSelectedId} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={s.cards}>
            {places.map((place) => (
              <Pressable key={place.id} onPress={() => setSelectedId(place.id)} style={[s.placeCard, selectedId === place.id && s.placeCardOn]}>
                <View style={s.placeImage}>
                  <Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
                  <Pressable onPress={() => toggleSaved(place)} style={s.heart}>
                    <Ionicons name={saved.includes(place.id) ? "heart" : "heart-outline"} size={20} color={saved.includes(place.id) ? "#E77FA9" : "#59677D"} />
                  </Pressable>
                </View>
                <View style={s.placeBody}>
                  <Text numberOfLines={1} style={s.placeName}>{place.name}</Text>
                  <Text style={s.placeCategory}>{place.category}</Text>
                  <Text numberOfLines={1} style={s.placeAddress}>{place.subtitle}</Text>
                  <View style={s.placeMeta}><Text style={s.rating}>★ {place.rating > 0 ? place.rating.toFixed(1) : "Map listing"}</Text><Text style={s.distance}>{place.distance}</Text></View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {selected ? (
            <View style={s.featured}>
              <Image source={{ uri: selected.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={["rgba(255,255,255,.98)", "rgba(255,255,255,.90)", "rgba(255,255,255,.10)"]} start={{ x: 0.12, y: 0.5 }} end={{ x: 0.9, y: 0.5 }} style={StyleSheet.absoluteFill} />
              <View style={s.featuredCopy}>
                <View style={s.featuredTag}><Text style={s.featuredTagText}>✦ Featured</Text></View>
                <Text numberOfLines={1} style={s.featuredTitle}>{selected.name}</Text>
                <Text style={s.featuredMeta}>{selected.category} · {selected.distance}</Text>
                <Text numberOfLines={3} style={s.featuredBody}>{selected.subtitle}</Text>
                <Pressable onPress={() => setSelectedId(selected.id)} style={s.featuredButton}>
                  <LinearGradient colors={["#4D73FF", "#9C72F3", "#F286B8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.featuredGradient}>
                    <Text style={s.featuredButtonText}>View Details</Text><Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function toDiscover(items: WorldPlaceResult[], anchor: Coordinates | null, forcedCategory?: CategoryName): Promise<DiscoverPlace[]> {
  const hydrated = await hydratePlacePhotos(items, 4);
  return hydrated.map((item, index) => ({
    id: item.id || `place-${index}`,
    name: item.name,
    subtitle: item.displayName,
    latitude: item.latitude,
    longitude: item.longitude,
    imageUrl: item.imageUrl,
    rating: 0,
    distance: anchor ? formatDistance(haversine(anchor.latitude, anchor.longitude, item.latitude, item.longitude)) : "Explore",
    category: forcedCategory || inferCategory(item.category || ""),
    city: item.city,
    country: item.country,
  }));
}

function inferCategory(value: string): CategoryName {
  const text = value.toLowerCase();
  if (text.includes("cafe") || text.includes("coffee")) return "Cafes";
  if (text.includes("restaurant") || text.includes("food")) return "Food";
  if (text.includes("shop") || text.includes("mall")) return "Shopping";
  if (text.includes("trail") || text.includes("hiking")) return "Hiking";
  if (text.includes("office") || text.includes("work") || text.includes("library")) return "Work";
  return "Parks";
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.max(10, Math.round(km * 1000 / 10) * 10)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 150 },
  page: { width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  heading: { color: "#07142E", fontSize: 48, lineHeight: 54, fontWeight: "900", letterSpacing: -1.4 },
  avatar: { width: 58, height: 58, borderRadius: 29, overflow: "visible", alignItems: "center", justifyContent: "center", backgroundColor: "#F2F5FA", borderWidth: 3, borderColor: "#FFFFFF", boxShadow: "0 8px 22px rgba(50,65,100,.14)" },
  badge: { position: "absolute", right: -3, top: -4, minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F45E96", borderWidth: 2, borderColor: "#FFFFFF" },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  searchWrap: { zIndex: 20 },
  search: { minHeight: 76, borderRadius: 23, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E8F0", boxShadow: "0 10px 28px rgba(44,60,94,.08)" },
  searchInput: { flex: 1, minWidth: 0, color: "#14203A", fontSize: 18, fontWeight: "600" },
  mic: { width: 45, height: 45, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFF", borderWidth: 1, borderColor: "#E6EBF4" },
  dropdown: { position: "absolute", left: 0, right: 0, top: 82, maxHeight: 500, padding: 10, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E8F0", boxShadow: "0 18px 46px rgba(34,50,82,.16)" },
  dropdownLabel: { paddingHorizontal: 8, paddingVertical: 6, color: "#8995A7", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.1 },
  result: { minHeight: 76, padding: 7, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 11 },
  resultImage: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#EEF2F7" },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { color: "#14203A", fontSize: 13, fontWeight: "900" },
  resultAddress: { marginTop: 3, color: "#7B8798", fontSize: 9.5, fontWeight: "600" },
  exactRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  exactText: { color: "#7390C9", fontSize: 7.5, fontWeight: "700" },
  noResults: { padding: 15, color: "#8591A4", fontSize: 10, fontWeight: "600" },
  chips: { paddingVertical: 18, gap: 10 },
  chip: { minHeight: 52, paddingHorizontal: 20, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E6ED", boxShadow: "0 7px 18px rgba(45,58,84,.05)" },
  chipOn: { backgroundColor: "#F0F5FF", borderColor: "#C6D5F0" },
  chipText: { color: "#202B41", fontSize: 12, fontWeight: "800" },
  cards: { paddingVertical: 26, gap: 14 },
  placeCard: { width: 244, overflow: "hidden", borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E8EF", boxShadow: "0 10px 26px rgba(40,55,85,.07)" },
  placeCardOn: { borderColor: "#B8CDF4" },
  placeImage: { height: 142, position: "relative", backgroundColor: "#EAF0F6" },
  heart: { position: "absolute", top: 10, right: 10, width: 37, height: 37, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.95)" },
  placeBody: { padding: 13 },
  placeName: { color: "#121D34", fontSize: 15, fontWeight: "900" },
  placeCategory: { marginTop: 4, color: "#7A68EA", fontSize: 9.5, fontWeight: "800" },
  placeAddress: { marginTop: 4, color: "#7A869A", fontSize: 9, fontWeight: "600" },
  placeMeta: { marginTop: 9, flexDirection: "row", justifyContent: "space-between" },
  rating: { color: "#D89A29", fontSize: 9, fontWeight: "800" },
  distance: { color: "#7B879A", fontSize: 9, fontWeight: "700" },
  featured: { minHeight: 300, overflow: "hidden", borderRadius: 28, backgroundColor: "#F1F4F8", borderWidth: 1, borderColor: "#E3E8F0", boxShadow: "0 16px 36px rgba(42,58,88,.08)" },
  featuredCopy: { width: "58%", minHeight: 300, padding: 28, justifyContent: "center" },
  featuredTag: { alignSelf: "flex-start", paddingHorizontal: 10, minHeight: 28, borderRadius: 14, justifyContent: "center", backgroundColor: "#F0E9FF" },
  featuredTagText: { color: "#7B5AE0", fontSize: 9.5, fontWeight: "900" },
  featuredTitle: { marginTop: 15, color: "#111D34", fontSize: 27, fontWeight: "900", letterSpacing: -0.5 },
  featuredMeta: { marginTop: 7, color: "#7057E2", fontSize: 11, fontWeight: "800" },
  featuredBody: { marginTop: 10, color: "#58677E", fontSize: 11, lineHeight: 17, fontWeight: "600" },
  featuredButton: { marginTop: 17, alignSelf: "flex-start", borderRadius: 25, overflow: "hidden" },
  featuredGradient: { minWidth: 180, minHeight: 50, paddingHorizontal: 18, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.74 },
});
