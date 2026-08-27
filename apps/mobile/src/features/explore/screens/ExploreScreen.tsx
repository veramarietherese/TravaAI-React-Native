import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { useAuth } from "@/features/auth/hooks/useAuth";
import { searchNearbyPlaces, searchWorldPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import { listTrips } from "@/features/trips/api/trips.api";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import {
  CATEGORY_FALLBACK_IMAGES,
  CEBU_CENTER,
  CURATED_CEBU_PICKS,
  DEMO_AGENCIES,
  DEMO_PACKAGES,
  EXPLORE_CATEGORIES,
  exploreCategoryIcon,
  humanDistance,
  inferExploreCategory,
  ratingCount,
  type DemoAgency,
  type DemoPackage,
  type ExploreCategory,
} from "../data/explore-catalog";
import { addDiscoverPlaceToItinerary } from "../utils/add-place-to-itinerary";
import { readSavedPlaces, savePinnedPlace, writeSavedPlaces } from "../utils/discover-storage";

const PARTNER_BANNER = require("../../../assets/images/trava-dreamfly-banner.png");

type Coordinates = { latitude: number; longitude: number };
type DetailItem = { kind: "package"; item: DemoPackage } | { kind: "agency"; item: DemoAgency } | null;

export function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focusId?: string }>();
  const { width } = useWindowDimensions();
  const { profile, user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const mapY = useRef(0);
  const requestId = useRef(0);

  const avatarUrl = profile?.avatar_url || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<DiscoverPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ExploreCategory>("Attractions");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [places, setPlaces] = useState<DiscoverPlace[]>(CURATED_CEBU_PICKS);
  const [selectedId, setSelectedId] = useState(CURATED_CEBU_PICKS[0].id);
  const [userCoords, setUserCoords] = useState<Coordinates>(CEBU_CENTER);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [detail, setDetail] = useState<DetailItem>(null);

  const [addPlace, setAddPlace] = useState<DiscoverPlace | null>(null);
  const [tripOptions, setTripOptions] = useState<TripSummary[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [tripLoading, setTripLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const contentPadding = width < 390 ? 14 : width < 720 ? 18 : 24;
  const placeCardWidth = Math.min(224, Math.max(186, width - contentPadding * 2 - 64));
  const packageWidth = Math.min(258, Math.max(214, width - contentPadding * 2 - 48));
  const agencyWidth = Math.min(274, Math.max(224, width - contentPadding * 2 - 42));

  useEffect(() => { void readSavedPlaces().then(setSaved); }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted) setUserCoords({ latitude: result.coords.latitude, longitude: result.coords.longitude });
      } catch {
        // Deterministic Cebu default remains available.
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const focusId = typeof params.focusId === "string" ? params.focusId : null;
    if (!focusId) return;
    const curated = CURATED_CEBU_PICKS.find((place) => place.id === focusId);
    if (!curated) return;
    setPlaces((current) => current.some((place) => place.id === curated.id) ? current : [curated, ...current]);
    setSelectedId(curated.id);
    requestAnimationFrame(() => scrollToMap(true));
  }, [params.focusId]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setRemoteSuggestions([]);
      setSearching(false);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchWorldPlaces(text, userCoords, 10);
        if (id !== requestId.current) return;
        setRemoteSuggestions(result.map((item, index) => mapWorldPlace(item, inferExploreCategory(text), index, userCoords)));
      } catch {
        if (id === requestId.current) setRemoteSuggestions([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, userCoords]);

  const localSuggestions = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return CURATED_CEBU_PICKS.slice(0, 5);
    return CURATED_CEBU_PICKS.filter((place) => `${place.name} ${place.subtitle} ${place.category}`.toLowerCase().includes(text)).slice(0, 6);
  }, [query]);

  const dropdownSuggestions = useMemo(() => {
    const all = [...localSuggestions, ...remoteSuggestions];
    return all.filter((place, index) => all.findIndex((candidate) => candidate.id === place.id) === index).slice(0, 10);
  }, [localSuggestions, remoteSuggestions]);

  const selected = useMemo(() => places.find((place) => place.id === selectedId) ?? null, [places, selectedId]);
  const visiblePlaces = useMemo(() => {
    const base = activeCategory === "Attractions" && !categoryLoading ? CURATED_CEBU_PICKS : places;
    return (savedOnly ? base.filter((place) => saved.includes(place.id)) : base).slice(0, 6);
  }, [activeCategory, categoryLoading, places, saved, savedOnly]);

  function scrollToMap(animated = true) {
    scrollRef.current?.scrollTo({ y: Math.max(0, mapY.current - 84), animated });
  }

  function chooseSearch(place: DiscoverPlace) {
    setQuery(place.name);
    setSearchOpen(false);
    setPlaces((current) => [place, ...current.filter((item) => item.id !== place.id)]);
    setSelectedId(place.id);
    requestAnimationFrame(() => scrollToMap(true));
  }

  async function chooseCategory(category: ExploreCategory) {
    setActiveCategory(category);
    setSearchOpen(false);
    setQuery("");
    if (category === "Attractions") {
      setPlaces(CURATED_CEBU_PICKS);
      setSelectedId(CURATED_CEBU_PICKS[0].id);
      return;
    }

    const anchor = selected ? { latitude: selected.latitude, longitude: selected.longitude } : userCoords;
    const api = EXPLORE_CATEGORIES.find((item) => item.name === category)?.api ?? category.toLowerCase();
    setCategoryLoading(true);
    try {
      const result = await searchNearbyPlaces(api, anchor.latitude, anchor.longitude, 14);
      const mapped = result.map((item, index) => mapWorldPlace(item, category, index, anchor));
      if (!mapped.length) {
        Alert.alert("No nearby results", `No ${category.toLowerCase()} were returned for this map area.`);
        return;
      }
      setPlaces(mapped);
      setSelectedId(mapped[0].id);
    } catch {
      Alert.alert("Explore unavailable", "TRAVA could not load nearby places right now. Your curated Cebu picks are still available.");
    } finally {
      setCategoryLoading(false);
    }
  }

  function focusMap(place: DiscoverPlace) {
    setPlaces((current) => current.some((item) => item.id === place.id) ? current : [place, ...current]);
    setSelectedId(place.id);
    requestAnimationFrame(() => scrollToMap(true));
  }

  function openAll(section: "picks" | "packages" | "agencies") {
    const suffix = section === "picks" ? `&category=${encodeURIComponent(activeCategory)}` : "";
    router.push(`/explore/all?section=${section}${suffix}` as Href);
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
      const trips = (await listTrips()).filter((trip) => trip.status !== "completed");
      setTripOptions(trips);
      setSelectedTripId((current) => current ?? trips[0]?.id ?? null);
    } catch {
      Alert.alert("Trips unavailable", "TRAVA could not load your trips.");
    } finally {
      setTripLoading(false);
    }
  }

  async function openAdd(place: DiscoverPlace) {
    setAddPlace(place);
    setSelectedDay(1);
    setSelectedTime("09:00");
    await loadTrips();
  }

  async function addToItinerary() {
    if (!addPlace) return;
    const trip = tripOptions.find((item) => item.id === selectedTripId);
    if (!trip) {
      Alert.alert("Choose a trip", "Select a trip first.");
      return;
    }

    setAdding(true);
    try {
      const result = await addDiscoverPlaceToItinerary({ trip, place: addPlace, dayNumber: selectedDay, startTime: selectedTime });
      setAddPlace(null);
      Alert.alert("Added to itinerary", `${addPlace.name} was added to ${trip.name}, Day ${selectedDay} at ${displayTime(selectedTime)}.${result.serverSynced ? "" : " Saved locally for this workspace."}`);
    } catch (error) {
      Alert.alert("Could not add place", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setAdding(false);
    }
  }

  function startVoiceSearch() {
    if (query) {
      setQuery("");
      setSearchOpen(true);
      return;
    }
    if (Platform.OS !== "web") {
      Alert.alert("Voice search", "Voice search is available in supported browsers in this build.");
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null; onerror: (() => void) | null; start(): void };
      webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null; onerror: (() => void) | null; start(): void };
    };
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      Alert.alert("Voice search", "Voice search is not supported by this browser.");
      return;
    }
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setQuery(transcript);
        setSearchOpen(true);
      }
    };
    recognition.onerror = () => Alert.alert("Voice search", "TRAVA could not hear that. Try again.");
    recognition.start();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={["#FBFCFF", "#FFF9FD", "#F9FBFF"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingHorizontal: contentPadding }]}>
        <View style={styles.max}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Explore places for your trip</Text>
              <Text style={styles.subtitle}>Find amazing places and experiences to add to your itinerary.</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} style={styles.avatar}>
                {avatarUrl ? <Image source={{ uri: avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="person" size={21} color="#34405A" />}
              </Pressable>
              <Pressable accessibilityLabel={savedOnly ? "Show all places" : "Show saved places"} onPress={() => setSavedOnly((value) => !value)} style={[styles.filterButton, savedOnly && styles.filterButtonOn]}>
                <Ionicons name={savedOnly ? "heart" : "options-outline"} size={20} color={savedOnly ? "#8066DB" : "#4A566C"} />
              </Pressable>
            </View>
          </View>

          <View style={styles.searchArea}>
            <View style={[styles.search, searchOpen && styles.searchFocused]}>
              <Ionicons name="search-outline" size={21} color="#7D88A0" />
              <TextInput
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChangeText={(text) => { setQuery(text); setSearchOpen(true); }}
                onSubmitEditing={() => dropdownSuggestions[0] && chooseSearch(dropdownSuggestions[0])}
                placeholder="Search places, activities, restaurants..."
                placeholderTextColor="#929CB0"
                returnKeyType="search"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {searching ? <ActivityIndicator size="small" color="#8066DB" /> : <Pressable onPress={startVoiceSearch} style={styles.voiceButton}><Ionicons name={query ? "close" : "mic-outline"} size={18} color="#8066DB" /></Pressable>}
            </View>

            {searchOpen ? (
              <View style={styles.dropdown}>
                <View style={styles.dropdownHead}><Text style={styles.dropdownTitle}>{query.trim().length ? "Suggested places" : "Popular in Cebu"}</Text><Pressable onPress={() => setSearchOpen(false)}><Text style={styles.dropdownDone}>Done</Text></Pressable></View>
                {dropdownSuggestions.length ? dropdownSuggestions.map((place) => (
                  <Pressable key={place.id} onPress={() => chooseSearch(place)} style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}>
                    <View style={styles.searchThumb}><Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /></View>
                    <View style={styles.searchResultCopy}><Text numberOfLines={1} style={styles.searchResultName}>{place.name}</Text><Text numberOfLines={1} style={styles.searchResultAddress}>{place.subtitle}</Text></View>
                    <Ionicons name="navigate-outline" size={18} color="#8A95A9" />
                  </Pressable>
                )) : <Text style={styles.dropdownEmpty}>{searching ? "Searching real places…" : "No matches yet. Try a city, landmark, café or activity."}</Text>}
              </View>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            {EXPLORE_CATEGORIES.map((item) => {
              const active = activeCategory === item.name;
              return <Pressable key={item.name} disabled={categoryLoading} onPress={() => void chooseCategory(item.name)} style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipOn, pressed && styles.pressed]}><Ionicons name={item.icon} size={15} color={active ? "#FFFFFF" : "#5A657A"} /><Text style={[styles.categoryText, active && styles.categoryTextOn]}>{item.name}</Text></Pressable>;
            })}
          </ScrollView>

          <View onLayout={(event) => { mapY.current = event.nativeEvent.layout.y; }} style={styles.mapWrap}>
            <DiscoverMap
              places={places}
              selectedId={selectedId}
              center={selected ? { latitude: selected.latitude, longitude: selected.longitude } : CEBU_CENTER}
              onSelect={setSelectedId}
              onMapPress={(coordinate) => {
                const pin: DiscoverPlace = { id: `pin-${coordinate.latitude.toFixed(5)}-${coordinate.longitude.toFixed(5)}`, name: "Pinned location", subtitle: `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`, latitude: coordinate.latitude, longitude: coordinate.longitude, imageUrl: CATEGORY_FALLBACK_IMAGES["Hidden Gems"], rating: 4.8, distance: "Pinned", category: "Hidden Gems" };
                setPlaces((current) => [pin, ...current.filter((place) => place.id !== pin.id)]);
                setSelectedId(pin.id);
              }}
            />
            {categoryLoading ? <View style={styles.mapLoading}><ActivityIndicator color="#8066DB" /><Text style={styles.mapLoadingText}>Finding real {activeCategory.toLowerCase()} nearby…</Text></View> : null}
          </View>

          <SectionHeader title="TRAVA AI PICKS FOR YOU" sub="Real places on the map, ready to add to your itinerary." onViewAll={() => openAll("picks")} />
          {visiblePlaces.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>{visiblePlaces.map((place) => <PlaceCard key={place.id} place={place} width={placeCardWidth} saved={saved.includes(place.id)} onOpen={() => focusMap(place)} onSave={() => void toggleSaved(place)} onAdd={() => void openAdd(place)} />)}</ScrollView> : <View style={styles.empty}><Ionicons name="heart-outline" size={24} color="#8A70DF" /><Text style={styles.emptyTitle}>No saved picks yet</Text><Text style={styles.emptyText}>Save a place and it will appear here.</Text></View>}

          <SectionHeader title="EXPERIENCES & TOUR PACKAGES" sub="Preview catalog — real agency inventory can replace these cards later." onViewAll={() => openAll("packages")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>{DEMO_PACKAGES.slice(0, 4).map((item) => <PackageCard key={item.id} item={item} width={packageWidth} onOpen={() => setDetail({ kind: "package", item })} />)}</ScrollView>

          <SectionHeader title="TRAVEL AGENCIES" sub="Varied partner previews with different specialties and destinations." onViewAll={() => openAll("agencies")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>{DEMO_AGENCIES.slice(0, 4).map((item) => <AgencyCard key={item.id} item={item} width={agencyWidth} onOpen={() => setDetail({ kind: "agency", item })} />)}</ScrollView>

          <Pressable onPress={() => setDetail({ kind: "agency", item: DEMO_AGENCIES[0] })} style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
            <Image source={PARTNER_BANNER} contentFit="cover" style={StyleSheet.absoluteFill} />
          </Pressable>
        </View>
      </ScrollView>

      <AddModal visible={Boolean(addPlace)} place={addPlace} trips={tripOptions} tripLoading={tripLoading} selectedTripId={selectedTripId} onTrip={setSelectedTripId} day={selectedDay} onDay={setSelectedDay} time={selectedTime} onTime={setSelectedTime} adding={adding} onClose={() => setAddPlace(null)} onAdd={() => void addToItinerary()} />
      <DetailModal value={detail} onClose={() => setDetail(null)} />
    </SafeAreaView>
  );
}

function SectionHeader({ title, sub, onViewAll }: { title: string; sub: string; onViewAll(): void }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSub}>{sub}</Text></View><Pressable onPress={onViewAll} style={styles.viewAll}><Text style={styles.viewAllText}>View all</Text><Ionicons name="chevron-forward" size={13} color="#8062E1" /></Pressable></View>;
}

function PlaceCard({ place, width, saved, onOpen, onSave, onAdd }: { place: DiscoverPlace; width: number; saved: boolean; onOpen(): void; onSave(): void; onAdd(): void }) {
  return <View style={[styles.placeCard, { width }]}><Pressable onPress={onOpen} style={styles.placeImage}><Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /></Pressable><Pressable onPress={onSave} style={styles.heart}><Ionicons name={saved ? "heart" : "heart-outline"} size={17} color={saved ? "#F06A91" : "#445169"} /></Pressable><Pressable onPress={onOpen} style={styles.placeCopy}><Text numberOfLines={1} style={styles.placeName}>{place.name}</Text><View style={styles.rating}><Text style={styles.ratingStar}>★ {place.rating.toFixed(1)}</Text><Text style={styles.ratingCount}>({ratingCount(place.id)})</Text></View><View style={styles.meta}><Ionicons name="location-outline" size={12} color="#8490A4" /><Text numberOfLines={1} style={styles.metaText}>{place.distance}</Text></View><View style={styles.meta}><Ionicons name={exploreCategoryIcon(place.category)} size={12} color="#8490A4" /><Text numberOfLines={1} style={styles.metaText}>{place.category}</Text></View></Pressable><Pressable onPress={onAdd} style={styles.add}><Ionicons name="add" size={14} color="#7559D9" /><Text style={styles.addText}>Add to itinerary</Text></Pressable></View>;
}

function PackageCard({ item, width, onOpen }: { item: DemoPackage; width: number; onOpen(): void }) {
  return <View style={[styles.packageCard, { width }]}><Pressable onPress={onOpen} style={styles.packageImage}><Image source={{ uri: item.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /></Pressable><View style={styles.packageCopy}><Text numberOfLines={1} style={styles.packageTitle}>{item.title}</Text><Text style={styles.packagePrice}>{item.price} <Text style={styles.per}>/ person</Text></Text><View style={styles.meta}><Ionicons name="location-outline" size={12} color="#8490A4" /><Text style={styles.metaText}>{item.destination}</Text></View><View style={styles.meta}><Ionicons name="time-outline" size={12} color="#8490A4" /><Text style={styles.metaText}>{item.duration}</Text></View><Text style={styles.agencyTag}>✦ {item.agency}</Text></View><Pressable onPress={onOpen} style={styles.packageButton}><Text style={styles.packageButtonText}>View Package</Text></Pressable></View>;
}

function AgencyCard({ item, width, onOpen }: { item: DemoAgency; width: number; onOpen(): void }) {
  return <View style={[styles.agencyCard, { width }]}><View style={styles.agencyImage}><Image source={{ uri: item.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /><LinearGradient colors={["transparent", "rgba(25,35,57,.38)"]} style={StyleSheet.absoluteFillObject} /><View style={styles.agencyAvatar}><Text style={styles.agencyAvatarText}>{item.initials}</Text></View></View><View style={styles.agencyCopy}><View style={styles.agencyHead}><Text numberOfLines={1} style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyRating}>★ {item.rating}</Text></View><Text numberOfLines={2} style={styles.agencyDesc}>{item.tagline}</Text><View style={styles.meta}><Ionicons name="compass-outline" size={12} color="#8490A4" /><Text numberOfLines={1} style={styles.metaText}>{item.specialty}</Text></View></View><Pressable onPress={onOpen} style={styles.packageButton}><Text style={styles.packageButtonText}>View Agency</Text><Ionicons name="arrow-forward" size={12} color="#7056D0" /></Pressable></View>;
}

function AddModal({ visible, place, trips, tripLoading, selectedTripId, onTrip, day, onDay, time, onTime, adding, onClose, onAdd }: { visible: boolean; place: DiscoverPlace | null; trips: TripSummary[]; tripLoading: boolean; selectedTripId: string | null; onTrip(id: string): void; day: number; onDay(day: number): void; time: string; onTime(value: string): void; adding: boolean; onClose(): void; onAdd(): void }) {
  const trip = trips.find((item) => item.id === selectedTripId) ?? null;
  const days = Math.max(1, Math.min(31, trip?.numberOfDays || 1));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHead}><View style={styles.modalHeadCopy}><Text style={styles.modalTitle}>Add to itinerary</Text><Text numberOfLines={1} style={styles.modalSub}>{place?.name}</Text></View><Pressable onPress={onClose} style={styles.modalClose}><Ionicons name="close" size={20} color="#526079" /></Pressable></View><Text style={styles.modalLabel}>CHOOSE TRIP</Text>{tripLoading ? <ActivityIndicator color="#8066DB" /> : <ScrollView style={styles.tripList}>{trips.map((item) => <Pressable key={item.id} onPress={() => onTrip(item.id)} style={[styles.tripRow, item.id === selectedTripId && styles.tripRowOn]}><View style={styles.tripIcon}><Ionicons name="airplane-outline" size={17} color="#765DDD" /></View><View style={styles.tripCopy}><Text style={styles.tripName}>{item.name}</Text><Text style={styles.tripMeta}>{item.destination}</Text></View><Ionicons name={item.id === selectedTripId ? "checkmark-circle" : "chevron-forward"} size={20} color={item.id === selectedTripId ? "#765DDD" : "#A2ACBC"} /></Pressable>)}</ScrollView>}{trip ? <><Text style={styles.modalLabel}>DAY</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTrack}>{Array.from({ length: days }, (_, index) => index + 1).map((value) => <Pressable key={value} onPress={() => onDay(value)} style={[styles.dayButton, value === day && styles.dayButtonOn]}><Text style={[styles.dayText, value === day && styles.dayTextOn]}>Day {value}</Text></Pressable>)}</ScrollView><Text style={styles.modalLabel}>TIME</Text><View style={styles.timeField}><Ionicons name="time-outline" size={18} color="#69758C" /><TextInput value={time} onChangeText={onTime} maxLength={5} keyboardType="numbers-and-punctuation" style={styles.timeInput} /><Text style={styles.timeHint}>24-hour</Text></View></> : null}<View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={!trip || adding} onPress={onAdd} style={[styles.addModalPress, (!trip || adding) && { opacity: .55 }]}><LinearGradient colors={["#9D89EA", "#91B5F6", "#F1B0CF"]} style={styles.addModal}>{adding ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.addModalText}>Add place</Text></>}</LinearGradient></Pressable></View></View></View></Modal>;
}

function DetailModal({ value, onClose }: { value: DetailItem; onClose(): void }) {
  if (!value) return null;
  const isPackage = value.kind === "package";
  const item = value.item;
  const title = isPackage ? (item as DemoPackage).title : (item as DemoAgency).name;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.detailCard}><View style={styles.detailHero}><Image source={{ uri: item.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /><LinearGradient colors={["transparent", "rgba(20,29,48,.58)"]} style={StyleSheet.absoluteFillObject} /><Pressable onPress={onClose} style={styles.detailClose}><Ionicons name="close" size={20} color="#29344C" /></Pressable><Text style={styles.detailTitle}>{title}</Text></View><View style={styles.detailBody}><Text style={styles.detailEyebrow}>{isPackage ? "TOUR PACKAGE PREVIEW" : "TRAVEL AGENCY PREVIEW"}</Text><Text style={styles.detailText}>{isPackage ? `${(item as DemoPackage).destination} · ${(item as DemoPackage).duration} · ${(item as DemoPackage).category}` : (item as DemoAgency).tagline}</Text><Text style={styles.detailStrong}>{isPackage ? `${(item as DemoPackage).price} / person` : `★ ${(item as DemoAgency).rating} · ${(item as DemoAgency).specialty}`}</Text><Text style={styles.detailMuted}>This is intentionally placeholder marketplace data. Replace it with real agency inventory when the provider backend is connected.</Text><Pressable onPress={onClose} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable></View></View></View></Modal>;
}

function mapWorldPlace(item: WorldPlaceResult, category: ExploreCategory, index: number, origin?: Coordinates | null): DiscoverPlace {
  return { id: item.id, name: item.name, subtitle: item.displayName, city: item.city, country: item.country, latitude: item.latitude, longitude: item.longitude, imageUrl: CATEGORY_FALLBACK_IMAGES[category], rating: Math.min(4.9, 4.5 + (index % 4) * .1), distance: origin ? humanDistance(origin.latitude, origin.longitude, item.latitude, item.longitude) : "Map location", category };
}

function displayTime(value: string) { const [h = "9", m = "00"] = value.split(":"); const hour = Number(h); return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FBFCFF"},scroll:{paddingTop:14,paddingBottom:148},max:{width:"100%",maxWidth:1180,alignSelf:"center"},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:18,paddingTop:8,paddingBottom:18},headerCopy:{flex:1,minWidth:0},title:{color:"#131B37",fontSize:29,lineHeight:35,fontWeight:"900",letterSpacing:-.85},subtitle:{marginTop:4,color:"#7A859C",fontSize:10.5,lineHeight:15,fontWeight:"600"},headerActions:{flexDirection:"row",alignItems:"center",gap:9},avatar:{width:44,height:44,borderRadius:22,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#F2F4FA",borderWidth:1,borderColor:"#E5E8F0"},filterButton:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.95)",borderWidth:1,borderColor:"#E5E8F0"},filterButtonOn:{backgroundColor:"#F2EEFF",borderColor:"#DDD3F7"},searchArea:{zIndex:80},search:{minHeight:55,flexDirection:"row",alignItems:"center",gap:10,paddingLeft:16,paddingRight:8,borderRadius:18,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E8EAF1",boxShadow:"0 10px 24px rgba(52,62,89,.07)"},searchFocused:{borderColor:"#D6CDF4"},searchInput:{flex:1,minWidth:0,height:52,color:"#202A45",fontSize:12,fontWeight:"600"},voiceButton:{width:38,height:38,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F1FF"},dropdown:{position:"absolute",left:0,right:0,top:62,maxHeight:410,padding:8,borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E6E9F0",zIndex:100,boxShadow:"0 18px 38px rgba(42,52,78,.16)"},dropdownHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:7,paddingVertical:7},dropdownTitle:{color:"#263049",fontSize:10,fontWeight:"900"},dropdownDone:{color:"#8062E0",fontSize:9,fontWeight:"900"},dropdownEmpty:{padding:12,color:"#8A95A8",fontSize:9.5,lineHeight:14,fontWeight:"600"},searchResult:{minHeight:58,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:7,borderRadius:14},searchThumb:{width:42,height:42,borderRadius:12,overflow:"hidden",backgroundColor:"#E9EDF5"},searchResultCopy:{flex:1,minWidth:0},searchResultName:{color:"#25304A",fontSize:10.5,fontWeight:"900"},searchResultAddress:{marginTop:3,color:"#8B95A7",fontSize:8.2,fontWeight:"600"},categories:{gap:8,paddingTop:13,paddingBottom:16},categoryChip:{minHeight:35,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:13,borderRadius:18,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E6E9EF"},categoryChipOn:{backgroundColor:"#9C88E5",borderColor:"#9C88E5",boxShadow:"0 7px 15px rgba(113,87,200,.17)"},categoryText:{color:"#4E596F",fontSize:9.2,fontWeight:"800"},categoryTextOn:{color:"#FFFFFF"},mapWrap:{position:"relative",width:"100%"},mapLoading:{position:"absolute",left:13,bottom:13,minHeight:39,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,borderRadius:14,backgroundColor:"rgba(255,255,255,.96)"},mapLoadingText:{color:"#606B80",fontSize:8.5,fontWeight:"700"},sectionHeader:{marginTop:25,marginBottom:10,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",gap:10},sectionCopy:{flex:1,minWidth:0},sectionTitle:{color:"#8062E0",fontSize:10.5,lineHeight:14,fontWeight:"900",letterSpacing:.65},sectionSub:{marginTop:3,color:"#8C96A8",fontSize:8.3,lineHeight:12,fontWeight:"600"},viewAll:{minHeight:30,flexDirection:"row",alignItems:"center",gap:3,paddingHorizontal:5},viewAllText:{color:"#8062E1",fontSize:9,fontWeight:"900"},track:{gap:10,paddingRight:8,paddingBottom:7},placeCard:{overflow:"hidden",borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E6E8EF",boxShadow:"0 10px 24px rgba(49,58,82,.08)"},placeImage:{height:118,overflow:"hidden",backgroundColor:"#E8EEF6"},heart:{position:"absolute",top:8,right:8,width:31,height:31,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.92)"},placeCopy:{paddingHorizontal:11,paddingTop:9},placeName:{color:"#202A43",fontSize:10.6,fontWeight:"900"},rating:{marginTop:5,flexDirection:"row",gap:3},ratingStar:{color:"#E3A330",fontSize:8.2,fontWeight:"900"},ratingCount:{color:"#98A1B1",fontSize:7.5,fontWeight:"700"},meta:{marginTop:5,flexDirection:"row",alignItems:"center",gap:4},metaText:{flex:1,minWidth:0,color:"#7F8A9F",fontSize:7.7,fontWeight:"600"},add:{minHeight:32,margin:10,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4,borderRadius:14,backgroundColor:"#F5F1FF",borderWidth:1,borderColor:"#E2D8F7"},addText:{color:"#7559D9",fontSize:8.2,fontWeight:"900"},empty:{minHeight:115,alignItems:"center",justifyContent:"center",borderRadius:20,backgroundColor:"rgba(255,255,255,.84)",borderWidth:1,borderColor:"#E9E7F0"},emptyTitle:{marginTop:6,color:"#29334B",fontSize:10.5,fontWeight:"900"},emptyText:{marginTop:3,color:"#8E98AA",fontSize:8.3,fontWeight:"600"},packageCard:{overflow:"hidden",borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E6E8EF",boxShadow:"0 10px 24px rgba(49,58,82,.08)"},packageImage:{height:112,overflow:"hidden",backgroundColor:"#E8EEF6"},packageCopy:{padding:11,paddingBottom:7},packageTitle:{color:"#202A43",fontSize:10.4,fontWeight:"900"},packagePrice:{marginTop:5,color:"#202A43",fontSize:10.8,fontWeight:"900"},per:{color:"#8B95A8",fontSize:7.3,fontWeight:"600"},agencyTag:{marginTop:6,color:"#8062E0",fontSize:7.4,fontWeight:"800"},packageButton:{minHeight:32,marginHorizontal:10,marginBottom:10,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4,borderRadius:13,backgroundColor:"#F3EEFF",borderWidth:1,borderColor:"#E0D6F6"},packageButtonText:{color:"#7056D0",fontSize:8.2,fontWeight:"900"},agencyCard:{overflow:"hidden",borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E6E8EF",boxShadow:"0 10px 24px rgba(49,58,82,.08)"},agencyImage:{height:102,backgroundColor:"#E8EEF6"},agencyAvatar:{position:"absolute",left:12,bottom:-18,width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#364763",borderWidth:3,borderColor:"#FFFFFF"},agencyAvatarText:{color:"#FFFFFF",fontSize:9.5,fontWeight:"900"},agencyCopy:{paddingHorizontal:11,paddingTop:25,paddingBottom:8},agencyHead:{flexDirection:"row",alignItems:"center",gap:7},agencyName:{flex:1,minWidth:0,color:"#202A43",fontSize:10.4,fontWeight:"900"},agencyRating:{color:"#E3A330",fontSize:7.8,fontWeight:"900"},agencyDesc:{marginTop:5,minHeight:25,color:"#7B869C",fontSize:7.8,lineHeight:11.5,fontWeight:"600"},banner:{width:"100%",aspectRatio:1504/280,marginTop:27,overflow:"hidden",borderRadius:22,backgroundColor:"#DDEBFF",boxShadow:"0 14px 28px rgba(45,88,157,.16)"},modalBackdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:18,backgroundColor:"rgba(20,26,43,.34)"},modalCard:{width:"100%",maxWidth:520,maxHeight:"86%",padding:17,borderRadius:25,backgroundColor:"#FFFFFF"},modalHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},modalHeadCopy:{flex:1,minWidth:0},modalTitle:{color:"#1F2942",fontSize:17,fontWeight:"900"},modalSub:{marginTop:3,color:"#7F8A9E",fontSize:9,fontWeight:"600"},modalClose:{width:35,height:35,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"#F4F5F8"},modalLabel:{marginTop:14,marginBottom:7,color:"#59657A",fontSize:7.8,fontWeight:"900",letterSpacing:.5},tripList:{maxHeight:190},tripRow:{minHeight:55,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:9,marginBottom:7,borderRadius:15,borderWidth:1,borderColor:"#E9EBF1",backgroundColor:"#FBFCFE"},tripRowOn:{borderColor:"#D9D0F2",backgroundColor:"#F8F5FF"},tripIcon:{width:34,height:34,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#EFEAFF"},tripCopy:{flex:1,minWidth:0},tripName:{color:"#28324A",fontSize:9.8,fontWeight:"900"},tripMeta:{marginTop:2,color:"#8A94A7",fontSize:7.8,fontWeight:"600"},dayTrack:{gap:7},dayButton:{minHeight:34,justifyContent:"center",paddingHorizontal:12,borderRadius:14,backgroundColor:"#F5F6F8"},dayButtonOn:{backgroundColor:"#A18BE6"},dayText:{color:"#657086",fontSize:8.4,fontWeight:"800"},dayTextOn:{color:"#FFFFFF"},timeField:{minHeight:45,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,borderRadius:15,backgroundColor:"#F6F7F9"},timeInput:{flex:1,color:"#2C354B",fontSize:10.5,fontWeight:"800"},timeHint:{color:"#99A2B2",fontSize:7.3,fontWeight:"700"},modalActions:{marginTop:16,flexDirection:"row",gap:8},cancel:{minWidth:90,minHeight:42,alignItems:"center",justifyContent:"center",borderRadius:16,backgroundColor:"#F4F5F7"},cancelText:{color:"#606B7E",fontSize:8.8,fontWeight:"900"},addModalPress:{flex:1},addModal:{minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderRadius:16},addModalText:{color:"#FFFFFF",fontSize:8.8,fontWeight:"900"},detailCard:{width:"100%",maxWidth:480,overflow:"hidden",borderRadius:25,backgroundColor:"#FFFFFF"},detailHero:{height:190,justifyContent:"flex-end",padding:16,backgroundColor:"#E7ECF4"},detailClose:{position:"absolute",top:13,right:13,width:35,height:35,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.92)"},detailTitle:{color:"#FFFFFF",fontSize:20,lineHeight:24,fontWeight:"900"},detailBody:{padding:17},detailEyebrow:{color:"#8062E0",fontSize:7.8,fontWeight:"900",letterSpacing:.65},detailText:{marginTop:8,color:"#4D586E",fontSize:9.8,lineHeight:15,fontWeight:"700"},detailStrong:{marginTop:8,color:"#202A43",fontSize:12.5,fontWeight:"900"},detailMuted:{marginTop:7,color:"#8C96A8",fontSize:8.3,lineHeight:13,fontWeight:"600"},done:{minHeight:42,marginTop:15,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:"#F2EEFF"},doneText:{color:"#7052D5",fontSize:8.8,fontWeight:"900"},pressed:{opacity:.72}
});
