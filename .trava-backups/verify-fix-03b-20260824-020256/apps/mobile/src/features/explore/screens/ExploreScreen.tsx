import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TripSummary } from "@trava/shared";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { listTrips } from "@/features/trips/api/trips.api";
import { searchNearbyPlaces, searchWorldPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import { fallbackPlaceImage, resolveFreePlaceImage } from "@/features/maps/utils/place-photo";
import { useTravaPreferences } from "@/lib/trava-preferences";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import { DiscoverLoadingOverlay } from "../components/DiscoverLoadingOverlay";
import { LocationPermissionNotice } from "../components/LocationPermissionNotice";
import { addDiscoverPlaceToItinerary } from "../utils/add-place-to-itinerary";
import { readSavedPlaces, savePinnedPlace, writeSavedPlaces } from "../utils/discover-storage";

type Category = "Cafes" | "Food" | "Shopping" | "Hiking" | "Work" | "Parks";
type Coordinates = { latitude: number; longitude: number };
type ChipIcon = React.ComponentProps<typeof Ionicons>["name"];

const CATEGORIES: Array<{ name: Category; icon: ChipIcon; api: string }> = [
  { name: "Cafes", icon: "cafe-outline", api: "cafes" },
  { name: "Food", icon: "restaurant-outline", api: "food" },
  { name: "Shopping", icon: "bag-handle-outline", api: "shopping" },
  { name: "Hiking", icon: "trail-sign-outline", api: "hiking" },
  { name: "Work", icon: "briefcase-outline", api: "work" },
  { name: "Parks", icon: "leaf-outline", api: "parks" },
];

const IMAGES = {
  cafe: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=88",
  food: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=88",
  shop: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=88",
  park: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=88",
  city: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=88",
  night: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=1200&q=88",
};

export function ExploreScreen() {
  const router = useRouter();
  const { preferences, ready: preferencesReady } = useTravaPreferences();
  const { profile, user } = useAuth();
  const avatarUrl = profile?.avatar_url || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverPlace[]>([]);
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [tripOptions, setTripOptions] = useState<TripSummary[]>([]);
  const [tripLoading, setTripLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [adding, setAdding] = useState(false);
  const requestId = useRef(0);

  useEffect(() => { void readSavedPlaces().then(setSaved); }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    let mounted = true;

    if (!preferences.discoverLocation) {
      setLocationDenied(true);
      setUserCoords({ latitude: 10.3157, longitude: 123.8854 });
      return () => { mounted = false; };
    }

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (mounted) {
            setLocationDenied(true);
            setUserCoords({ latitude: 10.3157, longitude: 123.8854 });
          }
          return;
        }
        if (mounted) setLocationDenied(false);
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted) setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch {
        if (mounted) {
          setLocationDenied(true);
          setUserCoords({ latitude: 10.3157, longitude: 123.8854 });
        }
      }
    })();
    return () => { mounted = false; };
  }, [preferences.discoverLocation, preferencesReady]);

  useEffect(() => {
    if (!userCoords || places.length || query.trim()) return;
    let live = true;
    void (async () => {
      setCategoryLoading(true);
      try {
        const settled = await Promise.allSettled([
          searchNearbyPlaces("cafes", userCoords.latitude, userCoords.longitude, 5).then((items) => items.map((item, index) => mapWorldPlace(item, "Cafes", index, userCoords))),
          searchNearbyPlaces("food", userCoords.latitude, userCoords.longitude, 5).then((items) => items.map((item, index) => mapWorldPlace(item, "Food", index, userCoords))),
          searchNearbyPlaces("shopping", userCoords.latitude, userCoords.longitude, 4).then((items) => items.map((item, index) => mapWorldPlace(item, "Shopping", index, userCoords))),
          searchNearbyPlaces("parks", userCoords.latitude, userCoords.longitude, 4).then((items) => items.map((item, index) => mapWorldPlace(item, "Parks", index, userCoords))),
        ]);
        if (!live) return;
        const groups = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        const mixed = groups.flat().filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 16);
        if (mixed.length) { setPlaces(mixed); setSelectedId(mixed[0].id); setActiveCategory(null); }
      } finally { if (live) setCategoryLoading(false); }
    })();
    return () => { live = false; };
  }, [userCoords, places.length, query]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchWorldPlaces(text, userCoords, 12);
        if (id !== requestId.current) return;
        const mapped = result.map((item, index) => mapWorldPlace(item, inferCategory(text), index, userCoords));
        setSuggestions(mapped);
        if (preferences.placePhotos) void hydratePlacePhotos(mapped, setSuggestions);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 230);
    return () => clearTimeout(timer);
  }, [query, userCoords]);

  const selected = useMemo(() => places.find((place) => place.id === selectedId) ?? null, [places, selectedId]);
  const mapCenter = selected ? { latitude: selected.latitude, longitude: selected.longitude } : userCoords;

  async function loadTrips() {
    if (tripOptions.length || tripLoading) return;
    setTripLoading(true);
    try {
      const trips = await listTrips();
      const usable = trips.filter((trip) => trip.status !== "completed");
      setTripOptions(usable);
      setSelectedTripId((current) => current ?? usable[0]?.id ?? null);
    } catch {
      Alert.alert("Trips unavailable", "TRAVA could not load your trips. Make sure the API is running, then try again.");
    } finally {
      setTripLoading(false);
    }
  }

  async function chooseSearchResult(place: DiscoverPlace) {
    setQuery(place.name);
    setSearchOpen(false);
    setActiveCategory(null);
    setSelectedId(null);
    setPlaces(() => {
      const related = suggestions.filter((item) => item.id !== place.id);
      return [place, ...related].slice(0, 12);
    });
    requestAnimationFrameSafe(() => setSelectedId(place.id));
    if (preferences.placePhotos) void hydratePlacePhotos([place], (resolved) => {
      const image = resolved[0]?.imageUrl;
      if (!image) return;
      setPlaces((current) => current.map((item) => item.id === place.id ? { ...item, imageUrl: image } : item));
    });
  }

  async function chooseCategory(category: Category) {
    const next = activeCategory === category ? null : category;
    setActiveCategory(next);
    if (!next) return;
    const anchor = selected ?? (userCoords ? { latitude: userCoords.latitude, longitude: userCoords.longitude } : null);
    if (!anchor) {
      Alert.alert("Choose a location first", "Search Cebu, Manila, Tokyo, a hotel, landmark, or any place worldwide first. TRAVA will then find this category around it.");
      return;
    }
    setCategoryLoading(true);
    try {
      const apiCategory = CATEGORIES.find((item) => item.name === next)?.api ?? next.toLowerCase();
      const nearby = await searchNearbyPlaces(apiCategory, anchor.latitude, anchor.longitude, 18);
      const mapped = nearby.map((item, index) => mapWorldPlace(item, next, index, { latitude: anchor.latitude, longitude: anchor.longitude }));
      if (!mapped.length) {
        Alert.alert("No nearby results", `No ${next.toLowerCase()} were returned around this location. Try another category or a more specific search.`);
        return;
      }
      setPlaces(mapped);
      setSelectedId(mapped[0]?.id ?? null);
      setSearchOpen(false);
      if (preferences.placePhotos) void hydratePlacePhotos(mapped, setPlaces);
    } finally {
      setCategoryLoading(false);
    }
  }

  async function toggleSaved(place: DiscoverPlace) {
    setSaved((current) => {
      const next = current.includes(place.id) ? current.filter((item) => item !== place.id) : [...current, place.id];
      void writeSavedPlaces(next);
      if (!current.includes(place.id)) void savePinnedPlace(place);
      return next;
    });
  }

  async function openAddToItinerary() {
    if (!selected) return;
    setAddOpen(true);
    setSelectedDay(1);
    setSelectedTime("09:00");
    await loadTrips();
  }

  async function addToItinerary() {
    if (!selected) return;
    const trip = tripOptions.find((item) => item.id === selectedTripId);
    if (!trip) {
      Alert.alert("Choose a trip", "Select the trip where you want to add this place.");
      return;
    }
    setAdding(true);
    try {
      const result = await addDiscoverPlaceToItinerary({ trip, place: selected, dayNumber: selectedDay, startTime: selectedTime });
      setAddOpen(false);
      Alert.alert("Added to itinerary", `${selected.name} was added to ${trip.name}, Day ${selectedDay} at ${displayTime(selectedTime)}.${result.serverSynced ? "" : " It is saved locally and will remain available in the trip workspace."}`);
    } catch (error) {
      Alert.alert("Could not add place", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setAdding(false);
    }
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

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.max}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} style={styles.avatar}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="person" size={25} color="#17213A" />}
            <View style={styles.avatarBadge}><Text style={styles.avatarBadgeText}>3</Text></View>
          </Pressable>
        </View>

        <View style={styles.searchArea}>
          <View style={[styles.search, searchOpen && query.trim().length >= 2 && styles.searchFocused]}>
            <Ionicons name="search" size={29} color="#74819A" />
            <TextInput
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChangeText={(text) => { setQuery(text); setSearchOpen(true); }}
              placeholder="Search places, cafes, parks, landmarks…"
              placeholderTextColor="#8E9AB0"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {loading ? <ActivityIndicator size="small" color="#4F73FF" /> : <Pressable accessibilityLabel={query ? "Clear search" : "Voice search"} onPress={startVoiceSearch} style={styles.voiceButton}><Ionicons name={query ? "close" : "mic"} size={21} color="#3267FF" /></Pressable>}
          </View>
          {searchOpen && query.trim().length >= 2 ? <View style={styles.dropdown}>
            <View style={styles.dropdownHead}><Text style={styles.dropdownTitle}>Worldwide search</Text><Pressable onPress={() => setSearchOpen(false)}><Text style={styles.dropdownDone}>Done</Text></Pressable></View>
            {loading && !suggestions.length ? <View style={styles.dropdownLoading}><ActivityIndicator size="small" color="#4F73FF" /><Text style={styles.dropdownHint}>Searching real locations…</Text></View> : null}
            {!loading && !suggestions.length ? <Text style={styles.dropdownEmpty}>No exact match yet. Try a fuller name such as “SM City Cebu”, “Manila”, “Narita Airport”, or “cafes in Cebu”.</Text> : null}
            {suggestions.map((place) => <Pressable key={place.id} onPress={() => void chooseSearchResult(place)} style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}>
              <View style={styles.suggestionIcon}><Ionicons name={locationIcon(place.category)} size={18} color="#4B73D8" /></View>
              <View style={styles.suggestionCopy}><Text numberOfLines={1} style={styles.suggestionName}>{place.name}</Text><Text numberOfLines={2} style={styles.suggestionAddress}>{place.subtitle}</Text></View>
              <Ionicons name="navigate-outline" size={19} color="#8795AB" />
            </Pressable>)}
            <View style={styles.powered}><Ionicons name="map-outline" size={13} color="#95A1B5" /><Text style={styles.poweredText}>Worldwide OpenStreetMap / Photon search</Text></View>
          </View> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((item) => <Pressable key={item.name} disabled={categoryLoading} onPress={() => void chooseCategory(item.name)} style={[styles.chip, activeCategory === item.name && styles.chipOn]}><Ionicons name={item.icon} size={18} color={activeCategory === item.name ? "#2F63E9" : "#39465D"} /><Text style={[styles.chipText, activeCategory === item.name && styles.chipTextOn]}>{item.name}</Text></Pressable>)}
        </ScrollView>

        {locationDenied ? (
          <LocationPermissionNotice
            onOpenSettings={() => {
              if (Platform.OS === "web") setSearchOpen(true);
              else void Linking.openSettings();
            }}
            onSearchInstead={() => setSearchOpen(true)}
          />
        ) : null}

        <View style={styles.mapSection}>
          <DiscoverMap places={places} selectedId={selectedId} center={mapCenter} onSelect={setSelectedId} onMapPress={(coordinate) => { const pin: DiscoverPlace = { id: `pin-${coordinate.latitude.toFixed(5)}-${coordinate.longitude.toFixed(5)}`, name: "Pinned location", subtitle: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`, latitude: coordinate.latitude, longitude: coordinate.longitude, imageUrl: IMAGES.city, rating: 4.8, distance: "Pinned", category: "Pinned" }; setPlaces((current) => [pin, ...current.filter((item) => item.id !== pin.id)]); setSelectedId(pin.id); setSearchOpen(false); }} />
          {categoryLoading || !userCoords ? <DiscoverLoadingOverlay /> : null}
        </View>

        {/* Selection actions are intentionally folded into the cards/featured panel to match the iOS Discover reference. */}
        {places.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={264} contentContainerStyle={styles.cards}>
          {places.map((place) => <Pressable key={place.id} onPress={() => setSelectedId(place.id)} style={[styles.placeCard, selectedId === place.id && styles.placeCardSelected]}>
            <View style={styles.placeImageWrap}><Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /><Pressable accessibilityLabel={saved.includes(place.id) ? "Remove from saved" : "Save place"} onPress={(event) => { event.stopPropagation?.(); void toggleSaved(place); }} style={styles.heart}><Ionicons name={saved.includes(place.id) ? "heart" : "heart-outline"} size={22} color={saved.includes(place.id) ? "#FF4B78" : "#506079"} /></Pressable></View>
            <Text numberOfLines={1} style={styles.placeName}>{place.name}</Text>
            <Text style={styles.placeCategory}>{categoryLabel(place.category)}</Text>
            <Text numberOfLines={1} style={styles.placeAddress}>{place.subtitle}</Text>
            <View style={styles.placeBottom}>{place.rating > 0 ? <Text style={styles.placeRating}>★ <Text style={styles.placeRatingNumber}>{place.rating.toFixed(1)}</Text></Text> : <Text style={styles.placeRatingNumber}>Map listing</Text>}<Text style={styles.placeDistance}>{place.distance}</Text></View>
          </Pressable>)}
        </ScrollView> : null}

        {selected ? <View style={styles.featured}>
          <Image source={{ uri: selected.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(255,255,255,.99)", "rgba(255,255,255,.95)", "rgba(255,255,255,.60)", "rgba(255,255,255,.03)"]} locations={[0, .34, .62, 1]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={StyleSheet.absoluteFill} />
          <View style={styles.featuredCopy}>
            <View style={styles.featuredTag}><Ionicons name="sparkles-outline" size={13} color="#8D66F4"/><Text style={styles.featuredTagText}>Featured</Text></View>
            <Text style={styles.featuredTitle}>{selected.name}</Text>
            <Text style={styles.featuredMeta}>{categoryLabel(selected.category)}  ·  {selected.distance}</Text>
            <Text numberOfLines={2} style={styles.featuredDescription}>{selected.subtitle}</Text>
            <View style={styles.featuredActions}>
              <Pressable onPress={() => void openAddToItinerary()} style={styles.detailsPress}>
                <LinearGradient colors={["#3D6FFF", "#AE7AF6", "#FF78AE"]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={styles.detailsButton}>
                  <Text style={styles.detailsText}>View Details</Text><Ionicons name="chevron-forward" size={18} color="#FFF" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View> : null}
      </View>
    </ScrollView>

    <AddToItineraryModal
      visible={addOpen}
      place={selected}
      trips={tripOptions}
      loadingTrips={tripLoading}
      selectedTripId={selectedTripId}
      onSelectTrip={(id) => { setSelectedTripId(id); setSelectedDay(1); }}
      day={selectedDay}
      onDay={setSelectedDay}
      time={selectedTime}
      onTime={setSelectedTime}
      adding={adding}
      onClose={() => setAddOpen(false)}
      onAdd={() => void addToItinerary()}
    />
  </SafeAreaView>;
}

function AddToItineraryModal({ visible, place, trips, loadingTrips, selectedTripId, onSelectTrip, day, onDay, time, onTime, adding, onClose, onAdd }: {
  visible: boolean;
  place: DiscoverPlace | null;
  trips: TripSummary[];
  loadingTrips: boolean;
  selectedTripId: string | null;
  onSelectTrip(id: string): void;
  day: number;
  onDay(day: number): void;
  time: string;
  onTime(value: string): void;
  adding: boolean;
  onClose(): void;
  onAdd(): void;
}) {
  const trip = trips.find((item) => item.id === selectedTripId) ?? null;
  const dayCount = Math.max(1, Math.min(31, trip?.numberOfDays || 1));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}>
    <View style={styles.modalHead}><View><Text style={styles.modalTitle}>Add to itinerary</Text><Text numberOfLines={1} style={styles.modalSubtitle}>{place?.name ?? "Selected place"}</Text></View><Pressable onPress={onClose} style={styles.modalClose}><Ionicons name="close" size={22} color="#526079" /></Pressable></View>
    <Text style={styles.modalLabel}>Choose trip</Text>
    {loadingTrips ? <View style={styles.tripLoading}><ActivityIndicator color="#4F73FF" /><Text style={styles.tripLoadingText}>Loading your trips…</Text></View> : <ScrollView style={styles.tripList} contentContainerStyle={styles.tripListContent}>{trips.map((item) => <Pressable key={item.id} onPress={() => onSelectTrip(item.id)} style={[styles.tripRow, item.id === selectedTripId && styles.tripRowOn]}><View style={styles.tripIcon}><Ionicons name="airplane-outline" size={18} color="#456ED4" /></View><View style={styles.tripCopy}><Text style={styles.tripName}>{item.name}</Text><Text style={styles.tripMeta}>{item.destination} · {Math.max(1, item.numberOfDays)} days</Text></View>{item.id === selectedTripId ? <Ionicons name="checkmark-circle" size={23} color="#3F6FEF" /> : <Ionicons name="chevron-forward" size={18} color="#A5AFBF" />}</Pressable>)}</ScrollView>}
    {!loadingTrips && !trips.length ? <Text style={styles.noTrips}>No active trips were found. Create a trip first, then return here to add this place.</Text> : null}
    {trip ? <><Text style={styles.modalLabel}>Day</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayChoices}>{Array.from({ length: dayCount }, (_, index) => index + 1).map((value) => <Pressable key={value} onPress={() => onDay(value)} style={[styles.dayChoice, value === day && styles.dayChoiceOn]}><Text style={[styles.dayChoiceText, value === day && styles.dayChoiceTextOn]}>Day {value}</Text></Pressable>)}</ScrollView>
    <Text style={styles.modalLabel}>Time</Text><View style={styles.timeField}><Ionicons name="time-outline" size={20} color="#60718B" /><TextInput value={time} onChangeText={onTime} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} style={styles.timeInput} /><Text style={styles.timeHint}>24-hour time</Text></View></> : null}
    <View style={styles.modalActions}><Pressable onPress={onClose} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable><Pressable disabled={!trip || adding} onPress={onAdd} style={[styles.modalAddPress, (!trip || adding) && styles.modalAddDisabled]}><LinearGradient colors={["#4B74FF", "#9F82F4", "#F07FB3"]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={styles.modalAdd}>{adding ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="add" size={19} color="#FFF" /><Text style={styles.modalAddText}>Add place</Text></>}</LinearGradient></Pressable></View>
  </View></View></Modal>;
}

async function hydratePlacePhotos(
  items: DiscoverPlace[],
  apply: ((value: DiscoverPlace[]) => void) | React.Dispatch<React.SetStateAction<DiscoverPlace[]>>,
) {
  const resolved = await Promise.all(items.map(async (item) => {
    const imageUrl = await resolveFreePlaceImage({
      id: item.id,
      name: item.name,
      city: item.city ?? null,
      country: item.country ?? null,
      latitude: item.latitude,
      longitude: item.longitude,
      category: item.category,
      imageUrl: null,
    });
    return imageUrl ? { ...item, imageUrl } : item;
  }));
  (apply as (value: DiscoverPlace[]) => void)(resolved);
}

function requestAnimationFrameSafe(callback: () => void) {
  if (Platform.OS === "web" && typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function mapWorldPlace(item: WorldPlaceResult, category: Category, _index: number, origin?: Coordinates | null): DiscoverPlace {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.displayName,
    city: item.city,
    country: item.country,
    latitude: item.latitude,
    longitude: item.longitude,
    imageUrl: item.imageUrl || fallbackPlaceImage(category),
    rating: 0,
    distance: origin ? humanDistance(origin.latitude, origin.longitude, item.latitude, item.longitude) : "Map location",
    category,
  };
}

function inferCategory(text: string): Category {
  const q = text.toLowerCase();
  if (q.includes("cafe") || q.includes("coffee")) return "Cafes";
  if (q.includes("restaurant") || q.includes("food")) return "Food";
  if (q.includes("shop") || q.includes("mall") || q.includes("store")) return "Shopping";
  if (q.includes("park") || q.includes("garden")) return "Parks";
  if (q.includes("hike") || q.includes("trail") || q.includes("mountain")) return "Hiking";
  return "Work";
}


function categoryLabel(category: string) { return category === "Food" ? "Restaurant" : category === "Parks" ? "Park" : category === "Cafes" ? "Cafe" : category === "Pinned" ? "Pinned place" : category; }
function locationIcon(category: string) { if (category === "Cafes") return "cafe-outline"; if (category === "Food") return "restaurant-outline"; if (category === "Shopping") return "bag-outline"; if (category === "Parks" || category === "Hiking") return "leaf-outline"; return "location-outline"; }
function displayTime(value: string) { const [h = "9", m = "00"] = value.split(":"); const hour = Number(h); return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`; }
function humanDistance(lat1: number, lon1: number, lat2: number, lon2: number) { const rad = Math.PI / 180; const a = .5 - Math.cos((lat2 - lat1) * rad) / 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (1 - Math.cos((lon2 - lon1) * rad)) / 2; const km = 12742 * Math.asin(Math.sqrt(a)); return km < 1 ? `${Math.max(20, Math.round(km * 1000 / 10) * 10)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" }, scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 150 }, max: { width: "100%", maxWidth: 920, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }, title: { color: "#0E1934", fontSize: 58, lineHeight: 64, fontWeight: "900", letterSpacing: -2.1 }, avatar: { width: 62, height: 62, borderRadius: 31, overflow: "visible", backgroundColor: "#EEF1F6", borderWidth: 4, borderColor: "#FFF", boxShadow: "0 9px 23px rgba(36,48,76,.13)" }, avatarBadge: { position: "absolute", right: -4, top: -8, minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#FF4B78", borderWidth: 2, borderColor: "#FFF" }, avatarBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  searchArea: { position: "relative", zIndex: 100 }, search: { minHeight: 72, paddingHorizontal: 22, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E3E7EE", boxShadow: "0 11px 26px rgba(43,57,85,.07)" }, searchFocused: { borderColor: "#AFC8F6" }, searchInput: { flex: 1, minWidth: 0, minHeight: 68, color: "#17213B", fontSize: 17, fontWeight: "600" }, voiceButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F9FF", borderWidth: 1, borderColor: "#E8ECF4" },
  dropdown: { position: "absolute", top: 78, left: 0, right: 0, maxHeight: 420, overflow: "hidden", borderRadius: 22, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E1E6EE", boxShadow: "0 22px 46px rgba(34,48,78,.18)", zIndex: 200 }, dropdownHead: { minHeight: 43, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FAFBFD", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E9EDF3" }, dropdownTitle: { color: "#64738C", fontSize: 11, fontWeight: "900", letterSpacing: .3 }, dropdownDone: { color: "#3767E9", fontSize: 11, fontWeight: "900" }, dropdownLoading: { minHeight: 58, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 10 }, dropdownHint: { color: "#6E7C91", fontSize: 11, fontWeight: "700" }, dropdownEmpty: { padding: 16, color: "#748197", fontSize: 11, lineHeight: 17, fontWeight: "600" }, suggestion: { minHeight: 67, paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EDF0F5" }, suggestionPressed: { backgroundColor: "#F5F8FF" }, suggestionIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF4FF" }, suggestionCopy: { flex: 1, minWidth: 0 }, suggestionName: { color: "#17213B", fontSize: 12, fontWeight: "900" }, suggestionAddress: { marginTop: 3, color: "#79869A", fontSize: 9, lineHeight: 13, fontWeight: "600" }, powered: { minHeight: 34, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FAFBFD" }, poweredText: { color: "#98A3B4", fontSize: 8, fontWeight: "700" },
  chips: { gap: 12, paddingVertical: 20, paddingRight: 18 }, chip: { height: 52, paddingHorizontal: 18, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E2E6EC", boxShadow: "0 7px 18px rgba(36,50,78,.055)" }, chipOn: { backgroundColor: "#F6F8FF", borderColor: "#CCD6F6" }, chipText: { color: "#18223A", fontSize: 13, fontWeight: "800" }, chipTextOn: { color: "#2F63E9" },
  mapSection: { position: "relative" }, mapLoading: { position: "absolute", left: 18, top: 18, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,.96)", boxShadow: "0 8px 18px rgba(35,49,76,.10)" }, mapLoadingText: { color: "#50617B", fontSize: 10, fontWeight: "800" },
  selectedBar: { marginTop: 14, minHeight: 72, padding: 11, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E3E7EE", boxShadow: "0 10px 24px rgba(37,51,79,.07)" }, selectedCopy: { flex: 1, minWidth: 0, paddingLeft: 4 }, selectedName: { color: "#15213B", fontSize: 13, fontWeight: "900" }, selectedAddress: { marginTop: 4, color: "#78859A", fontSize: 9, fontWeight: "600" }, pinButton: { height: 46, paddingHorizontal: 13, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F6F8FB", borderWidth: 1, borderColor: "#E4E8EF" }, pinButtonOn: { backgroundColor: "#EEF4FF", borderColor: "#CCD9F8" }, pinButtonText: { color: "#51617A", fontSize: 10, fontWeight: "900" }, pinButtonTextOn: { color: "#2F63E9" }, addButton: { height: 46, paddingHorizontal: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#1F2A44" }, addButtonText: { color: "#FFF", fontSize: 10, fontWeight: "900" }, emptyPrompt: { marginTop: 14, minHeight: 58, paddingHorizontal: 16, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#E8EBF1" }, emptyPromptText: { flex: 1, color: "#718097", fontSize: 10, lineHeight: 15, fontWeight: "700" },
  cards: { gap: 14, paddingTop: 20, paddingRight: 42 }, placeCard: { width: 260, overflow: "hidden", borderRadius: 24, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E1E6ED", boxShadow: "0 12px 28px rgba(41,55,82,.085)" }, placeCardSelected: { borderColor: "#AFC6F7", boxShadow: "0 14px 30px rgba(67,101,178,.12)" }, placeImageWrap: { height: 162, position: "relative" }, heart: { position: "absolute", right: 11, top: 11, width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "rgba(226,230,237,.95)", boxShadow: "0 5px 13px rgba(30,45,73,.12)" }, placeName: { marginTop: 14, paddingHorizontal: 14, color: "#111A34", fontSize: 17, fontWeight: "900" }, placeCategory: { marginTop: 5, paddingHorizontal: 14, color: "#7658FF", fontSize: 12, fontWeight: "700" }, placeAddress: { marginTop: 7, paddingHorizontal: 14, color: "#77849A", fontSize: 11, fontWeight: "600" }, placeBottom: { marginTop: 13, paddingHorizontal: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, placeRating: { color: "#FFB800", fontSize: 13, fontWeight: "900" }, placeRatingNumber: { color: "#263550" }, placeDistance: { color: "#8190A7", fontSize: 11, fontWeight: "700" },
  featured: { height: 330, marginTop: 26, overflow: "hidden", borderRadius: 30, backgroundColor: "#EEF1F5", borderWidth: 1, borderColor: "#DFE4EB", boxShadow: "0 17px 38px rgba(39,54,83,.105)" }, featuredCopy: { width: "57%", height: "100%", padding: 30, justifyContent: "center" }, featuredTag: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F3E9FF" }, featuredTagText: { color: "#8D66F4", fontSize: 10, fontWeight: "900" }, featuredTitle: { marginTop: 15, color: "#111A34", fontSize: 30, lineHeight: 35, fontWeight: "900", letterSpacing: -.6 }, featuredMeta: { marginTop: 8, color: "#7C5BFF", fontSize: 12, fontWeight: "700" }, featuredDescription: { marginTop: 12, color: "#32405C", fontSize: 12, lineHeight: 18, fontWeight: "600" }, featuredActions: { marginTop: 16, flexDirection: "row", gap: 8, alignItems: "center" }, featuredSecondary: { height: 48, paddingHorizontal: 14, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(255,255,255,.93)", borderWidth: 1, borderColor: "#DCE4F2" }, featuredSecondaryText: { color: "#3658C8", fontSize: 11, fontWeight: "900" }, detailsPress: { width: 178 }, detailsButton: { height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, detailsText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(15,24,44,.42)" }, modalCard: { width: "100%", maxWidth: 540, maxHeight: "88%", padding: 20, borderRadius: 28, backgroundColor: "#FFF", borderWidth: 1, borderColor: "rgba(255,255,255,.8)", boxShadow: "0 28px 70px rgba(26,38,64,.22)" }, modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, modalTitle: { color: "#101A35", fontSize: 21, fontWeight: "900" }, modalSubtitle: { marginTop: 3, maxWidth: 380, color: "#758198", fontSize: 10, fontWeight: "700" }, modalClose: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F8FB", borderWidth: 1, borderColor: "#E6EAF0" }, modalLabel: { marginTop: 18, marginBottom: 8, color: "#526078", fontSize: 10, fontWeight: "900", letterSpacing: .25 }, tripLoading: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 9 }, tripLoadingText: { color: "#708099", fontSize: 10, fontWeight: "700" }, tripList: { maxHeight: 230 }, tripListContent: { gap: 8 }, tripRow: { minHeight: 64, padding: 10, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#E8EBF1" }, tripRowOn: { backgroundColor: "#F4F7FF", borderColor: "#BCD0FA" }, tripIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF4FF" }, tripCopy: { flex: 1, minWidth: 0 }, tripName: { color: "#17213B", fontSize: 11, fontWeight: "900" }, tripMeta: { marginTop: 3, color: "#7D899C", fontSize: 9, fontWeight: "600" }, noTrips: { paddingVertical: 14, color: "#7A879B", fontSize: 10, lineHeight: 15, fontWeight: "600" }, dayChoices: { gap: 8, paddingRight: 10 }, dayChoice: { height: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F8FB", borderWidth: 1, borderColor: "#E4E8EF" }, dayChoiceOn: { backgroundColor: "#EEF4FF", borderColor: "#AFC6F7" }, dayChoiceText: { color: "#65738A", fontSize: 10, fontWeight: "900" }, dayChoiceTextOn: { color: "#2F63E9" }, timeField: { height: 52, paddingHorizontal: 13, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#E5E9F0" }, timeInput: { width: 74, color: "#17213B", fontSize: 13, fontWeight: "900" }, timeHint: { color: "#8A96A8", fontSize: 9, fontWeight: "700" }, modalActions: { marginTop: 20, flexDirection: "row", gap: 10 }, modalCancel: { flex: 1, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF1F5" }, modalCancelText: { color: "#65738A", fontSize: 11, fontWeight: "900" }, modalAddPress: { flex: 1.6 }, modalAddDisabled: { opacity: .45 }, modalAdd: { height: 52, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, modalAddText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
});
