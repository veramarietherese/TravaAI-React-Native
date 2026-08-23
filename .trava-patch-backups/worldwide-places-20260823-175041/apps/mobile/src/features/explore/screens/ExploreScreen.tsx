import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { apiRequest } from "@/lib/api-client";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import { readSavedPlaces, writeSavedPlaces } from "../utils/discover-storage";

type SearchResult = { id: string; name: string; displayName: string; city?: string | null; country?: string | null; latitude: number; longitude: number };
type Category = "Cafes" | "Food" | "Shopping" | "Hiking" | "Work" | "Parks";

const CATEGORIES: Array<{ name: Category; emoji: string; query: string }> = [
  { name: "Cafes", emoji: "☕", query: "cafes" },
  { name: "Food", emoji: "🍴", query: "restaurants" },
  { name: "Shopping", emoji: "🛍️", query: "shopping" },
  { name: "Hiking", emoji: "🥾", query: "hiking trails" },
  { name: "Work", emoji: "💼", query: "coworking" },
  { name: "Parks", emoji: "🌲", query: "parks" },
];

const IMAGES = {
  cafe: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=88",
  food: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=88",
  shop: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=88",
  park: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=88",
  city: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=88",
  night: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=1200&q=88",
};

const RIGA_PLACES: DiscoverPlace[] = [
  { id: "rocket-bean", name: "Rocket Bean", subtitle: "Cafe · Miera iela 12, Riga", latitude: 56.9635, longitude: 24.1298, imageUrl: IMAGES.cafe, rating: 4.8, distance: "250 m", category: "Cafes" },
  { id: "vina-studija", name: "Vina Studija", subtitle: "Restaurant · Krišjāņa Valdemāra iela 23", latitude: 56.9576, longitude: 24.1127, imageUrl: IMAGES.food, rating: 4.7, distance: "450 m", category: "Food" },
  { id: "baltic-concept", name: "BALTIC Concept", subtitle: "Shopping · Elizabetes iela 33", latitude: 56.9545, longitude: 24.1167, imageUrl: IMAGES.shop, rating: 4.6, distance: "650 m", category: "Shopping" },
  { id: "mezaparks", name: "Mežaparks", subtitle: "Park · Mežaparks, Riga", latitude: 57.0052, longitude: 24.1598, imageUrl: IMAGES.park, rating: 4.9, distance: "1.8 km", category: "Parks" },
  { id: "old-riga", name: "Old Riga", subtitle: "Landmark · Centrs, Riga", latitude: 56.9496, longitude: 24.1052, imageUrl: IMAGES.city, rating: 4.9, distance: "350 m", category: "Hiking" },
  { id: "milt-coffee", name: "MiiT Coffee", subtitle: "Cafe · 350 m", latitude: 56.9581, longitude: 24.1186, imageUrl: IMAGES.night, rating: 4.9, distance: "350 m", category: "Cafes" },
];

function imageFor(category: Category, index: number) {
  if (category === "Cafes") return index % 2 ? IMAGES.night : IMAGES.cafe;
  if (category === "Food") return IMAGES.food;
  if (category === "Shopping") return IMAGES.shop;
  if (category === "Parks" || category === "Hiking") return IMAGES.park;
  return IMAGES.city;
}

export function ExploreScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const avatarUrl = profile?.avatar_url || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [remote, setRemote] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(RIGA_PLACES[0].id);
  const [saved, setSaved] = useState<string[]>([]);
  const requestId = useRef(0);

  useEffect(() => { void readSavedPlaces().then(setSaved); }, []);

  useEffect(() => {
    const base = query.trim();
    const categoryQuery = activeCategory ? CATEGORIES.find((item) => item.name === activeCategory)?.query ?? activeCategory : "";
    const text = base || (activeCategory ? `${categoryQuery} in Riga` : "");
    if (text.length < 3) { setRemote([]); setLoading(false); return; }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await apiRequest<{ data: SearchResult[] }>(`/api/places/search?q=${encodeURIComponent(text)}`);
        if (id !== requestId.current) return;
        const category = activeCategory ?? inferCategory(text);
        const mapped = result.data.slice(0, 14).map((item, index) => ({
          id: item.id,
          name: item.name,
          subtitle: item.displayName,
          latitude: item.latitude,
          longitude: item.longitude,
          imageUrl: imageFor(category, index),
          rating: Math.min(4.9, 4.6 + (index % 4) * .1),
          distance: `${250 + index * 120} m`,
          category,
        } satisfies DiscoverPlace));
        setRemote(mapped);
        if (mapped[0]) setSelectedId(mapped[0].id);
      } catch {
        if (id === requestId.current) setRemote([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [activeCategory, query]);

  const places = remote.length ? remote : activeCategory ? RIGA_PLACES.filter((item) => item.category === activeCategory) : RIGA_PLACES;
  const visible = places.length ? places : RIGA_PLACES;
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? RIGA_PLACES[0];

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      void writeSavedPlaces(next);
      return next;
    });
  }

  function startVoiceSearch() {
    if (query) { setQuery(""); return; }
    if (Platform.OS !== "web") { Alert.alert("Voice search", "Voice search is available on supported browsers in this build."); return; }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => { lang:string; interimResults:boolean; onresult:((event:{results:ArrayLike<{0?:{transcript?:string}}>} )=>void)|null; onerror:(()=>void)|null; start():void };
      webkitSpeechRecognition?: new () => { lang:string; interimResults:boolean; onresult:((event:{results:ArrayLike<{0?:{transcript?:string}}>} )=>void)|null; onerror:(()=>void)|null; start():void };
    };
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Speech) { Alert.alert("Voice search", "Voice search is not supported by this browser."); return; }
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript?.trim(); if (transcript) setQuery(transcript); };
    recognition.onerror = () => Alert.alert("Voice search", "TRAVA could not hear that. Try again or type your search.");
    recognition.start();
  }

  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.max}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} style={styles.avatar}>
            {avatarUrl ? <Image source={{uri:avatarUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Ionicons name="person" size={25} color="#17213A"/>}
            <View style={styles.avatarBadge}><Text style={styles.avatarBadgeText}>3</Text></View>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={29} color="#74819A" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search places, cafes, parks, landmarks…" placeholderTextColor="#8E9AB0" autoCorrect={false} style={styles.searchInput} />
          {loading ? <ActivityIndicator size="small" color="#4F73FF"/> : <Pressable accessibilityLabel={query ? "Clear search" : "Voice search"} onPress={startVoiceSearch} style={styles.voiceButton}><Ionicons name={query ? "close" : "mic"} size={21} color="#3267FF"/></Pressable>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((item) => <Pressable key={item.name} onPress={() => setActiveCategory((current) => current === item.name ? null : item.name)} style={[styles.chip, activeCategory === item.name && styles.chipOn]}><Text style={styles.chipEmoji}>{item.emoji}</Text><Text style={[styles.chipText, activeCategory === item.name && styles.chipTextOn]}>{item.name}</Text></Pressable>)}
        </ScrollView>

        <DiscoverMap places={visible} selectedId={selected.id} onSelect={setSelectedId}/>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={264} contentContainerStyle={styles.cards}>
          {visible.map((place) => <Pressable key={place.id} onPress={() => setSelectedId(place.id)} style={styles.placeCard}>
            <View style={styles.placeImageWrap}><Image source={{uri:place.imageUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/><Pressable accessibilityLabel={saved.includes(place.id)?"Remove from saved":"Save place"} onPress={(event) => { event.stopPropagation?.(); toggleSaved(place.id); }} style={styles.heart}><Ionicons name={saved.includes(place.id)?"heart":"heart-outline"} size={22} color={saved.includes(place.id)?"#FF4B78":"#506079"}/></Pressable></View>
            <Text numberOfLines={1} style={styles.placeName}>{place.name}</Text>
            <Text style={styles.placeCategory}>{categoryLabel(place.category)}</Text>
            <Text numberOfLines={1} style={styles.placeAddress}>{addressOnly(place.subtitle)}</Text>
            <View style={styles.placeBottom}><Text style={styles.placeRating}>★ <Text style={styles.placeRatingNumber}>{place.rating.toFixed(1)}</Text></Text><Text style={styles.placeDistance}>{place.distance}</Text></View>
          </Pressable>)}
        </ScrollView>

        <View style={styles.featured}>
          <Image source={{uri:selected.imageUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/>
          <LinearGradient colors={["rgba(255,255,255,.99)","rgba(255,255,255,.95)","rgba(255,255,255,.60)","rgba(255,255,255,.03)"]} locations={[0,.34,.62,1]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={StyleSheet.absoluteFill}/>
          <View style={styles.featuredCopy}>
            <Text style={styles.featuredTag}>✦ Featured</Text>
            <Text style={styles.featuredTitle}>{selected.name}</Text>
            <Text style={styles.featuredMeta}>{categoryLabel(selected.category)}  ·  ♧ {selected.distance}</Text>
            <Text numberOfLines={2} style={styles.featuredDescription}>Specialty coffee, fresh pastries and a cozy atmosphere in the heart of the city.</Text>
            <Text style={styles.featuredRating}>★ <Text style={styles.featuredRatingNumber}>{selected.rating.toFixed(1)} (512)</Text></Text>
            <Pressable onPress={() => setSelectedId(selected.id)} style={styles.detailsPress}><LinearGradient colors={["#3D6FFF","#B073FA","#FF7BB1"]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={styles.detailsButton}><Text style={styles.detailsText}>View Details</Text><Ionicons name="chevron-forward" size={19} color="#FFF"/></LinearGradient></Pressable>
          </View>
          <Pressable accessibilityLabel={saved.includes(selected.id)?"Remove from saved":"Save featured place"} onPress={() => toggleSaved(selected.id)} style={styles.featuredHeart}><Ionicons name={saved.includes(selected.id)?"heart":"heart-outline"} size={26} color={saved.includes(selected.id)?"#FF4B78":"#263550"}/></Pressable>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function inferCategory(text: string): Category {
  const q=text.toLowerCase();
  if(q.includes("cafe")||q.includes("coffee"))return "Cafes";
  if(q.includes("restaurant")||q.includes("food"))return "Food";
  if(q.includes("shop")||q.includes("mall"))return "Shopping";
  if(q.includes("park"))return "Parks";
  if(q.includes("hike")||q.includes("trail"))return "Hiking";
  return "Work";
}
function categoryLabel(category: string){ return category === "Food" ? "Restaurant" : category === "Parks" ? "Park" : category === "Cafes" ? "Cafe" : category; }
function addressOnly(subtitle:string){ const parts=subtitle.split(" · "); return parts.length>1?parts.slice(1).join(" · "):subtitle; }

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{paddingHorizontal:22,paddingTop:12,paddingBottom:130},max:{width:"100%",maxWidth:860,alignSelf:"center"},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:24},title:{color:"#101A35",fontSize:52,lineHeight:59,fontWeight:"900",letterSpacing:-1.8},avatar:{width:58,height:58,borderRadius:29,overflow:"visible",backgroundColor:"#EEF1F6",borderWidth:4,borderColor:"#FFF",boxShadow:"0 8px 20px rgba(36,48,76,.12)"},avatarBadge:{position:"absolute",right:-4,top:-8,minWidth:24,height:24,borderRadius:12,paddingHorizontal:5,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4B78",borderWidth:2,borderColor:"#FFF"},avatarBadgeText:{color:"#FFF",fontSize:11,fontWeight:"900"},
  search:{minHeight:72,paddingHorizontal:22,borderRadius:24,flexDirection:"row",alignItems:"center",gap:15,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E3E7EE",boxShadow:"0 11px 26px rgba(43,57,85,.07)"},searchInput:{flex:1,minWidth:0,minHeight:68,color:"#17213B",fontSize:17,fontWeight:"600"},voiceButton:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F9FF",borderWidth:1,borderColor:"#E8ECF4"},
  chips:{gap:11,paddingVertical:20,paddingRight:15},chip:{height:52,paddingHorizontal:18,borderRadius:26,flexDirection:"row",alignItems:"center",gap:9,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E3E7EE",boxShadow:"0 7px 18px rgba(36,50,78,.05)"},chipOn:{backgroundColor:"#F5F7FF",borderColor:"#C9D5FF"},chipEmoji:{fontSize:18},chipText:{color:"#18223A",fontSize:13,fontWeight:"800"},chipTextOn:{color:"#315AE9"},
  cards:{gap:14,paddingTop:18,paddingRight:40},placeCard:{width:250,overflow:"hidden",borderRadius:24,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E4E8EF",boxShadow:"0 12px 26px rgba(41,55,82,.08)"},placeImageWrap:{height:150,position:"relative"},heart:{position:"absolute",right:11,top:11,width:39,height:39,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.96)",borderWidth:1,borderColor:"rgba(226,230,237,.95)",boxShadow:"0 5px 13px rgba(30,45,73,.12)"},placeName:{marginTop:14,paddingHorizontal:14,color:"#111A34",fontSize:17,fontWeight:"900"},placeCategory:{marginTop:5,paddingHorizontal:14,color:"#7658FF",fontSize:12,fontWeight:"700"},placeAddress:{marginTop:7,paddingHorizontal:14,color:"#77849A",fontSize:11,fontWeight:"600"},placeBottom:{marginTop:13,paddingHorizontal:14,paddingBottom:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},placeRating:{color:"#FFB800",fontSize:13,fontWeight:"900"},placeRatingNumber:{color:"#263550"},placeDistance:{color:"#8190A7",fontSize:11,fontWeight:"700"},
  featured:{height:315,marginTop:24,overflow:"hidden",borderRadius:28,backgroundColor:"#EEF1F5",borderWidth:1,borderColor:"#E0E5ED",boxShadow:"0 16px 36px rgba(39,54,83,.10)"},featuredCopy:{width:"54%",height:"100%",padding:28,justifyContent:"center"},featuredTag:{alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:5,borderRadius:8,overflow:"hidden",backgroundColor:"#F3E9FF",color:"#9561FF",fontSize:10,fontWeight:"800"},featuredTitle:{marginTop:15,color:"#111A34",fontSize:30,lineHeight:35,fontWeight:"900",letterSpacing:-.6},featuredMeta:{marginTop:8,color:"#7C5BFF",fontSize:12,fontWeight:"700"},featuredDescription:{marginTop:12,color:"#32405C",fontSize:12,lineHeight:18,fontWeight:"600"},featuredRating:{marginTop:12,color:"#FFB800",fontSize:17,fontWeight:"900"},featuredRatingNumber:{color:"#273650",fontSize:12},detailsPress:{marginTop:16,width:180},detailsButton:{height:52,borderRadius:26,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},detailsText:{color:"#FFF",fontSize:13,fontWeight:"900"},featuredHeart:{position:"absolute",right:18,top:18,width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.96)",boxShadow:"0 7px 18px rgba(35,48,75,.12)"},
});
