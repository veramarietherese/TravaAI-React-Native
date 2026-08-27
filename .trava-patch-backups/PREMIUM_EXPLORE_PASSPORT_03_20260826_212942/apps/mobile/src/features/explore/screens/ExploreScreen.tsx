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

import { useAuth } from "@/features/auth/hooks/useAuth";
import { listTrips } from "@/features/trips/api/trips.api";
import {
  searchNearbyPlaces,
  searchWorldPlaces,
  type WorldPlaceResult,
} from "@/features/maps/utils/world-place-search";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import { addDiscoverPlaceToItinerary } from "../utils/add-place-to-itinerary";
import {
  readSavedPlaces,
  savePinnedPlace,
  writeSavedPlaces,
} from "../utils/discover-storage";

type Category =
  | "Attractions"
  | "Food"
  | "Cafés"
  | "Activities"
  | "Hidden Gems"
  | "Shopping";

type Coordinates = { latitude: number; longitude: number };
type IconName = React.ComponentProps<typeof Ionicons>["name"];

type DemoPackage = {
  id: string;
  title: string;
  destination: string;
  agency: string;
  price: string;
  category: string;
  imageUrl: string;
  duration: string;
};

type DemoAgency = {
  id: string;
  name: string;
  tagline: string;
  specialty: string;
  rating: string;
  imageUrl: string;
  initials: string;
};

type DetailModalItem =
  | { kind: "package"; item: DemoPackage }
  | { kind: "agency"; item: DemoAgency }
  | null;

const CEBU_CENTER: Coordinates = { latitude: 10.3157, longitude: 123.8854 };

const CATEGORIES: ReadonlyArray<{
  name: Category;
  icon: IconName;
  api: string;
}> = [
  { name: "Attractions", icon: "business-outline", api: "attractions" },
  { name: "Food", icon: "restaurant-outline", api: "food" },
  { name: "Cafés", icon: "cafe-outline", api: "cafes" },
  { name: "Activities", icon: "walk-outline", api: "tourism" },
  { name: "Hidden Gems", icon: "location-outline", api: "attractions" },
  { name: "Shopping", icon: "bag-handle-outline", api: "shopping" },
];

function commons(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    fileName,
  )}?width=960`;
}

/**
 * Curated Cebu defaults use real places, real coordinates, and photos that
 * depict the named location. The normal search/category flows still use the
 * app's real OpenStreetMap/Photon place search.
 */
const CURATED_CEBU_PICKS: DiscoverPlace[] = [
  {
    id: "cebu-temple-of-leah",
    name: "Temple of Leah",
    subtitle: "Cebu Transcentral Highway, Busay, Cebu City",
    latitude: 10.368992,
    longitude: 123.873428,
    imageUrl: commons("Temple of Leah, Cebu City, Jan 2024.jpg"),
    rating: 4.6,
    distance: "Busay · Cebu City",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-taoist-temple",
    name: "Cebu Taoist Temple",
    subtitle: "Beverly Hills Subdivision, Lahug, Cebu City",
    latitude: 10.3308,
    longitude: 123.8867,
    imageUrl: commons("Taoist Temple, Cebu.jpg"),
    rating: 4.6,
    distance: "Lahug · Cebu City",
    category: "Hidden Gems",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-ayala-center",
    name: "Ayala Center Cebu",
    subtitle: "Cebu Business Park, Cebu City",
    latitude: 10.3174,
    longitude: 123.9053,
    imageUrl: commons("Ayala Center Cebu (10-05-2022).jpg"),
    rating: 4.6,
    distance: "Cebu Business Park",
    category: "Shopping",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-sirao-garden",
    name: "Sirao Garden",
    subtitle: "Sirao, Cebu City — flower gardens and hillside views",
    latitude: 10.407069,
    longitude: 123.866697,
    imageUrl: commons("Sirao Garden.jpg"),
    rating: 4.5,
    distance: "Sirao · Cebu City",
    category: "Activities",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-magellans-cross",
    name: "Magellan's Cross",
    subtitle: "P. Burgos Street, Cebu City",
    latitude: 10.293419,
    longitude: 123.901869,
    imageUrl: commons("Magellan's Cross in Cebu.jpg"),
    rating: 4.4,
    distance: "Downtown Cebu",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-fort-san-pedro",
    name: "Fort San Pedro",
    subtitle: "A. Pigafetta Street, Plaza Independencia, Cebu City",
    latitude: 10.2929,
    longitude: 123.9058,
    imageUrl: commons("Cebu City Fort San Pedro.jpg"),
    rating: 4.5,
    distance: "Plaza Independencia",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-santo-nino",
    name: "Basilica Minore del Santo Niño",
    subtitle: "Osmeña Boulevard, Cebu City",
    latitude: 10.2944,
    longitude: 123.9015,
    imageUrl: commons("Basilica Minore del Santo Niño Cebu.jpg"),
    rating: 4.8,
    distance: "Downtown Cebu",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
];

const CATEGORY_FALLBACK_IMAGES: Record<Category, string> = {
  Attractions:
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=84",
  Food:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=84",
  Cafés:
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=84",
  Activities:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=84",
  "Hidden Gems":
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=84",
  Shopping:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=84",
};

const DEMO_PACKAGES: DemoPackage[] = [
  {
    id: "demo-cebu-city-trail",
    title: "Cebu Heritage & Food Trail",
    destination: "Cebu City",
    agency: "Skyline Adventures",
    price: "₱1,499",
    category: "Culture + Food",
    imageUrl:
      "https://images.unsplash.com/photo-1552560880-2482cef14240?auto=format&fit=crop&w=1000&q=84",
    duration: "6 hours",
  },
  {
    id: "demo-moalboal",
    title: "Moalboal Ocean Day",
    destination: "Moalboal",
    agency: "Wanderlust Travels",
    price: "₱2,899",
    category: "Ocean Adventure",
    imageUrl:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=84",
    duration: "Full day",
  },
  {
    id: "demo-osmena",
    title: "Osmeña Peak Sunrise",
    destination: "Dalaguete",
    agency: "Vera Journey Co.",
    price: "₱1,199",
    category: "Hiking",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=84",
    duration: "7 hours",
  },
  {
    id: "demo-bantayan",
    title: "Bantayan Island Escape",
    destination: "Bantayan",
    agency: "Islandbound Cebu",
    price: "₱2,499",
    category: "Island Day",
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=84",
    duration: "Full day",
  },
  {
    id: "demo-canyoneering",
    title: "Canyoneering Adventure",
    destination: "Badian",
    agency: "South Cebu Trails",
    price: "₱2,699",
    category: "Adventure",
    imageUrl:
      "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1000&q=84",
    duration: "8 hours",
  },
  {
    id: "demo-bohol",
    title: "Bohol Countryside Day",
    destination: "Bohol",
    agency: "Visayas Gateway",
    price: "₱3,299",
    category: "Day Trip",
    imageUrl:
      "https://images.unsplash.com/photo-1531761535209-180857e963b9?auto=format&fit=crop&w=1000&q=84",
    duration: "Full day",
  },
];

const DEMO_AGENCIES: DemoAgency[] = [
  {
    id: "agency-skyline",
    name: "Skyline Adventures",
    tagline: "Curated city, culture and island escapes.",
    specialty: "Cebu · Bohol · Siargao",
    rating: "4.8",
    imageUrl:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=84",
    initials: "SA",
  },
  {
    id: "agency-wanderlust",
    name: "Wanderlust Travels",
    tagline: "Adventure-first itineraries around the Visayas.",
    specialty: "Moalboal · Badian · Bantayan",
    rating: "4.7",
    imageUrl:
      "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1000&q=84",
    initials: "WT",
  },
  {
    id: "agency-vera",
    name: "Vera Journey Co.",
    tagline: "Slow travel and thoughtfully paced escapes.",
    specialty: "Culture · Food · Wellness",
    rating: "4.9",
    imageUrl:
      "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1000&q=84",
    initials: "VJ",
  },
  {
    id: "agency-islandbound",
    name: "Islandbound Cebu",
    tagline: "Beach transfers, day tours and island hopping.",
    specialty: "Mactan · Bantayan · Camotes",
    rating: "4.6",
    imageUrl:
      "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1000&q=84",
    initials: "IC",
  },
  {
    id: "agency-southcebu",
    name: "South Cebu Trails",
    tagline: "Local-led outdoor adventures in southern Cebu.",
    specialty: "Badian · Oslob · Dalaguete",
    rating: "4.8",
    imageUrl:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=84",
    initials: "SC",
  },
  {
    id: "agency-visayas",
    name: "Visayas Gateway",
    tagline: "Multi-island planning without the logistics headache.",
    specialty: "Cebu · Bohol · Dumaguete",
    rating: "4.7",
    imageUrl:
      "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=1000&q=84",
    initials: "VG",
  },
];

export function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, user } = useAuth();

  const avatarUrl =
    profile?.avatar_url ||
    (typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null);

  const scrollRef = useRef<ScrollView>(null);
  const requestId = useRef(0);
  const mapY = useRef(0);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Attractions");
  const [mapPlaces, setMapPlaces] = useState<DiscoverPlace[]>(CURATED_CEBU_PICKS);
  const [searchResults, setSearchResults] = useState<DiscoverPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string>(CURATED_CEBU_PICKS[0].id);
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<Coordinates>(CEBU_CENTER);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);

  const [showAllPicks, setShowAllPicks] = useState(false);
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [showAllAgencies, setShowAllAgencies] = useState(false);

  const [tripOptions, setTripOptions] = useState<TripSummary[]>([]);
  const [tripLoading, setTripLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [addPlace, setAddPlace] = useState<DiscoverPlace | null>(null);
  const [adding, setAdding] = useState(false);

  const [detailItem, setDetailItem] = useState<DetailModalItem>(null);

  const contentPadding = width < 390 ? 14 : width < 720 ? 18 : 24;
  const cardWidth = Math.min(224, Math.max(188, width - contentPadding * 2 - 72));
  const packageWidth = Math.min(260, Math.max(214, width - contentPadding * 2 - 54));
  const agencyWidth = Math.min(276, Math.max(222, width - contentPadding * 2 - 44));

  useEffect(() => {
    void readSavedPlaces().then(setSaved);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;
        setUserCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        // Cebu remains a useful deterministic default.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchWorldPlaces(text, userCoords, 10);
        if (id !== requestId.current) return;
        setSearchResults(
          results.map((result, index) =>
            mapWorldPlace(result, inferCategory(text), index, userCoords),
          ),
        );
      } catch {
        if (id === requestId.current) setSearchResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, userCoords]);

  const selected = useMemo(
    () => mapPlaces.find((place) => place.id === selectedId) ?? null,
    [mapPlaces, selectedId],
  );

  const mapCenter = selected
    ? { latitude: selected.latitude, longitude: selected.longitude }
    : CEBU_CENTER;

  const visiblePicks = useMemo(() => {
    const base =
      activeCategory === "Attractions" && !categoryLoading
        ? CURATED_CEBU_PICKS
        : mapPlaces;

    const filtered = savedOnly
      ? base.filter((place) => saved.includes(place.id))
      : base;

    return showAllPicks ? filtered : filtered.slice(0, 6);
  }, [
    activeCategory,
    categoryLoading,
    mapPlaces,
    saved,
    savedOnly,
    showAllPicks,
  ]);

  async function chooseCategory(category: Category) {
    setActiveCategory(category);
    setQuery("");
    setSearchOpen(false);

    if (category === "Attractions") {
      setMapPlaces(CURATED_CEBU_PICKS);
      setSelectedId(CURATED_CEBU_PICKS[0].id);
      return;
    }

    const anchor = selected
      ? { latitude: selected.latitude, longitude: selected.longitude }
      : userCoords;

    setCategoryLoading(true);
    try {
      const api =
        CATEGORIES.find((item) => item.name === category)?.api ??
        category.toLowerCase();

      const results = await searchNearbyPlaces(
        api,
        anchor.latitude,
        anchor.longitude,
        12,
      );

      const mapped = results.map((item, index) =>
        mapWorldPlace(item, category, index, anchor),
      );

      if (!mapped.length) {
        Alert.alert(
          "No nearby results",
          `TRAVA did not receive nearby ${category.toLowerCase()} for this map area. Try another category or search a specific place.`,
        );
        return;
      }

      setMapPlaces(mapped);
      setSelectedId(mapped[0].id);
      requestAnimationFrame(() => scrollToMap(false));
    } catch {
      Alert.alert(
        "Discover is unavailable",
        "TRAVA could not load nearby places right now. Your curated Cebu picks are still available.",
      );
    } finally {
      setCategoryLoading(false);
    }
  }

  function chooseSearchResult(place: DiscoverPlace) {
    setQuery(place.name);
    setSearchOpen(false);
    setMapPlaces([place, ...searchResults.filter((item) => item.id !== place.id)]);
    setSelectedId(place.id);
    requestAnimationFrame(() => scrollToMap(true));
  }

  function focusOnMap(place: DiscoverPlace) {
    setMapPlaces((current) => {
      if (current.some((item) => item.id === place.id)) return current;
      return [place, ...current];
    });
    setSelectedId(place.id);
    requestAnimationFrame(() => scrollToMap(true));
  }

  function scrollToMap(animated: boolean) {
    scrollRef.current?.scrollTo({
      y: Math.max(0, mapY.current - 94),
      animated,
    });
  }

  async function toggleSaved(place: DiscoverPlace) {
    setSaved((current) => {
      const exists = current.includes(place.id);
      const next = exists
        ? current.filter((item) => item !== place.id)
        : [...current, place.id];

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
    } catch {
      Alert.alert(
        "Trips unavailable",
        "TRAVA could not load your trips. Make sure the API is running, then try again.",
      );
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
      Alert.alert("Choose a trip", "Select the trip where this place should go.");
      return;
    }

    setAdding(true);
    try {
      const result = await addDiscoverPlaceToItinerary({
        trip,
        place: addPlace,
        dayNumber: selectedDay,
        startTime: selectedTime,
      });

      setAddPlace(null);
      Alert.alert(
        "Added to itinerary",
        `${addPlace.name} was added to ${trip.name}, Day ${selectedDay} at ${displayTime(
          selectedTime,
        )}.${result.serverSynced ? "" : " It is saved locally for this trip."}`,
      );
    } catch (error) {
      Alert.alert(
        "Could not add place",
        error instanceof Error ? error.message : "Please try again.",
      );
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
      Alert.alert(
        "Voice search",
        "Voice search is available through supported browsers in this build.",
      );
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult:
          | ((event: {
              results: ArrayLike<{ 0?: { transcript?: string } }>;
            }) => void)
          | null;
        onerror: (() => void) | null;
        start(): void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult:
          | ((event: {
              results: ArrayLike<{ 0?: { transcript?: string } }>;
            }) => void)
          | null;
        onerror: (() => void) | null;
        start(): void;
      };
    };

    const Speech =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

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
    recognition.onerror = () =>
      Alert.alert("Voice search", "TRAVA could not hear that. Try again.");
    recognition.start();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={["#FBFCFF", "#FFF9FD", "#F9FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: contentPadding },
        ]}
      >
        <View style={styles.max}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Explore places for your trip</Text>
              <Text style={styles.subtitle}>
                Find amazing places and experiences to add to your itinerary.
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() =>
                  router.push("/(traveler)/(tabs)/profile" as Href)
                }
                style={styles.avatar}
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <Ionicons name="person" size={21} color="#34405A" />
                )}
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>2</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  savedOnly ? "Show all places" : "Show saved places"
                }
                onPress={() => setSavedOnly((current) => !current)}
                style={[styles.filterButton, savedOnly && styles.filterButtonOn]}
              >
                <Ionicons
                  name={savedOnly ? "heart" : "options-outline"}
                  size={20}
                  color={savedOnly ? "#7A58EA" : "#35415A"}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.searchArea}>
            <View
              style={[
                styles.search,
                searchOpen && query.trim().length >= 2 && styles.searchFocused,
              ]}
            >
              <Ionicons name="search-outline" size={22} color="#7D88A0" />
              <TextInput
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChangeText={(text) => {
                  setQuery(text);
                  setSearchOpen(true);
                }}
                placeholder="Search places, activities, restaurants..."
                placeholderTextColor="#929CB0"
                returnKeyType="search"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {loading ? (
                <ActivityIndicator size="small" color="#7558EE" />
              ) : (
                <Pressable
                  accessibilityLabel={query ? "Clear search" : "Voice search"}
                  onPress={startVoiceSearch}
                  style={styles.voiceButton}
                >
                  <Ionicons
                    name={query ? "close" : "mic-outline"}
                    size={19}
                    color="#835EEA"
                  />
                </Pressable>
              )}
            </View>

            {searchOpen && query.trim().length >= 2 ? (
              <View style={styles.dropdown}>
                <View style={styles.dropdownHead}>
                  <Text style={styles.dropdownTitle}>Real place search</Text>
                  <Pressable onPress={() => setSearchOpen(false)}>
                    <Text style={styles.dropdownDone}>Done</Text>
                  </Pressable>
                </View>

                {!loading && !searchResults.length ? (
                  <Text style={styles.dropdownEmpty}>
                    No result yet. Try a city, landmark, café, restaurant or
                    activity name.
                  </Text>
                ) : null}

                {searchResults.map((place) => (
                  <Pressable
                    key={place.id}
                    onPress={() => chooseSearchResult(place)}
                    style={({ pressed }) => [
                      styles.searchResult,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.searchResultIcon}>
                      <Ionicons
                        name={categoryIcon(place.category)}
                        size={18}
                        color="#745BE7"
                      />
                    </View>
                    <View style={styles.searchResultCopy}>
                      <Text numberOfLines={1} style={styles.searchResultName}>
                        {place.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.searchResultAddress}>
                        {place.subtitle}
                      </Text>
                    </View>
                    <Ionicons
                      name="navigate-outline"
                      size={18}
                      color="#8A95A9"
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {CATEGORIES.map((category) => {
              const active = activeCategory === category.name;
              return (
                <Pressable
                  key={category.name}
                  disabled={categoryLoading}
                  onPress={() => void chooseCategory(category.name)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={category.icon}
                    size={15}
                    color={active ? "#FFFFFF" : "#566078"}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      active && styles.categoryTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            onLayout={(event) => {
              mapY.current = event.nativeEvent.layout.y;
            }}
            style={styles.mapCard}
          >
            <DiscoverMap
              places={mapPlaces}
              selectedId={selectedId}
              center={mapCenter}
              onSelect={(id) => setSelectedId(id)}
              onMapPress={(coordinate) => {
                const pin: DiscoverPlace = {
                  id: `pin-${coordinate.latitude.toFixed(
                    5,
                  )}-${coordinate.longitude.toFixed(5)}`,
                  name: "Pinned location",
                  subtitle: `${coordinate.latitude.toFixed(
                    5,
                  )}, ${coordinate.longitude.toFixed(5)}`,
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                  imageUrl: CATEGORY_FALLBACK_IMAGES["Hidden Gems"],
                  rating: 4.8,
                  distance: "Pinned",
                  category: "Hidden Gems",
                };

                setMapPlaces((current) => [
                  pin,
                  ...current.filter((item) => item.id !== pin.id),
                ]);
                setSelectedId(pin.id);
              }}
            />

            <View pointerEvents="none" style={styles.mapTitlePill}>
              <View style={styles.mapTitleDot} />
              <Text style={styles.mapTitleText}>
                {selected?.city || "Cebu City"}
              </Text>
            </View>

            {categoryLoading ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator color="#7658EA" />
                <Text style={styles.mapLoadingText}>
                  Finding real {activeCategory.toLowerCase()} nearby…
                </Text>
              </View>
            ) : null}
          </View>

          <SectionHeader
            eyebrow="TRAVA AI PICKS FOR YOU"
            sub="Real places on the map, ready to add to your itinerary."
            expanded={showAllPicks}
            onToggle={() => setShowAllPicks((current) => !current)}
          />

          {visiblePicks.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardTrack}
            >
              {visiblePicks.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  saved={saved.includes(place.id)}
                  width={cardWidth}
                  onOpen={() => focusOnMap(place)}
                  onSave={() => void toggleSaved(place)}
                  onAdd={() => void openAdd(place)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={24} color="#8A6CEB" />
              <Text style={styles.emptyTitle}>No saved picks yet</Text>
              <Text style={styles.emptyText}>
                Save a place and it will appear here.
              </Text>
            </View>
          )}

          <SectionHeader
            eyebrow="EXPERIENCES & TOUR PACKAGES"
            sub="Preview catalog — bookable agency inventory can replace these cards later."
            expanded={showAllPackages}
            onToggle={() => setShowAllPackages((current) => !current)}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardTrack}
          >
            {(showAllPackages ? DEMO_PACKAGES : DEMO_PACKAGES.slice(0, 4)).map(
              (item) => (
                <PackageCard
                  key={item.id}
                  item={item}
                  width={packageWidth}
                  onOpen={() => setDetailItem({ kind: "package", item })}
                />
              ),
            )}
          </ScrollView>

          <SectionHeader
            eyebrow="TRAVEL AGENCIES"
            sub="Trusted-looking placeholder partner cards with varied specialties."
            expanded={showAllAgencies}
            onToggle={() => setShowAllAgencies((current) => !current)}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardTrack}
          >
            {(showAllAgencies ? DEMO_AGENCIES : DEMO_AGENCIES.slice(0, 4)).map(
              (item) => (
                <AgencyCard
                  key={item.id}
                  item={item}
                  width={agencyWidth}
                  onOpen={() => setDetailItem({ kind: "agency", item })}
                />
              ),
            )}
          </ScrollView>

          <LinearGradient
            colors={["#286BC8", "#7296E9", "#EDB7C7"]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.6 }}
            style={styles.partnerBanner}
          >
            <View style={styles.partnerCopy}>
              <View style={styles.partnerEyebrow}>
                <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                <Text style={styles.partnerEyebrowText}>
                  FEATURED TRAVA PARTNER
                </Text>
              </View>
              <Text style={styles.partnerTitle}>
                Fly into something new with Skyline Adventures.
              </Text>
              <Text style={styles.partnerText}>
                Journeys designed around you.
              </Text>
              <Pressable
                onPress={() =>
                  setDetailItem({
                    kind: "agency",
                    item: DEMO_AGENCIES[0],
                  })
                }
                style={styles.partnerButton}
              >
                <Text style={styles.partnerButtonText}>View partner</Text>
                <Ionicons name="arrow-forward" size={13} color="#315FAF" />
              </Pressable>
            </View>
            <View style={styles.partnerPlane}>
              <Ionicons name="airplane" size={54} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      <AddToItineraryModal
        visible={Boolean(addPlace)}
        place={addPlace}
        trips={tripOptions}
        loadingTrips={tripLoading}
        selectedTripId={selectedTripId}
        onSelectTrip={(id) => {
          setSelectedTripId(id);
          setSelectedDay(1);
        }}
        day={selectedDay}
        onDay={setSelectedDay}
        time={selectedTime}
        onTime={setSelectedTime}
        adding={adding}
        onClose={() => setAddPlace(null)}
        onAdd={() => void addToItinerary()}
      />

      <CatalogDetailModal
        value={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </SafeAreaView>
  );
}

function SectionHeader({
  eyebrow,
  sub,
  expanded,
  onToggle,
}: {
  eyebrow: string;
  sub: string;
  expanded: boolean;
  onToggle(): void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionSub}>{sub}</Text>
      </View>
      <Pressable onPress={onToggle} style={styles.viewAllButton}>
        <Text style={styles.viewAllText}>
          {expanded ? "Show less" : "View all"}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-forward"}
          size={13}
          color="#7656E7"
        />
      </Pressable>
    </View>
  );
}

function PlaceCard({
  place,
  saved,
  width,
  onOpen,
  onSave,
  onAdd,
}: {
  place: DiscoverPlace;
  saved: boolean;
  width: number;
  onOpen(): void;
  onSave(): void;
  onAdd(): void;
}) {
  return (
    <View style={[styles.placeCard, { width }]}>
      <Pressable onPress={onOpen} style={styles.placeImageWrap}>
        <Image
          source={{ uri: place.imageUrl }}
          contentFit="cover"
          transition={180}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", "rgba(15,25,46,.18)"]}
          style={StyleSheet.absoluteFillObject}
        />
      </Pressable>

      <Pressable
        accessibilityLabel={saved ? "Remove from saved" : "Save place"}
        onPress={onSave}
        style={styles.heart}
      >
        <Ionicons
          name={saved ? "heart" : "heart-outline"}
          size={17}
          color={saved ? "#F25C8B" : "#43516B"}
        />
      </Pressable>

      <Pressable onPress={onOpen} style={styles.placeCopy}>
        <Text numberOfLines={1} style={styles.placeName}>
          {place.name}
        </Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>★ {place.rating.toFixed(1)}</Text>
          <Text style={styles.ratingMuted}>({ratingCount(place.id)})</Text>
        </View>
        <View style={styles.placeMetaRow}>
          <Ionicons name="location-outline" size={12} color="#8590A4" />
          <Text numberOfLines={1} style={styles.placeMeta}>
            {place.distance}
          </Text>
        </View>
        <View style={styles.placeMetaRow}>
          <Ionicons
            name={categoryIcon(place.category)}
            size={12}
            color="#8590A4"
          />
          <Text numberOfLines={1} style={styles.placeMeta}>
            {place.category}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onAdd} style={styles.addButton}>
        <Ionicons name="add" size={14} color="#7254DB" />
        <Text style={styles.addButtonText}>Add to itinerary</Text>
      </Pressable>
    </View>
  );
}

function PackageCard({
  item,
  width,
  onOpen,
}: {
  item: DemoPackage;
  width: number;
  onOpen(): void;
}) {
  return (
    <View style={[styles.packageCard, { width }]}>
      <Pressable onPress={onOpen} style={styles.packageImageWrap}>
        <Image
          source={{ uri: item.imageUrl }}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.packageHeart}>
          <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
        </View>
      </Pressable>

      <View style={styles.packageCopy}>
        <Text numberOfLines={1} style={styles.packageTitle}>
          {item.title}
        </Text>
        <Text style={styles.packagePrice}>
          {item.price} <Text style={styles.packagePer}>/ person</Text>
        </Text>
        <View style={styles.packageMetaRow}>
          <Ionicons name="location-outline" size={12} color="#7D88A0" />
          <Text style={styles.packageMeta}>{item.destination}</Text>
        </View>
        <View style={styles.packageMetaRow}>
          <Ionicons name="time-outline" size={12} color="#7D88A0" />
          <Text style={styles.packageMeta}>{item.duration}</Text>
        </View>
        <Text numberOfLines={1} style={styles.packageAgency}>
          ✦ {item.agency}
        </Text>
      </View>

      <Pressable onPress={onOpen} style={styles.packageButton}>
        <Text style={styles.packageButtonText}>View Package</Text>
      </Pressable>
    </View>
  );
}

function AgencyCard({
  item,
  width,
  onOpen,
}: {
  item: DemoAgency;
  width: number;
  onOpen(): void;
}) {
  return (
    <View style={[styles.agencyCard, { width }]}>
      <View style={styles.agencyCover}>
        <Image
          source={{ uri: item.imageUrl }}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", "rgba(19,28,52,.38)"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.agencyAvatar}>
          <Text style={styles.agencyAvatarText}>{item.initials}</Text>
        </View>
      </View>

      <View style={styles.agencyCopy}>
        <View style={styles.agencyTitleRow}>
          <Text numberOfLines={1} style={styles.agencyName}>
            {item.name}
          </Text>
          <Text style={styles.agencyRating}>★ {item.rating}</Text>
        </View>
        <Text numberOfLines={2} style={styles.agencyTagline}>
          {item.tagline}
        </Text>
        <View style={styles.packageMetaRow}>
          <Ionicons name="compass-outline" size={12} color="#7D88A0" />
          <Text numberOfLines={1} style={styles.packageMeta}>
            {item.specialty}
          </Text>
        </View>
      </View>

      <Pressable onPress={onOpen} style={styles.agencyButton}>
        <Text style={styles.agencyButtonText}>View Agency</Text>
        <Ionicons name="arrow-forward" size={13} color="#6A50D0" />
      </Pressable>
    </View>
  );
}

function AddToItineraryModal({
  visible,
  place,
  trips,
  loadingTrips,
  selectedTripId,
  onSelectTrip,
  day,
  onDay,
  time,
  onTime,
  adding,
  onClose,
  onAdd,
}: {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <View style={styles.modalHeadCopy}>
              <Text style={styles.modalTitle}>Add to itinerary</Text>
              <Text numberOfLines={1} style={styles.modalSubtitle}>
                {place?.name || "Selected place"}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#526079" />
            </Pressable>
          </View>

          <Text style={styles.modalLabel}>Choose trip</Text>
          {loadingTrips ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color="#7458E5" />
              <Text style={styles.modalLoadingText}>Loading your trips…</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.tripList}
              contentContainerStyle={styles.tripListContent}
            >
              {trips.map((item) => {
                const active = item.id === selectedTripId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onSelectTrip(item.id)}
                    style={[styles.tripRow, active && styles.tripRowActive]}
                  >
                    <View style={styles.tripIcon}>
                      <Ionicons
                        name="airplane-outline"
                        size={17}
                        color="#6B59D8"
                      />
                    </View>
                    <View style={styles.tripCopy}>
                      <Text style={styles.tripName}>{item.name}</Text>
                      <Text style={styles.tripMeta}>
                        {item.destination} · {Math.max(1, item.numberOfDays)} days
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? "checkmark-circle" : "chevron-forward"}
                      size={20}
                      color={active ? "#7658EA" : "#A2ADBE"}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {!loadingTrips && !trips.length ? (
            <Text style={styles.noTrips}>
              No active trip was found. Create a trip first, then return here.
            </Text>
          ) : null}

          {trip ? (
            <>
              <Text style={styles.modalLabel}>Day</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayTrack}
              >
                {Array.from({ length: dayCount }, (_, index) => index + 1).map(
                  (value) => (
                    <Pressable
                      key={value}
                      onPress={() => onDay(value)}
                      style={[
                        styles.dayButton,
                        value === day && styles.dayButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          value === day && styles.dayButtonTextActive,
                        ]}
                      >
                        Day {value}
                      </Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>

              <Text style={styles.modalLabel}>Time</Text>
              <View style={styles.timeField}>
                <Ionicons name="time-outline" size={19} color="#64728B" />
                <TextInput
                  value={time}
                  onChangeText={onTime}
                  maxLength={5}
                  placeholder="09:00"
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeInput}
                />
                <Text style={styles.timeHint}>24-hour</Text>
              </View>
            </>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              disabled={!trip || adding}
              onPress={onAdd}
              style={[
                styles.modalAddPress,
                (!trip || adding) && styles.modalAddDisabled,
              ]}
            >
              <LinearGradient
                colors={["#7255EA", "#708CEE", "#E694C4"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.modalAdd}
              >
                {adding ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.modalAddText}>Add place</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CatalogDetailModal({
  value,
  onClose,
}: {
  value: DetailModalItem;
  onClose(): void;
}) {
  if (!value) return null;

  const isPackage = value.kind === "package";
  const title = value.item.name ?? value.item.title;
  const imageUrl = value.item.imageUrl;

  return (
    <Modal
      visible={Boolean(value)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.catalogModal}>
          <View style={styles.catalogHero}>
            <Image
              source={{ uri: imageUrl }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["transparent", "rgba(18,26,50,.55)"]}
              style={StyleSheet.absoluteFillObject}
            />
            <Pressable onPress={onClose} style={styles.catalogClose}>
              <Ionicons name="close" size={20} color="#25314A" />
            </Pressable>
            <Text style={styles.catalogHeroTitle}>{title}</Text>
          </View>

          <View style={styles.catalogBody}>
            <Text style={styles.catalogEyebrow}>
              {isPackage ? "TOUR PACKAGE PREVIEW" : "TRAVEL AGENCY PREVIEW"}
            </Text>

            {isPackage ? (
              <>
                <Text style={styles.catalogText}>
                  {(value.item as DemoPackage).destination} ·{" "}
                  {(value.item as DemoPackage).duration} ·{" "}
                  {(value.item as DemoPackage).category}
                </Text>
                <Text style={styles.catalogPrice}>
                  {(value.item as DemoPackage).price} / person
                </Text>
                <Text style={styles.catalogMuted}>
                  Placeholder catalog card. Connect this action to real agency
                  inventory when your marketplace backend is ready.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.catalogText}>
                  {(value.item as DemoAgency).tagline}
                </Text>
                <Text style={styles.catalogPrice}>
                  ★ {(value.item as DemoAgency).rating} ·{" "}
                  {(value.item as DemoAgency).specialty}
                </Text>
                <Text style={styles.catalogMuted}>
                  Placeholder partner profile with intentionally varied data.
                </Text>
              </>
            )}

            <Pressable onPress={onClose} style={styles.catalogDone}>
              <Text style={styles.catalogDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function mapWorldPlace(
  item: WorldPlaceResult,
  category: Category,
  index: number,
  origin?: Coordinates | null,
): DiscoverPlace {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.displayName,
    city: item.city,
    country: item.country,
    latitude: item.latitude,
    longitude: item.longitude,
    imageUrl: CATEGORY_FALLBACK_IMAGES[category],
    rating: Math.min(4.9, 4.5 + (index % 4) * 0.1),
    distance: origin
      ? humanDistance(
          origin.latitude,
          origin.longitude,
          item.latitude,
          item.longitude,
        )
      : "Map location",
    category,
  };
}

function inferCategory(text: string): Category {
  const value = text.toLowerCase();
  if (value.includes("cafe") || value.includes("coffee")) return "Cafés";
  if (
    value.includes("food") ||
    value.includes("restaurant") ||
    value.includes("eat")
  )
    return "Food";
  if (
    value.includes("shop") ||
    value.includes("mall") ||
    value.includes("store")
  )
    return "Shopping";
  if (
    value.includes("hike") ||
    value.includes("trail") ||
    value.includes("tour") ||
    value.includes("activity")
  )
    return "Activities";
  if (
    value.includes("hidden") ||
    value.includes("garden") ||
    value.includes("local")
  )
    return "Hidden Gems";
  return "Attractions";
}

function categoryIcon(category: string): IconName {
  if (category === "Food") return "restaurant-outline";
  if (category === "Cafés") return "cafe-outline";
  if (category === "Shopping") return "bag-handle-outline";
  if (category === "Activities") return "walk-outline";
  if (category === "Hidden Gems") return "location-outline";
  return "business-outline";
}

function displayTime(value: string) {
  const [h = "9", m = "00"] = value.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function ratingCount(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return 120 + (sum % 980);
}

function humanDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const rad = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((lat2 - lat1) * rad) / 2 +
    (Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      (1 - Math.cos((lon2 - lon1) * rad))) /
      2;
  const km = 12742 * Math.asin(Math.sqrt(a));

  return km < 1
    ? `${Math.max(20, Math.round((km * 1000) / 10) * 10)} m`
    : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FBFCFF",
  },
  scroll: {
    paddingTop: 14,
    paddingBottom: 148,
  },
  max: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    paddingTop: 8,
    paddingBottom: 18,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#131B37",
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.85,
  },
  subtitle: {
    marginTop: 4,
    color: "#7A859C",
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    backgroundColor: "#F3F5FB",
    borderWidth: 1,
    borderColor: "#E6E9F2",
    boxShadow: "0 8px 18px rgba(55,67,97,.08)",
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    top: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F05072",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarBadgeText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontWeight: "900",
  },
  filterButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.95)",
    borderWidth: 1,
    borderColor: "#E5E8F0",
    boxShadow: "0 8px 18px rgba(55,67,97,.07)",
  },
  filterButtonOn: {
    backgroundColor: "#F2EEFF",
    borderColor: "#DCCFFF",
  },

  searchArea: {
    zIndex: 50,
  },
  search: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.96)",
    borderWidth: 1,
    borderColor: "#E8EAF1",
    boxShadow: "0 10px 24px rgba(52,62,89,.07)",
  },
  searchFocused: {
    borderColor: "#D4C7FA",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    color: "#202A45",
    fontSize: 12,
    fontWeight: "600",
  },
  voiceButton: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F3FF",
  },
  dropdown: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 62,
    maxHeight: 360,
    padding: 9,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9F0",
    boxShadow: "0 18px 38px rgba(42,52,78,.14)",
  },
  dropdownHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  dropdownTitle: {
    color: "#222D47",
    fontSize: 10,
    fontWeight: "900",
  },
  dropdownDone: {
    color: "#7358E3",
    fontSize: 9,
    fontWeight: "900",
  },
  dropdownEmpty: {
    padding: 12,
    color: "#8A95A8",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
  },
  searchResult: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    borderRadius: 13,
  },
  searchResultIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F0FF",
  },
  searchResultCopy: {
    flex: 1,
    minWidth: 0,
  },
  searchResultName: {
    color: "#25304A",
    fontSize: 11,
    fontWeight: "900",
  },
  searchResultAddress: {
    marginTop: 2,
    color: "#8A95A8",
    fontSize: 8.5,
    fontWeight: "600",
  },

  categories: {
    gap: 8,
    paddingTop: 13,
    paddingBottom: 16,
  },
  categoryChip: {
    minHeight: 35,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9EF",
  },
  categoryChipActive: {
    backgroundColor: "#7758E9",
    borderColor: "#7758E9",
    boxShadow: "0 8px 16px rgba(119,88,233,.18)",
  },
  categoryText: {
    color: "#4B566D",
    fontSize: 9.3,
    fontWeight: "800",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },

  mapCard: {
    position: "relative",
    width: "100%",
  },
  mapTitlePill: {
    position: "absolute",
    left: "50%",
    top: "46%",
    transform: [{ translateX: -52 }],
    minWidth: 104,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,.92)",
    borderWidth: 1,
    borderColor: "rgba(225,231,241,.95)",
    boxShadow: "0 8px 18px rgba(49,72,106,.13)",
  },
  mapTitleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#7559E9",
  },
  mapTitleText: {
    color: "#37425B",
    fontSize: 10,
    fontWeight: "900",
  },
  mapLoading: {
    position: "absolute",
    left: 14,
    bottom: 14,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.95)",
    boxShadow: "0 8px 18px rgba(49,72,106,.12)",
  },
  mapLoadingText: {
    color: "#5F6B82",
    fontSize: 9,
    fontWeight: "700",
  },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionEyebrow: {
    color: "#7557E3",
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  sectionSub: {
    marginTop: 3,
    color: "#8993A8",
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: "600",
  },
  viewAllButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
  },
  viewAllText: {
    color: "#7656E7",
    fontSize: 9,
    fontWeight: "900",
  },

  cardTrack: {
    gap: 10,
    paddingRight: 8,
    paddingBottom: 7,
  },
  placeCard: {
    overflow: "hidden",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E8EF",
    boxShadow: "0 10px 24px rgba(49,58,82,.08)",
  },
  placeImageWrap: {
    width: "100%",
    height: 118,
    overflow: "hidden",
    backgroundColor: "#E8EEF6",
  },
  heart: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.90)",
    boxShadow: "0 6px 12px rgba(31,42,65,.11)",
  },
  placeCopy: {
    paddingHorizontal: 11,
    paddingTop: 9,
  },
  placeName: {
    color: "#202A43",
    fontSize: 11,
    fontWeight: "900",
  },
  ratingRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    color: "#E5A329",
    fontSize: 8.5,
    fontWeight: "900",
  },
  ratingMuted: {
    color: "#98A1B1",
    fontSize: 7.5,
    fontWeight: "700",
  },
  placeMetaRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  placeMeta: {
    flex: 1,
    minWidth: 0,
    color: "#7F8A9F",
    fontSize: 7.8,
    fontWeight: "600",
  },
  addButton: {
    minHeight: 32,
    margin: 10,
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 14,
    backgroundColor: "#F6F1FF",
    borderWidth: 1,
    borderColor: "#E0D3FB",
  },
  addButtonText: {
    color: "#7254DB",
    fontSize: 8.2,
    fontWeight: "900",
  },

  emptyState: {
    minHeight: 115,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,.82)",
    borderWidth: 1,
    borderColor: "#ECEAF3",
  },
  emptyTitle: {
    marginTop: 7,
    color: "#29334B",
    fontSize: 11,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 3,
    color: "#8E98AA",
    fontSize: 8.5,
    fontWeight: "600",
  },

  packageCard: {
    overflow: "hidden",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E8EF",
    boxShadow: "0 10px 24px rgba(49,58,82,.08)",
  },
  packageImageWrap: {
    height: 112,
    overflow: "hidden",
    backgroundColor: "#E8EEF6",
  },
  packageHeart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(38,48,69,.56)",
  },
  packageCopy: {
    padding: 11,
    paddingBottom: 7,
  },
  packageTitle: {
    color: "#202A43",
    fontSize: 10.5,
    fontWeight: "900",
  },
  packagePrice: {
    marginTop: 5,
    color: "#202A43",
    fontSize: 11,
    fontWeight: "900",
  },
  packagePer: {
    color: "#8B95A8",
    fontSize: 7.5,
    fontWeight: "600",
  },
  packageMetaRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  packageMeta: {
    flex: 1,
    minWidth: 0,
    color: "#7D88A0",
    fontSize: 7.8,
    fontWeight: "600",
  },
  packageAgency: {
    marginTop: 6,
    color: "#7657E2",
    fontSize: 7.5,
    fontWeight: "800",
  },
  packageButton: {
    minHeight: 32,
    marginHorizontal: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#F3EEFF",
    borderWidth: 1,
    borderColor: "#DFD2FB",
  },
  packageButtonText: {
    color: "#7152D7",
    fontSize: 8.3,
    fontWeight: "900",
  },

  agencyCard: {
    overflow: "hidden",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E8EF",
    boxShadow: "0 10px 24px rgba(49,58,82,.08)",
  },
  agencyCover: {
    height: 102,
    backgroundColor: "#E8EEF6",
  },
  agencyAvatar: {
    position: "absolute",
    left: 12,
    bottom: -18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#273A5B",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  agencyAvatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  agencyCopy: {
    paddingHorizontal: 11,
    paddingTop: 25,
    paddingBottom: 8,
  },
  agencyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  agencyName: {
    flex: 1,
    minWidth: 0,
    color: "#202A43",
    fontSize: 10.5,
    fontWeight: "900",
  },
  agencyRating: {
    color: "#E5A329",
    fontSize: 8,
    fontWeight: "900",
  },
  agencyTagline: {
    marginTop: 5,
    minHeight: 26,
    color: "#7B869C",
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "600",
  },
  agencyButton: {
    minHeight: 32,
    marginHorizontal: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 13,
    backgroundColor: "#F5F1FF",
  },
  agencyButtonText: {
    color: "#6A50D0",
    fontSize: 8.3,
    fontWeight: "900",
  },

  partnerBanner: {
    minHeight: 118,
    marginTop: 26,
    marginBottom: 6,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 22,
    padding: 17,
    boxShadow: "0 14px 28px rgba(45,88,157,.18)",
  },
  partnerCopy: {
    flex: 1,
    minWidth: 0,
    maxWidth: 560,
  },
  partnerEyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.17)",
  },
  partnerEyebrowText: {
    color: "#FFFFFF",
    fontSize: 6.8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  partnerTitle: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  partnerText: {
    marginTop: 3,
    color: "rgba(255,255,255,.82)",
    fontSize: 8.5,
    fontWeight: "600",
  },
  partnerButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  partnerButtonText: {
    color: "#315FAF",
    fontSize: 7.8,
    fontWeight: "900",
  },
  partnerPlane: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.14)",
    transform: [{ rotate: "-12deg" }],
  },

  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(20,26,43,.34)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "86%",
    padding: 17,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E8F1",
    boxShadow: "0 24px 48px rgba(22,30,51,.18)",
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalHeadCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: "#1F2942",
    fontSize: 17,
    fontWeight: "900",
  },
  modalSubtitle: {
    marginTop: 3,
    color: "#7F8A9E",
    fontSize: 9,
    fontWeight: "600",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F5F8",
  },
  modalLabel: {
    marginTop: 14,
    marginBottom: 7,
    color: "#59657A",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalLoading: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalLoadingText: {
    color: "#788399",
    fontSize: 9,
    fontWeight: "700",
  },
  tripList: {
    maxHeight: 190,
  },
  tripListContent: {
    gap: 7,
  },
  tripRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E9EBF1",
    backgroundColor: "#FBFCFE",
  },
  tripRowActive: {
    borderColor: "#D8CCFA",
    backgroundColor: "#F8F5FF",
  },
  tripIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEAFF",
  },
  tripCopy: {
    flex: 1,
    minWidth: 0,
  },
  tripName: {
    color: "#28324A",
    fontSize: 10,
    fontWeight: "900",
  },
  tripMeta: {
    marginTop: 2,
    color: "#8A94A7",
    fontSize: 8,
    fontWeight: "600",
  },
  noTrips: {
    color: "#8B95A7",
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "600",
  },
  dayTrack: {
    gap: 7,
  },
  dayButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F5F6F8",
  },
  dayButtonActive: {
    backgroundColor: "#7659E8",
  },
  dayButtonText: {
    color: "#657086",
    fontSize: 8.5,
    fontWeight: "800",
  },
  dayButtonTextActive: {
    color: "#FFFFFF",
  },
  timeField: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: "#F6F7F9",
  },
  timeInput: {
    flex: 1,
    color: "#2C354B",
    fontSize: 11,
    fontWeight: "800",
  },
  timeHint: {
    color: "#99A2B2",
    fontSize: 7.5,
    fontWeight: "700",
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  modalCancel: {
    minWidth: 92,
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#F4F5F7",
  },
  modalCancelText: {
    color: "#606B7E",
    fontSize: 9,
    fontWeight: "900",
  },
  modalAddPress: {
    flex: 1,
  },
  modalAddDisabled: {
    opacity: 0.55,
  },
  modalAdd: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 16,
  },
  modalAddText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  catalogModal: {
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    boxShadow: "0 24px 48px rgba(22,30,51,.18)",
  },
  catalogHero: {
    height: 190,
    justifyContent: "flex-end",
    padding: 16,
    backgroundColor: "#E7ECF4",
  },
  catalogClose: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.92)",
  },
  catalogHeroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  catalogBody: {
    padding: 17,
  },
  catalogEyebrow: {
    color: "#7759E4",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  catalogText: {
    marginTop: 8,
    color: "#4D586E",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
  },
  catalogPrice: {
    marginTop: 8,
    color: "#202A43",
    fontSize: 13,
    fontWeight: "900",
  },
  catalogMuted: {
    marginTop: 7,
    color: "#8C96A8",
    fontSize: 8.5,
    lineHeight: 13,
    fontWeight: "600",
  },
  catalogDone: {
    minHeight: 42,
    marginTop: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#F2EEFF",
  },
  catalogDoneText: {
    color: "#7052D5",
    fontSize: 9,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.72,
  },
});
