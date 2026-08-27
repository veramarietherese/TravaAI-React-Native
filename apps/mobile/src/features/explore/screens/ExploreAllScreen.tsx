import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { searchNearbyPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import type { DiscoverPlace } from "../components/DiscoverMap";
import {
  CATEGORY_FALLBACK_IMAGES,
  CEBU_CENTER,
  CURATED_CEBU_PICKS,
  DEMO_AGENCIES,
  DEMO_PACKAGES,
  EXPLORE_CATEGORIES,
  exploreCategoryIcon,
  humanDistance,
  ratingCount,
  type DemoAgency,
  type DemoPackage,
  type ExploreCategory,
} from "../data/explore-catalog";

export function ExploreAllScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; category?: string }>();
  const { width } = useWindowDimensions();
  const section = params.section === "packages" || params.section === "agencies" ? params.section : "picks";
  const category = normalizeCategory(params.category);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<DiscoverPlace[]>(category === "Attractions" ? CURATED_CEBU_PICKS : []);
  const [loading, setLoading] = useState(category !== "Attractions" && section === "picks");

  useEffect(() => {
    if (section !== "picks" || category === "Attractions") {
      setPlaces(CURATED_CEBU_PICKS);
      setLoading(false);
      return;
    }

    let live = true;
    void (async () => {
      let center = CEBU_CENTER;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch {}

      try {
        const api = EXPLORE_CATEGORIES.find((item) => item.name === category)?.api ?? category.toLowerCase();
        const result = await searchNearbyPlaces(api, center.latitude, center.longitude, 30);
        if (!live) return;
        setPlaces(result.map((item, index) => mapWorldPlace(item, category, index, center)));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => { live = false; };
  }, [category, section]);

  const title = section === "picks" ? `All ${category}` : section === "packages" ? "All Tour Packages" : "All Travel Agencies";
  const subtitle = section === "picks" ? "Choose a place to focus it on the Explore map." : section === "packages" ? "Browse the complete preview catalog." : "Browse every travel agency preview.";

  const filteredPlaces = useMemo(() => filterPlaces(places, query), [places, query]);
  const filteredPackages = useMemo(() => DEMO_PACKAGES.filter((item) => `${item.title} ${item.destination} ${item.agency}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const filteredAgencies = useMemo(() => DEMO_AGENCIES.filter((item) => `${item.name} ${item.specialty} ${item.tagline}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const columns = width >= 1020 ? 4 : width >= 720 ? 3 : width >= 500 ? 2 : 1;

  function openPlace(place: DiscoverPlace) {
    router.replace(`/(traveler)/(tabs)/explore?focusId=${encodeURIComponent(place.id)}` as Href);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient colors={["#FBFCFF", "#FFF9FD", "#F9FBFF"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.max}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={20} color="#2B354D" /></Pressable>
            <View style={styles.headerCopy}><Text style={styles.eyebrow}>TRAVA EXPLORE</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
          </View>

          <View style={styles.search}><Ionicons name="search-outline" size={19} color="#7E899E" /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${section === "agencies" ? "agencies" : section === "packages" ? "packages" : "places"}...`} placeholderTextColor="#98A1B3" style={styles.searchInput} />{query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color="#A2ABBB" /></Pressable> : null}</View>

          {section === "picks" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{EXPLORE_CATEGORIES.map((item) => <Pressable key={item.name} onPress={() => router.replace(`/explore/all?section=picks&category=${encodeURIComponent(item.name)}` as Href)} style={[styles.chip, item.name === category && styles.chipOn]}><Ionicons name={item.icon} size={14} color={item.name === category ? "#FFFFFF" : "#59647A"} /><Text style={[styles.chipText, item.name === category && styles.chipTextOn]}>{item.name}</Text></Pressable>)}</ScrollView> : null}

          {loading ? <View style={styles.loading}><ActivityIndicator color="#8066DB" /><Text style={styles.loadingText}>Loading real {category.toLowerCase()} nearby…</Text></View> : null}

          <View style={styles.grid}>
            {section === "picks" ? filteredPlaces.map((place) => <AllPlaceCard key={place.id} place={place} columns={columns} onOpen={() => openPlace(place)} />) : null}
            {section === "packages" ? filteredPackages.map((item) => <AllPackageCard key={item.id} item={item} columns={columns} />) : null}
            {section === "agencies" ? filteredAgencies.map((item) => <AllAgencyCard key={item.id} item={item} columns={columns} />) : null}
          </View>

          {!loading && ((section === "picks" && !filteredPlaces.length) || (section === "packages" && !filteredPackages.length) || (section === "agencies" && !filteredAgencies.length)) ? <View style={styles.empty}><Ionicons name="search-outline" size={28} color="#8D76DD" /><Text style={styles.emptyTitle}>Nothing matched that search</Text><Text style={styles.emptyText}>Try a shorter place, package, destination, or agency name.</Text></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AllPlaceCard({ place, columns, onOpen }: { place: DiscoverPlace; columns: number; onOpen(): void }) {
  return <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, { flexBasis: `${100 / columns - 1.5}%` }, pressed && styles.pressed]}><View style={styles.image}><Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /></View><View style={styles.copy}><Text numberOfLines={1} style={styles.cardTitle}>{place.name}</Text><Text style={styles.rating}>★ {place.rating.toFixed(1)} <Text style={styles.ratingMuted}>({ratingCount(place.id)})</Text></Text><View style={styles.meta}><Ionicons name="location-outline" size={12} color="#8792A6" /><Text numberOfLines={1} style={styles.metaText}>{place.distance}</Text></View><View style={styles.meta}><Ionicons name={exploreCategoryIcon(place.category)} size={12} color="#8792A6" /><Text style={styles.metaText}>{place.category}</Text></View><View style={styles.focusButton}><Ionicons name="map-outline" size={14} color="#7559D9" /><Text style={styles.focusText}>Show on map</Text></View></View></Pressable>;
}

function AllPackageCard({ item, columns }: { item: DemoPackage; columns: number }) {
  return <Pressable onPress={() => Alert.alert(item.title, `${item.destination} · ${item.duration} · ${item.price} / person\n\nPlaceholder catalog item from ${item.agency}.`)} style={({ pressed }) => [styles.card, { flexBasis: `${100 / columns - 1.5}%` }, pressed && styles.pressed]}><View style={styles.image}><Image source={{ uri: item.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /></View><View style={styles.copy}><Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text><Text style={styles.price}>{item.price} <Text style={styles.ratingMuted}>/ person</Text></Text><View style={styles.meta}><Ionicons name="location-outline" size={12} color="#8792A6" /><Text style={styles.metaText}>{item.destination}</Text></View><View style={styles.meta}><Ionicons name="time-outline" size={12} color="#8792A6" /><Text style={styles.metaText}>{item.duration}</Text></View><Text style={styles.provider}>✦ {item.agency}</Text><View style={styles.previewButton}><Text style={styles.previewText}>Preview package</Text></View></View></Pressable>;
}

function AllAgencyCard({ item, columns }: { item: DemoAgency; columns: number }) {
  return <Pressable onPress={() => Alert.alert(item.name, `${item.tagline}\n\n${item.specialty} · ★ ${item.rating}\n\nPlaceholder partner profile.`)} style={({ pressed }) => [styles.card, { flexBasis: `${100 / columns - 1.5}%` }, pressed && styles.pressed]}><View style={styles.image}><Image source={{ uri: item.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /><LinearGradient colors={["transparent", "rgba(26,35,55,.34)"]} style={StyleSheet.absoluteFillObject} /><View style={styles.initials}><Text style={styles.initialsText}>{item.initials}</Text></View></View><View style={styles.copy}><View style={styles.row}><Text numberOfLines={1} style={[styles.cardTitle, { flex: 1 }]}>{item.name}</Text><Text style={styles.rating}>★ {item.rating}</Text></View><Text numberOfLines={2} style={styles.description}>{item.tagline}</Text><View style={styles.meta}><Ionicons name="compass-outline" size={12} color="#8792A6" /><Text numberOfLines={1} style={styles.metaText}>{item.specialty}</Text></View><View style={styles.previewButton}><Text style={styles.previewText}>Preview agency</Text></View></View></Pressable>;
}

function normalizeCategory(value?: string): ExploreCategory {
  const decoded = value ? decodeURIComponent(value) : "Attractions";
  const match = EXPLORE_CATEGORIES.find((item) => item.name === decoded);
  return match?.name ?? "Attractions";
}
function filterPlaces(places: DiscoverPlace[], query: string) { const q = query.trim().toLowerCase(); if (!q) return places; return places.filter((place) => `${place.name} ${place.subtitle} ${place.category}`.toLowerCase().includes(q)); }
function mapWorldPlace(item: WorldPlaceResult, category: ExploreCategory, index: number, origin: { latitude: number; longitude: number }): DiscoverPlace { return { id: item.id, name: item.name, subtitle: item.displayName, city: item.city, country: item.country, latitude: item.latitude, longitude: item.longitude, imageUrl: CATEGORY_FALLBACK_IMAGES[category], rating: Math.min(4.9, 4.5 + (index % 4) * .1), distance: humanDistance(origin.latitude, origin.longitude, item.latitude, item.longitude), category }; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FBFCFF"},content:{paddingHorizontal:18,paddingTop:12,paddingBottom:80},max:{width:"100%",maxWidth:1180,alignSelf:"center"},header:{flexDirection:"row",alignItems:"flex-start",gap:12},back:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E5E8EF"},headerCopy:{flex:1,minWidth:0},eyebrow:{color:"#8062E0",fontSize:8.5,fontWeight:"900",letterSpacing:.7},title:{marginTop:3,color:"#17203A",fontSize:28,lineHeight:34,fontWeight:"900",letterSpacing:-.8},subtitle:{marginTop:4,color:"#7F899E",fontSize:10,lineHeight:14,fontWeight:"600"},search:{marginTop:17,minHeight:52,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:14,borderRadius:18,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E7E9EF"},searchInput:{flex:1,color:"#25304A",fontSize:11,fontWeight:"600"},chips:{gap:8,paddingTop:12,paddingBottom:14},chip:{minHeight:34,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:12,borderRadius:17,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E6E9EF"},chipOn:{backgroundColor:"#9D8AE4",borderColor:"#9D8AE4"},chipText:{color:"#566176",fontSize:8.5,fontWeight:"800"},chipTextOn:{color:"#FFFFFF"},loading:{minHeight:100,alignItems:"center",justifyContent:"center",gap:8},loadingText:{color:"#7F899E",fontSize:9,fontWeight:"700"},grid:{flexDirection:"row",flexWrap:"wrap",gap:12,alignItems:"stretch"},card:{minWidth:220,overflow:"hidden",borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E5E8EF",boxShadow:"0 10px 24px rgba(49,58,82,.07)"},image:{height:154,backgroundColor:"#E9EEF5"},copy:{padding:12},cardTitle:{color:"#202A43",fontSize:11,fontWeight:"900"},rating:{marginTop:4,color:"#E2A02B",fontSize:8.2,fontWeight:"900"},ratingMuted:{color:"#98A1B1",fontSize:7.5,fontWeight:"700"},meta:{marginTop:5,flexDirection:"row",alignItems:"center",gap:4},metaText:{flex:1,minWidth:0,color:"#7E899E",fontSize:7.8,fontWeight:"600"},focusButton:{marginTop:10,minHeight:34,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderRadius:14,backgroundColor:"#F4F0FF"},focusText:{color:"#7559D9",fontSize:8.2,fontWeight:"900"},price:{marginTop:5,color:"#25304A",fontSize:10.5,fontWeight:"900"},provider:{marginTop:6,color:"#8062E0",fontSize:7.5,fontWeight:"800"},previewButton:{marginTop:10,minHeight:34,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#F3EEFF"},previewText:{color:"#7056D0",fontSize:8.1,fontWeight:"900"},initials:{position:"absolute",left:10,bottom:10,width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#40506A",borderWidth:2,borderColor:"#FFFFFF"},initialsText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},row:{flexDirection:"row",alignItems:"center",gap:7},description:{marginTop:6,minHeight:28,color:"#7B859A",fontSize:8,lineHeight:12,fontWeight:"600"},empty:{minHeight:220,alignItems:"center",justifyContent:"center"},emptyTitle:{marginTop:9,color:"#273149",fontSize:12,fontWeight:"900"},emptyText:{marginTop:4,color:"#8993A5",fontSize:9,fontWeight:"600"},pressed:{opacity:.72}
});
