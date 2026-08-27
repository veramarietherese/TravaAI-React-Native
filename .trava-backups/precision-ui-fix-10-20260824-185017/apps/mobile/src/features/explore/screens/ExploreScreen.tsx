import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TripSummary } from "@trava/shared";

import { PremiumBlueButton } from "@/components/ui/PremiumBlueButton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { fallbackPlaceImage, hydratePlacePhotos } from "@/features/maps/utils/place-photo";
import { searchNearbyPlaces, searchWorldPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import { listTrips } from "@/features/trips/api/trips.api";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import { addDiscoverPlaceToItinerary } from "../utils/add-place-to-itinerary";
import { readSavedPlaces, savePinnedPlace, writeSavedPlaces } from "../utils/discover-storage";

type Category = "Cafes" | "Food" | "Shopping" | "Hiking" | "Work" | "Parks";
type Coordinates = { latitude: number; longitude: number };
type ChipIcon = React.ComponentProps<typeof Ionicons>["name"];

const CATEGORIES: { name: Category; icon: ChipIcon; api: string }[] = [
  { name: "Cafes", icon: "cafe-outline", api: "cafes" },
  { name: "Food", icon: "restaurant-outline", api: "food" },
  { name: "Shopping", icon: "bag-handle-outline", api: "shopping" },
  { name: "Hiking", icon: "trail-sign-outline", api: "hiking" },
  { name: "Work", icon: "briefcase-outline", api: "work" },
  { name: "Parks", icon: "leaf-outline", api: "parks" },
];

export function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, user } = useAuth();
  const avatarUrl = (profile as { avatar_url?: string | null } | null)?.avatar_url || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverPlace[]>([]);
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [searching, setSearching] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [tripOptions, setTripOptions] = useState<TripSummary[]>([]);
  const [tripLoading, setTripLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [adding, setAdding] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => { void readSavedPlaces().then(setSaved); }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (mounted) setUserCoords({ latitude: 10.3157, longitude: 123.8854 });
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted) setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch {
        if (mounted) setUserCoords({ latitude: 10.3157, longitude: 123.8854 });
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!userCoords || places.length) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- begin the initial nearby discovery request when coordinates become available.
    setNearbyLoading(true);
    void (async () => {
      try {
        const settled = await Promise.allSettled([
          searchNearbyPlaces("cafes", userCoords.latitude, userCoords.longitude, 4),
          searchNearbyPlaces("food", userCoords.latitude, userCoords.longitude, 4),
          searchNearbyPlaces("shopping", userCoords.latitude, userCoords.longitude, 4),
          searchNearbyPlaces("parks", userCoords.latitude, userCoords.longitude, 4),
        ]);
        const world = settled.flatMap((entry) => entry.status === "fulfilled" ? entry.value : []);
        const mapped = dedupePlaces(world.map((item, index) => mapWorldPlace(item, inferCategory(item.category ?? ""), index, userCoords))).slice(0, 12);
        if (!mapped.length || !live) return;
        const hydrated = await hydrateDiscover(mapped);
        if (!live) return;
        setPlaces(hydrated);
        setSelectedId(hydrated[0]?.id ?? null);
      } finally {
        if (live) setNearbyLoading(false);
      }
    })();
    return () => { live = false; };
  }, [places.length, userCoords]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- short queries intentionally invalidate the previous remote suggestions.
      setSuggestions([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the matching loading flag with the invalidated short query.
      setSearching(false);
      return;
    }
    const id = ++searchSeq.current;
    const timer = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const result = await searchWorldPlaces(text, userCoords, 10);
          if (id !== searchSeq.current) return;
          const mapped = result.map((item, index) => mapWorldPlace(item, inferCategory(text), index, userCoords));
          const hydrated = await hydrateDiscover(mapped);
          if (id === searchSeq.current) setSuggestions(hydrated);
        } finally {
          if (id === searchSeq.current) setSearching(false);
        }
      })();
    }, 260);
    return () => clearTimeout(timer);
  }, [query, userCoords]);

  const selected = useMemo(() => places.find((place) => place.id === selectedId) ?? places[0] ?? null, [places, selectedId]);
  const mapCenter = selected ? { latitude: selected.latitude, longitude: selected.longitude } : userCoords;

  async function chooseSearchResult(place: DiscoverPlace) {
    setQuery(place.name);
    setSearchOpen(false);
    setActiveCategory(null);
    setPlaces(dedupePlaces([place, ...suggestions.filter((item) => item.id !== place.id)]).slice(0, 12));
    setSelectedId(null);
    queueMicrotaskSafe(() => setSelectedId(place.id));
    const upgraded = (await hydrateDiscover([place]))[0];
    if (upgraded) setPlaces((current) => current.map((item) => item.id === upgraded.id ? upgraded : item));
  }

  async function chooseCategory(category: Category) {
    setActiveCategory(category);
    const anchor = selected ?? (userCoords ? { latitude: userCoords.latitude, longitude: userCoords.longitude } : null);
    if (!anchor) return;
    setNearbyLoading(true);
    try {
      const api = CATEGORIES.find((item) => item.name === category)?.api ?? category.toLowerCase();
      const world = await searchNearbyPlaces(api, anchor.latitude, anchor.longitude, 14);
      const mapped = world.map((item, index) => mapWorldPlace(item, category, index, { latitude: anchor.latitude, longitude: anchor.longitude }));
      const hydrated = await hydrateDiscover(mapped);
      setPlaces(hydrated);
      setSelectedId(hydrated[0]?.id ?? null);
      setSearchOpen(false);
    } finally { setNearbyLoading(false); }
  }

  async function toggleSaved(place: DiscoverPlace) {
    setSaved((current) => {
      const exists = current.includes(place.id);
      const next = exists ? current.filter((id) => id !== place.id) : [...current, place.id];
      void writeSavedPlaces(next);
      if (!exists) void savePinnedPlace(place);
      return next;
    });
  }

  async function loadTrips() {
    if (tripOptions.length || tripLoading) return;
    setTripLoading(true);
    try {
      const trips = await listTrips();
      const usable = trips.filter((trip) => trip.status !== "completed");
      setTripOptions(usable);
      setSelectedTripId((current) => current ?? usable[0]?.id ?? null);
    } catch { Alert.alert("Trips unavailable", "TRAVA could not load your trips. Make sure the API is running, then try again."); }
    finally { setTripLoading(false); }
  }

  async function openAddToItinerary() {
    if (!selected) return;
    setDetailsOpen(false);
    setAddOpen(true);
    setSelectedDay(1);
    setSelectedTime("09:00");
    await loadTrips();
  }

  function startVoiceSearch() {
    if (query) { setQuery(""); setSearchOpen(true); return; }
    if (Platform.OS !== "web") { Alert.alert("Voice search", "Voice search is available on supported browsers in this build."); return; }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null; onerror: (() => void) | null; start(): void };
      webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null; onerror: (() => void) | null; start(): void };
    };
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Speech) { Alert.alert("Voice search", "Voice search is not supported by this browser."); return; }
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript?.trim(); if (transcript) { setQuery(transcript); setSearchOpen(true); } };
    recognition.onerror = () => Alert.alert("Voice search", "TRAVA could not hear that. Try again or type your search.");
    recognition.start();
  }

  async function addToItinerary() {
    if (!selected) return;
    const trip = tripOptions.find((item) => item.id === selectedTripId);
    if (!trip) return;
    setAdding(true);
    try {
      await addDiscoverPlaceToItinerary({ trip, place: selected, dayNumber: selectedDay, startTime: selectedTime });
      setAddOpen(false);
    } catch (error) { Alert.alert("Could not add place", error instanceof Error ? error.message : "Please try again."); }
    finally { setAdding(false); }
  }

  const cardWidth = width < 520 ? Math.min(275, width - 64) : 270;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <View style={s.max}>
          <View style={s.header}>
            <Text style={s.title}>Discover</Text>
            <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} style={s.avatar}>
              {avatarUrl ? <Image source={{ uri: avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="person" size={24} color="#17213A" />}
              <View style={s.badge}><Text style={s.badgeText}>3</Text></View>
            </Pressable>
          </View>

          <View style={s.searchArea}>
            <View style={s.search}>
              <Ionicons name="search-outline" size={31} color="#71809A" />
              <TextInput
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChangeText={(value) => { setQuery(value); setSearchOpen(true); }}
                placeholder="Search places, cafes, parks, landmarks..."
                placeholderTextColor="#8793A8"
                autoCorrect={false}
                style={s.searchInput}
              />
              {searching ? <ActivityIndicator color="#6A95E9" /> : (
                <Pressable accessibilityLabel={query ? "Clear search" : "Voice search"} onPress={startVoiceSearch} style={s.mic}>
                  <Ionicons name={query ? "close" : "mic"} size={23} color="#4E72FF" />
                </Pressable>
              )}
            </View>

            {searchOpen && query.trim().length >= 2 ? (
              <View style={s.dropdown}>
                <View style={s.dropdownHead}><Text style={s.dropdownTitle}>Places</Text><Pressable onPress={() => setSearchOpen(false)}><Text style={s.done}>Done</Text></Pressable></View>
                <ScrollView style={s.dropdownScroll} keyboardShouldPersistTaps="handled">
                  {suggestions.map((place) => (
                    <Pressable key={place.id} onPress={() => void chooseSearchResult(place)} style={({ pressed }) => [s.suggestion, pressed && s.pressed]}>
                      <Image source={{ uri: place.imageUrl }} contentFit="cover" style={s.suggestionImage} />
                      <View style={s.suggestionCopy}><Text numberOfLines={1} style={s.suggestionName}>{place.name}</Text><Text numberOfLines={2} style={s.suggestionAddress}>{place.subtitle}</Text></View>
                      <Ionicons name="navigate-outline" size={20} color="#8795AB" />
                    </Pressable>
                  ))}
                  {!searching && suggestions.length === 0 ? <Text style={s.emptySearch}>No matching location yet. Try a fuller place name.</Text> : null}
                </ScrollView>
                <View style={s.providerRow}><Ionicons name="images-outline" size={13} color="#93A0B4" /><Text style={s.provider}>Free OpenStreetMap / Photon + Wikimedia Commons photos</Text></View>
              </View>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {CATEGORIES.map((category) => {
              const active = category.name === activeCategory;
              return <Pressable key={category.name} onPress={() => void chooseCategory(category.name)} style={[s.chip, active && s.chipActive]}>
                <Ionicons name={category.icon} size={19} color={active ? "#4B73D8" : "#28344D"} /><Text style={[s.chipText, active && s.chipTextActive]}>{category.name}</Text>
              </Pressable>;
            })}
          </ScrollView>

          <View style={s.mapWrap}>
            <DiscoverMap places={places} selectedId={selectedId} center={mapCenter} onSelect={setSelectedId} />
            {nearbyLoading ? <View style={s.mapLoading}><ActivityIndicator color="#6E94E8" /><Text style={s.mapLoadingText}>Finding nearby places...</Text></View> : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 14} decelerationRate="fast" contentContainerStyle={s.cards}>
            {places.map((place) => (
              <Pressable key={place.id} onPress={() => setSelectedId(place.id)} style={[s.placeCard, { width: cardWidth }, selectedId === place.id && s.placeCardSelected]}>
                <View style={s.cardImageWrap}>
                  <Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
                  <Pressable accessibilityLabel={saved.includes(place.id) ? "Remove saved place" : "Save place"} onPress={(event) => { event.stopPropagation(); void toggleSaved(place); }} style={s.heart}>
                    <Ionicons name={saved.includes(place.id) ? "heart" : "heart-outline"} size={20} color={saved.includes(place.id) ? "#E77FA9" : "#53617A"} />
                  </Pressable>
                </View>
                <View style={s.cardBody}><Text numberOfLines={1} style={s.placeName}>{place.name}</Text><Text style={s.placeCategory}>{place.category}</Text><Text numberOfLines={1} style={s.placeAddress}>{place.subtitle}</Text><View style={s.placeMeta}><Text style={s.mapListing}>★ Map listing</Text><Text style={s.distance}>{place.distance}</Text></View></View>
              </Pressable>
            ))}
          </ScrollView>

          {selected ? (
            <Pressable onPress={() => setDetailsOpen(true)} style={s.featured}>
              <Image source={{ uri: selected.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={["rgba(255,255,255,.98)", "rgba(255,255,255,.90)", "rgba(255,255,255,.12)"]} start={{ x: 0.18, y: 0.5 }} end={{ x: 0.9, y: 0.5 }} style={StyleSheet.absoluteFill} />
              <View style={s.featuredCopy}><View style={s.featuredTag}><Text style={s.featuredTagText}>✦ Featured</Text></View><Text numberOfLines={1} style={s.featuredTitle}>{selected.name}</Text><Text style={s.featuredMeta}>{selected.category} · {selected.distance}</Text><Text numberOfLines={2} style={s.featuredDescription}>{selected.subtitle}</Text><View style={s.featuredButton}><Text style={s.featuredButtonText}>View Details</Text><Ionicons name="chevron-forward" size={18} color="#FFFFFF" /></View></View>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <PlaceDetailsModal place={detailsOpen ? selected : null} saved={selected ? saved.includes(selected.id) : false} onClose={() => setDetailsOpen(false)} onSave={() => selected && void toggleSaved(selected)} onAdd={() => void openAddToItinerary()} />
      <AddToTripModal visible={addOpen} tripOptions={tripOptions} tripLoading={tripLoading} selectedTripId={selectedTripId} selectedDay={selectedDay} selectedTime={selectedTime} adding={adding} onClose={() => setAddOpen(false)} onTrip={setSelectedTripId} onDay={setSelectedDay} onTime={setSelectedTime} onAdd={() => void addToItinerary()} />
    </SafeAreaView>
  );
}

function PlaceDetailsModal({ place, saved, onClose, onSave, onAdd }: { place: DiscoverPlace | null; saved: boolean; onClose(): void; onSave(): void; onAdd(): void }) {
  if (!place) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}>
    <View style={s.modalImage}><Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#3C4860" /></Pressable></View>
    <Text style={s.modalTitle}>{place.name}</Text><Text style={s.modalMeta}>{place.category} · {place.distance}</Text><Text style={s.modalBody}>{place.subtitle}</Text>
    <View style={s.modalActions}><Pressable onPress={onSave} style={s.savePlace}><Ionicons name={saved ? "heart" : "heart-outline"} size={19} color="#DA7DA6" /><Text style={s.savePlaceText}>{saved ? "Saved" : "Save"}</Text></Pressable><PremiumBlueButton label="Add to itinerary" icon="calendar-outline" onPress={onAdd} style={{ flex: 1 }} /></View>
  </View></View></Modal>;
}

function AddToTripModal(props: { visible: boolean; tripOptions: TripSummary[]; tripLoading: boolean; selectedTripId: string | null; selectedDay: number; selectedTime: string; adding: boolean; onClose(): void; onTrip(value: string): void; onDay(value: number): void; onTime(value: string): void; onAdd(): void }) {
  return <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}><View style={s.backdrop}><View style={s.modal}>
    <View style={s.modalHead}><Text style={s.modalTitle}>Add to itinerary</Text><Pressable onPress={props.onClose} style={s.closePlain}><Ionicons name="close" size={20} color="#59677D" /></Pressable></View>
    {props.tripLoading ? <ActivityIndicator color="#7397E8" /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tripChoices}>{props.tripOptions.map((trip) => <Pressable key={String(trip.id)} onPress={() => props.onTrip(String(trip.id))} style={[s.tripChoice, props.selectedTripId === String(trip.id) && s.tripChoiceOn]}><Text style={s.tripChoiceText}>{trip.name}</Text></Pressable>)}</ScrollView>}
    <View style={s.formRow}><View style={s.formFlex}><Text style={s.label}>Day</Text><TextInput value={String(props.selectedDay)} onChangeText={(value) => props.onDay(Math.max(1, Number(value) || 1))} keyboardType="number-pad" style={s.field} /></View><View style={s.formFlex}><Text style={s.label}>Time</Text><TextInput value={props.selectedTime} onChangeText={props.onTime} style={s.field} /></View></View>
    <PremiumBlueButton label="Add place" icon="add-circle-outline" loading={props.adding} disabled={!props.selectedTripId} onPress={props.onAdd} />
  </View></View></Modal>;
}

async function hydrateDiscover(items: DiscoverPlace[]) {
  const world: WorldPlaceResult[] = items.map((item) => ({ id: item.id, name: item.name, displayName: item.subtitle, city: item.city ?? null, country: item.country ?? null, latitude: item.latitude, longitude: item.longitude, category: item.category, imageUrl: item.imageUrl }));
  const hydrated = await hydratePlacePhotos(world);
  return hydrated.map((item, index) => ({ ...(items[index] ?? mapWorldPlace(item, inferCategory(item.category ?? ""), index, null)), imageUrl: item.imageUrl }));
}

function mapWorldPlace(item: WorldPlaceResult, category: Category, index: number, bias?: Coordinates | null): DiscoverPlace {
  return { id: item.id || `place-${index}`, name: item.name, subtitle: item.displayName, latitude: item.latitude, longitude: item.longitude, imageUrl: item.imageUrl || fallbackPlaceImage(category), rating: 0, distance: bias ? formatDistance(haversineKm(bias.latitude, bias.longitude, item.latitude, item.longitude)) : "Explore", category, city: item.city ?? null, country: item.country ?? null };
}
function inferCategory(value: string): Category { const text = value.toLowerCase(); if (text.includes("cafe") || text.includes("coffee")) return "Cafes"; if (text.includes("restaurant") || text.includes("food")) return "Food"; if (text.includes("shop") || text.includes("mall")) return "Shopping"; if (text.includes("hik") || text.includes("trail")) return "Hiking"; if (text.includes("work") || text.includes("office") || text.includes("library")) return "Work"; return "Parks"; }
function dedupePlaces(items: DiscoverPlace[]) { const seen = new Set<string>(); return items.filter((item) => { const key = `${item.name.toLowerCase()}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) { const r = 6371; const dLat = ((lat2 - lat1) * Math.PI) / 180; const dLon = ((lon2 - lon1) * Math.PI) / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2; return r * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); }
function formatDistance(km: number) { return km < 1 ? `${Math.max(10, Math.round(km * 1000 / 10) * 10)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`; }
function queueMicrotaskSafe(callback: () => void) { if (typeof queueMicrotask === "function") queueMicrotask(callback); else setTimeout(callback, 0); }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" }, scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 150 }, max: { width: "100%", maxWidth: 900, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, title: { color: "#07142E", fontSize: 46, lineHeight: 52, fontWeight: "900", letterSpacing: -1.4 },
  avatar: { width: 58, height: 58, borderRadius: 29, overflow: "visible", alignItems: "center", justifyContent: "center", backgroundColor: "#F4F7FB", borderWidth: 3, borderColor: "#FFFFFF", boxShadow: "0 8px 22px rgba(50,65,100,.14)" }, badge: { position: "absolute", right: -3, top: -4, minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F45E96", borderWidth: 2, borderColor: "#FFF" }, badgeText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  searchArea: { zIndex: 30 }, search: { minHeight: 76, borderRadius: 23, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E8F0", boxShadow: "0 10px 28px rgba(44,60,94,.08)" }, searchInput: { flex: 1, minWidth: 0, color: "#14203A", fontSize: 18, fontWeight: "600",}, mic: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFF", borderWidth: 1, borderColor: "#E6EBF4" },
  dropdown: { position: "absolute", left: 0, right: 0, top: 82, borderRadius: 22, padding: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E7F0", boxShadow: "0 18px 46px rgba(34,50,82,.16)", zIndex: 50, maxHeight: 460 }, dropdownScroll: { maxHeight: 360 }, dropdownHead: { minHeight: 34, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, dropdownTitle: { color: "#17223A", fontSize: 12, fontWeight: "900" }, done: { color: "#6E91DF", fontSize: 11, fontWeight: "900" },
  suggestion: { minHeight: 72, padding: 7, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 11 }, suggestionImage: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#EEF2F8" }, suggestionCopy: { flex: 1, minWidth: 0 }, suggestionName: { color: "#14203A", fontSize: 13, fontWeight: "900" }, suggestionAddress: { marginTop: 4, color: "#79859A", fontSize: 10, lineHeight: 14, fontWeight: "600" }, providerRow: { marginTop: 6, paddingHorizontal: 8, minHeight: 28, flexDirection: "row", alignItems: "center", gap: 5 }, provider: { color: "#93A0B4", fontSize: 8.5, fontWeight: "700" }, emptySearch: { padding: 14, color: "#8793A6", fontSize: 10, fontWeight: "600" },
  chips: { paddingTop: 18, paddingBottom: 18, gap: 10 }, chip: { minHeight: 54, paddingHorizontal: 21, borderRadius: 27, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E5ED", boxShadow: "0 7px 18px rgba(45,58,84,.05)" }, chipActive: { backgroundColor: "#F1F6FF", borderColor: "#BDD0F4" }, chipText: { color: "#202B41", fontSize: 13, fontWeight: "800" }, chipTextActive: { color: "#4F72C6" },
  mapWrap: { position: "relative", borderRadius: 30, overflow: "hidden" }, mapLoading: { position: "absolute", alignSelf: "center", top: "42%", minHeight: 42, paddingHorizontal: 14, borderRadius: 21, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,.94)", boxShadow: "0 9px 20px rgba(43,60,93,.10)" }, mapLoadingText: { color: "#60708A", fontSize: 9, fontWeight: "800" },
  cards: { paddingVertical: 26, gap: 14 }, placeCard: { overflow: "hidden", borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E8EF", boxShadow: "0 10px 26px rgba(40,55,85,.07)" }, placeCardSelected: { borderColor: "#B8CDF4", boxShadow: "0 12px 30px rgba(87,124,200,.13)" }, cardImageWrap: { height: 150, position: "relative", backgroundColor: "#E9EFF6" }, heart: { position: "absolute", top: 10, right: 10, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.94)" }, cardBody: { padding: 14 }, placeName: { color: "#121D34", fontSize: 17, fontWeight: "900" }, placeCategory: { marginTop: 5, color: "#7A68EA", fontSize: 10, fontWeight: "800" }, placeAddress: { marginTop: 5, color: "#7A869A", fontSize: 10, fontWeight: "600" }, placeMeta: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, mapListing: { color: "#D89A29", fontSize: 10, fontWeight: "800" }, distance: { color: "#7B879A", fontSize: 10, fontWeight: "700" },
  featured: { minHeight: 300, overflow: "hidden", borderRadius: 28, backgroundColor: "#F2F5F9", borderWidth: 1, borderColor: "#E3E8F0", boxShadow: "0 16px 36px rgba(42,58,88,.08)" }, featuredCopy: { width: "58%", minHeight: 300, padding: 28, justifyContent: "center" }, featuredTag: { alignSelf: "flex-start", paddingHorizontal: 10, minHeight: 28, borderRadius: 14, justifyContent: "center", backgroundColor: "#F0E9FF" }, featuredTagText: { color: "#7B5AE0", fontSize: 9.5, fontWeight: "900" }, featuredTitle: { marginTop: 17, color: "#111D34", fontSize: 27, fontWeight: "900", letterSpacing: -0.5 }, featuredMeta: { marginTop: 7, color: "#7057E2", fontSize: 11, fontWeight: "800" }, featuredDescription: { marginTop: 10, color: "#58677E", fontSize: 12, lineHeight: 18, fontWeight: "600" }, featuredButton: { marginTop: 18, width: 170, minHeight: 50, borderRadius: 25, paddingHorizontal: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#759CF5" }, featuredButtonText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  backdrop: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(13,20,36,.42)" }, modal: { width: "100%", maxWidth: 560, maxHeight: "88%", borderRadius: 28, padding: 20, backgroundColor: "#FFFFFF", boxShadow: "0 24px 70px rgba(25,35,58,.22)" }, modalImage: { height: 220, borderRadius: 22, overflow: "hidden", backgroundColor: "#EDF1F6" }, close: { position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.95)" }, closePlain: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F6FA" }, modalTitle: { marginTop: 18, color: "#13203A", fontSize: 24, fontWeight: "900" }, modalMeta: { marginTop: 6, color: "#7D65E7", fontSize: 11, fontWeight: "800" }, modalBody: { marginTop: 8, color: "#6A778B", fontSize: 11, lineHeight: 17, fontWeight: "600" }, modalActions: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 }, savePlace: { minWidth: 100, height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFF2F7" }, savePlaceText: { color: "#B9688B", fontSize: 10, fontWeight: "900" }, modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tripChoices: { paddingVertical: 16, gap: 8 }, tripChoice: { minHeight: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6FA" }, tripChoiceOn: { backgroundColor: "#EAF1FF" }, tripChoiceText: { color: "#4F607A", fontSize: 9.5, fontWeight: "900" }, formRow: { flexDirection: "row", gap: 10, marginBottom: 14 }, formFlex: { flex: 1 }, label: { marginBottom: 6, color: "#65728A", fontSize: 9, fontWeight: "900" }, field: { height: 48, borderRadius: 16, paddingHorizontal: 13, color: "#1A2942", backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#E2E7EF",}, pressed: { opacity: 0.72 },
});
