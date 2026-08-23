import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { apiRequest } from "@/lib/api-client";
import { DiscoverMap, type DiscoverPlace } from "../components/DiscoverMap";
import { readSavedPlaces, writeSavedPlaces } from "../utils/discover-storage";

type SearchResult = { id: string; name: string; displayName: string; city?: string | null; country?: string | null; latitude: number; longitude: number };
const CATEGORIES = ["Popular", "Cafes", "Nature", "Food", "Landmarks", "Hidden Gems"] as const;
const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=82",
];
const DEFAULTS: DiscoverPlace[] = [
  { id: "riga-old-town", name: "City of Lights", subtitle: "Old Town · Historical · Culture", latitude: 56.9496, longitude: 24.1052, imageUrl: IMAGE_POOL[0], rating: 4.8, distance: "325 m", category: "Landmarks" },
  { id: "riverside", name: "Erik’s Bay", subtitle: "Water · Nature · Relax", latitude: 56.945, longitude: 24.095, imageUrl: IMAGE_POOL[1], rating: 4.9, distance: "450 m", category: "Nature" },
  { id: "santorini-view", name: "Santorini View", subtitle: "Scenic · Ocean · Sunset", latitude: 56.954, longitude: 24.116, imageUrl: IMAGE_POOL[2], rating: 4.7, distance: "650 m", category: "Popular" },
  { id: "hidden-gem", name: "Quiet Courtyard", subtitle: "Hidden Gem · Local · Architecture", latitude: 56.941, longitude: 24.111, imageUrl: IMAGE_POOL[3], rating: 4.8, distance: "780 m", category: "Hidden Gems" },
];

function fromSearch(item: SearchResult, index: number): DiscoverPlace { return { id: item.id, name: item.name, subtitle: item.displayName, latitude: item.latitude, longitude: item.longitude, imageUrl: IMAGE_POOL[index % IMAGE_POOL.length], rating: 4.7 + (index % 3) * .1, distance: `${Math.max(180, 300 + index * 125)} m`, category: "Popular" }; }

export function ExploreScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const avatarUrl = profile?.avatar_url || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Popular");
  const [remote, setRemote] = useState<DiscoverPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(DEFAULTS[0].id);
  const [saved, setSaved] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => { void readSavedPlaces().then(setSaved); }, []);
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) { setRemote([]); setLoading(false); return; }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await apiRequest<{ data: SearchResult[] }>(`/api/places/search?q=${encodeURIComponent(text)}`);
        if (id !== requestId.current) return;
        const mapped = result.data.map(fromSearch);
        setRemote(mapped);
        if (mapped[0]) setSelectedId(mapped[0].id);
      } catch { if (id === requestId.current) setRemote([]); }
      finally { if (id === requestId.current) setLoading(false); }
    }, 320);
    return () => clearTimeout(timer);
  }, [query]);

  const basePlaces = remote.length ? remote : DEFAULTS;
  const places = useMemo(() => category === "Popular" ? basePlaces : basePlaces.filter((p) => p.category === category || remote.length), [basePlaces, category, remote.length]);
  const visible = places.length ? places : basePlaces;
  const selected = visible.find((p) => p.id === selectedId) ?? visible[0] ?? DEFAULTS[0];

  function toggleSaved(id: string) { setSaved((current) => { const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id]; void writeSavedPlaces(next); return next; }); }

  function startVoiceSearch() {
    if (query) { setQuery(""); return; }
    if (Platform.OS !== "web") { Alert.alert("Voice search", "Use the keyboard search on this build. Voice search can be enabled later with a native speech module."); return; }
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => { lang:string; interimResults:boolean; maxAlternatives:number; onresult:((event:{results:ArrayLike<{0?:{transcript?:string}}>} )=>void)|null; onerror:(()=>void)|null; start():void }; webkitSpeechRecognition?: new () => { lang:string; interimResults:boolean; maxAlternatives:number; onresult:((event:{results:ArrayLike<{0?:{transcript?:string}}>} )=>void)|null; onerror:(()=>void)|null; start():void } };
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Speech) { Alert.alert("Voice search", "Voice search is not supported by this browser."); return; }
    const recognition = new Speech(); recognition.lang = "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript?.trim(); if (transcript) setQuery(transcript); }; recognition.onerror = () => Alert.alert("Voice search", "TRAVA could not hear that. Try again or type your search."); recognition.start();
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={s.max}>
    <View style={s.header}><Text style={s.title}>Discover</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push("/(traveler)/(tabs)/profile" as Href)} style={s.avatar}>{avatarUrl ? <Image source={{ uri: avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Ionicons name="person" size={22} color="#33363B"/>}<View style={s.badge}><Text style={s.badgeText}>2</Text></View></Pressable></View>
    <View style={s.search}><Ionicons name="search" size={22} color="#34373C"/><TextInput value={query} onChangeText={setQuery} placeholder="Search places, cafes, parks, landmarks…" placeholderTextColor="#9A9EA5" style={s.input}/>{loading ? <ActivityIndicator size="small" color="#51555C"/> : <Pressable accessibilityRole="button" accessibilityLabel={query ? "Clear search" : "Voice search"} onPress={startVoiceSearch} style={s.mic}><Ionicons name={query ? "close" : "mic-outline"} size={19} color="#5F646C"/></Pressable>}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[s.chip, category === item && s.chipOn]}><Ionicons name={item === "Cafes" ? "cafe-outline" : item === "Nature" ? "leaf-outline" : item === "Food" ? "restaurant-outline" : item === "Landmarks" ? "business-outline" : item === "Hidden Gems" ? "diamond-outline" : "sparkles-outline"} size={16} color={category === item ? "#16181C" : "#6F747C"}/><Text style={[s.chipText, category === item && s.chipTextOn]}>{item}</Text></Pressable>)}</ScrollView>
    <DiscoverMap places={visible} selectedId={selected.id} onSelect={(id) => setSelectedId(id)} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cards}>{visible.map((place) => <Pressable key={place.id} onPress={() => { setSelectedId(place.id); setDetailsOpen(true); }} style={s.card}><View style={s.cardImage}><Image source={{ uri: place.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill}/><Pressable onPress={(e) => { e.stopPropagation?.(); toggleSaved(place.id); }} style={s.heart}><Ionicons name={saved.includes(place.id) ? "heart" : "heart-outline"} size={19} color={saved.includes(place.id) ? "#1D1F23" : "#60656D"}/></Pressable></View><Text numberOfLines={1} style={s.cardTitle}>{place.name}</Text><Text numberOfLines={1} style={s.cardMeta}>{place.subtitle}</Text><View style={s.cardBottom}><Text style={s.rating}>★ {place.rating.toFixed(1)}</Text><Text style={s.distance}>{place.distance}</Text></View></Pressable>)}</ScrollView>
    <View style={s.featured}><Image source={{ uri: selected.imageUrl }} contentFit="cover" style={s.featuredImage}/><View style={s.featuredCopy}><View style={s.featuredTop}><Text style={s.featuredTag}>FEATURED</Text><Pressable onPress={() => toggleSaved(selected.id)} style={s.bookmark}><Ionicons name={saved.includes(selected.id) ? "bookmark" : "bookmark-outline"} size={20} color="#30343A"/></Pressable></View><Text style={s.featuredTitle}>{selected.name}</Text><Text numberOfLines={1} style={s.address}>⌖ {selected.subtitle}</Text><Text style={s.stars}>★★★★☆  <Text style={s.review}>{selected.rating.toFixed(1)} (1.2k reviews)</Text></Text><Text numberOfLines={2} style={s.description}>A memorable place with character, local culture, and beautiful views worth adding to your next trip.</Text><Pressable onPress={() => setDetailsOpen(true)}><Text style={s.readMore}>Read more  ›</Text></Pressable></View></View>
  </View></ScrollView>
  <Modal visible={detailsOpen} transparent animationType="fade" onRequestClose={() => setDetailsOpen(false)}><View style={s.backdrop}><View style={s.modal}><Image source={{ uri: selected.imageUrl }} contentFit="cover" style={s.modalImage}/><Pressable onPress={() => setDetailsOpen(false)} style={s.close}><Ionicons name="close" size={20} color="#22252A"/></Pressable><Text style={s.modalTitle}>{selected.name}</Text><Text style={s.modalMeta}>{selected.subtitle}</Text><Text style={s.modalBody}>Explore this place, save it to your TRAVA bucket list, or use the location when planning an itinerary.</Text><View style={s.modalActions}><Pressable onPress={() => toggleSaved(selected.id)} style={s.secondary}><Ionicons name={saved.includes(selected.id) ? "bookmark" : "bookmark-outline"} size={18} color="#23262B"/><Text style={s.secondaryText}>{saved.includes(selected.id) ? "Saved" : "Save place"}</Text></Pressable><Pressable onPress={() => setDetailsOpen(false)} style={s.primary}><Text style={s.primaryText}>Done</Text></Pressable></View></View></View></Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{paddingHorizontal:18,paddingTop:14,paddingBottom:120},max:{width:"100%",maxWidth:760,alignSelf:"center"},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:40,lineHeight:46,fontWeight:"900",letterSpacing:-1.4,color:"#111318"},avatar:{width:52,height:52,borderRadius:26,alignItems:"center",justifyContent:"center",backgroundColor:"#F4F4F5",borderWidth:1,borderColor:"#E0E1E4"},badge:{position:"absolute",right:-1,top:-2,width:19,height:19,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#202328",borderWidth:2,borderColor:"#FFF"},badgeText:{color:"#FFF",fontSize:9,fontWeight:"900"},search:{marginTop:24,height:62,borderRadius:22,paddingHorizontal:16,flexDirection:"row",alignItems:"center",gap:11,backgroundColor:"#FFF",borderWidth:1,borderColor:"#DFE0E3",boxShadow:"0 10px 28px rgba(27,29,33,.06)"},input:{flex:1,height:"100%",fontSize:14,color:"#1A1D21"},mic:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F5F6"},chips:{gap:9,paddingVertical:18,paddingRight:6},chip:{height:42,paddingHorizontal:14,borderRadius:21,flexDirection:"row",alignItems:"center",gap:7,borderWidth:1,borderColor:"#E0E1E4",backgroundColor:"#FFF"},chipOn:{backgroundColor:"#ECEDEF",borderColor:"#D0D2D6"},chipText:{fontSize:10,fontWeight:"800",color:"#6B7078"},chipTextOn:{color:"#17191D"},cards:{gap:12,paddingVertical:14,paddingRight:6},card:{width:220,padding:8,borderRadius:22,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E1E2E5",boxShadow:"0 10px 24px rgba(25,27,31,.055)"},cardImage:{height:146,borderRadius:17,overflow:"hidden",backgroundColor:"#EEE"},heart:{position:"absolute",top:8,right:8,width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.92)"},cardTitle:{marginTop:10,color:"#17191D",fontSize:14,fontWeight:"900"},cardMeta:{marginTop:4,color:"#7B8088",fontSize:9,fontWeight:"600"},cardBottom:{marginTop:12,flexDirection:"row",justifyContent:"space-between"},rating:{color:"#2B2E33",fontSize:10,fontWeight:"900"},distance:{color:"#8B9097",fontSize:9,fontWeight:"700"},featured:{marginTop:18,minHeight:245,padding:14,borderRadius:28,flexDirection:"row",gap:18,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E1E4",boxShadow:"0 12px 30px rgba(24,26,30,.06)"},featuredImage:{width:"39%",minHeight:215,borderRadius:21},featuredCopy:{flex:1,paddingVertical:5},featuredTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},featuredTag:{paddingHorizontal:8,paddingVertical:5,borderRadius:8,backgroundColor:"#EFEFF0",color:"#5D626A",fontSize:8,fontWeight:"900"},bookmark:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#E0E1E4"},featuredTitle:{marginTop:8,color:"#111318",fontSize:23,fontWeight:"900",letterSpacing:-.5},address:{marginTop:7,color:"#777C84",fontSize:10,fontWeight:"600"},stars:{marginTop:8,color:"#1C1F23",fontSize:11,fontWeight:"900"},review:{color:"#777C84",fontWeight:"600"},description:{marginTop:10,color:"#555A62",fontSize:10,lineHeight:16,fontWeight:"600"},readMore:{marginTop:10,color:"#22252A",fontSize:10,fontWeight:"900"},backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:22,backgroundColor:"rgba(15,17,20,.46)"},modal:{width:"100%",maxWidth:480,padding:18,borderRadius:28,backgroundColor:"#FFF"},modalImage:{width:"100%",height:220,borderRadius:22},close:{position:"absolute",top:28,right:28,width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.94)"},modalTitle:{marginTop:16,color:"#111318",fontSize:24,fontWeight:"900"},modalMeta:{marginTop:5,color:"#777C84",fontSize:10,fontWeight:"700"},modalBody:{marginTop:12,color:"#575C64",fontSize:11,lineHeight:18,fontWeight:"600"},modalActions:{marginTop:18,flexDirection:"row",gap:10},secondary:{flex:1,height:48,borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderWidth:1,borderColor:"#D9DADE"},secondaryText:{color:"#24272C",fontSize:10,fontWeight:"900"},primary:{flex:1,height:48,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"#22252A"},primaryText:{color:"#FFF",fontSize:10,fontWeight:"900"}
});
