import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { TourPackageCard } from "@/features/home/components/TourPackageCard";
import { useHomeDashboard } from "@/features/home/hooks/useHomeDashboard";
import { useHomeFavorites } from "@/features/home/hooks/useHomeFavorites";
import type { HomeListing } from "@/features/home/types/home.types";
import { savePendingInquiry } from "@/features/home/utils/home-storage";

function href(value: string): Href { return value as Href; }

export function AgencyDetailsScreen() {
  const router = useRouter();
  const { agencyId: raw } = useLocalSearchParams<{ agencyId: string }>();
  const agencyId = String(raw ?? "");
  const { user } = useAuth();
  const dashboard = useHomeDashboard(user?.id);
  const favorites = useHomeFavorites(user?.id);
  const agency = dashboard.data?.agencies.find((item) => String(item.id) === agencyId) ?? null;
  const tours = dashboard.data?.tours.filter((tour) => String(tour.agencyId) === agencyId) ?? [];
  const listing: HomeListing | null = agency ? { type: "agency", item: agency } : null;

  async function messageAgency(packageId?: string) {
    if (!agency || !user?.id) return;
    await savePendingInquiry({ type: "agency", item: agency });
    const roomId = `agency-${agencyId}-traveler-${user.id}`;
    const selected = packageId ? tours.find((tour) => String(tour.id) === packageId) : null;
    router.push({ pathname: `/chat/${roomId}` as never, params: { agencyId, agencyName: agency.name, packageId: selected ? String(selected.id) : "", packageTitle: selected?.title ?? "", packagePrice: selected ? String(selected.price) : "", packageCurrency: selected?.currencyCode ?? "", packageImage: selected?.imageUrl ?? "", packageDestination: selected?.destination ?? "" } } as never);
  }

  if (!dashboard.data && dashboard.isLoading) return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.center}><ActivityIndicator color="#2C2F34"/><Text style={s.muted}>Loading agency…</Text></View></SafeAreaView>;
  if (!agency) return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.center}><Ionicons name="business-outline" size={38} color="#42464D"/><Text style={s.emptyTitle}>Agency unavailable</Text><Text style={s.muted}>This agency is not in the current live or cached TRAVA directory.</Text><Pressable onPress={() => router.back()} style={s.primarySmall}><Text style={s.primaryText}>Go back</Text></Pressable></View></SafeAreaView>;

  const saved = listing ? favorites.isFavorite(listing) : false;
  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
    <View style={s.top}><Pressable onPress={() => router.back()} style={s.circle}><Ionicons name="chevron-back" size={23} color="#25282D"/></Pressable><Text style={s.topTitle}>Travel agency</Text><Pressable onPress={() => listing && favorites.toggleFavorite(listing)} style={s.circle}><Ionicons name={saved ? "heart" : "heart-outline"} size={21} color="#25282D"/></Pressable></View>

    <View style={s.profileCard}>{agency.coverImageUrl ? <Image source={{uri:agency.coverImageUrl}} contentFit="cover" style={s.cover}/> : null}<View style={s.coverShade}/><View style={s.profileInner}><View style={s.logo}>{agency.logoUrl ? <Image source={{uri:agency.logoUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Text style={s.logoLetter}>{agency.name.slice(0,1).toUpperCase()}</Text>}</View><View style={s.profileCopy}><View style={s.nameRow}><Text style={s.name}>{agency.name}</Text><Ionicons name="checkmark-circle" size={19} color="#383C42"/></View><Text style={s.subtitle}>{agency.subtitle || "Verified TRAVA travel partner"}</Text><View style={s.ratingRow}><Text style={s.rating}>★ {agency.rating > 0 ? agency.rating.toFixed(1) : "New"}</Text><Text style={s.dot}>•</Text><Text style={s.mini}>{tours.length} active package{tours.length === 1 ? "" : "s"}</Text></View></View></View></View>

    <Text style={s.description}>{agency.description || `${agency.name} is available through TRAVA for destination questions, package inquiries and itinerary planning.`}</Text>
    <View style={s.tags}>{(agency.specialties.length ? agency.specialties : ["Travel planning", "Packages", "Traveler support"]).map((tag) => <View key={tag} style={s.tag}><Text style={s.tagText}>{tag}</Text></View>)}</View>

    <View style={s.metrics}><Metric icon="chatbubble-ellipses-outline" title="Direct chat" sub="Keep inquiry history in TRAVA"/><Metric icon="shield-checkmark-outline" title="Safer inquiry" sub="No fund transfer controls"/><Metric icon="briefcase-outline" title={`${tours.length} packages`} sub="Compare published offers"/></View>

    <View style={s.security}><Ionicons name="shield-outline" size={21} color="#34383E"/><View style={{flex:1}}><Text style={s.securityTitle}>Communication-first, payment-safe</Text><Text style={s.securityText}>Use TRAVA chat to ask about dates, prices and inclusions. TRAVA messaging intentionally does not include send/request funds controls.</Text></View></View>

    <View style={s.sectionHead}><View><Text style={s.sectionTitle}>Available packages</Text><Text style={s.sectionSub}>Published packages from this agency</Text></View>{tours.length ? <Text style={s.count}>{tours.length}</Text> : null}</View>
    {tours.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tours}>{tours.map((tour) => { const item: HomeListing = { type:"tour", item:tour }; return <TourPackageCard key={String(tour.id)} tour={tour} favorite={favorites.isFavorite(item)} onToggleFavorite={() => favorites.toggleFavorite(item)} onOpen={() => router.push(href(`/package/${encodeURIComponent(String(tour.id))}`))} width={265}/>; })}</ScrollView> : <View style={s.emptyPackages}><Ionicons name="briefcase-outline" size={27} color="#777B82"/><Text style={s.muted}>No active packages are published right now.</Text></View>}

    <View style={s.actions}><Pressable onPress={() => void messageAgency()} style={s.primary}><Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFF"/><Text style={s.primaryText}>Message agency</Text></Pressable><Pressable onPress={() => listing && favorites.toggleFavorite(listing)} style={s.secondary}><Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={19} color="#292D32"/><Text style={s.secondaryText}>{saved ? "Saved agency" : "Save agency"}</Text></Pressable></View>
  </View></ScrollView></SafeAreaView>;
}

function Metric({icon,title,sub}:{icon:ComponentProps<typeof Ionicons>["name"];title:string;sub:string}){return <View style={s.metric}><Ionicons name={icon} size={22} color="#30343A"/><Text style={s.metricTitle}>{title}</Text><Text style={s.metricSub}>{sub}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:18,paddingBottom:120},max:{width:"100%",maxWidth:800,alignSelf:"center"},top:{height:58,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},circle:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F7F8",borderWidth:1,borderColor:"#E2E3E5"},topTitle:{color:"#1A1D21",fontSize:16,fontWeight:"900"},profileCard:{marginTop:10,minHeight:250,borderRadius:32,overflow:"hidden",backgroundColor:"#F0F0F0",borderWidth:1,borderColor:"#DFE0E2"},cover:{...StyleSheet.absoluteFillObject},coverShade:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(255,255,255,.76)"},profileInner:{flex:1,padding:24,flexDirection:"row",alignItems:"flex-end",gap:16},logo:{width:94,height:94,borderRadius:47,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:5,borderColor:"#FFF",boxShadow:"0 13px 28px rgba(20,22,26,.12)"},logoLetter:{fontSize:35,color:"#30343A",fontWeight:"900"},profileCopy:{flex:1,paddingBottom:5},nameRow:{flexDirection:"row",alignItems:"center",gap:7},name:{flexShrink:1,color:"#181B1F",fontSize:28,fontWeight:"900",letterSpacing:-.6},subtitle:{marginTop:5,color:"#666B72",fontSize:11,fontWeight:"700"},ratingRow:{marginTop:9,flexDirection:"row",alignItems:"center",gap:7},rating:{color:"#282C31",fontSize:10,fontWeight:"900"},dot:{color:"#9B9FA5"},mini:{color:"#7C8188",fontSize:9,fontWeight:"700"},description:{marginTop:20,color:"#595E66",fontSize:12,lineHeight:20,fontWeight:"600"},tags:{marginTop:14,flexDirection:"row",flexWrap:"wrap",gap:7},tag:{paddingHorizontal:11,paddingVertical:7,borderRadius:14,backgroundColor:"#F4F4F5",borderWidth:1,borderColor:"#E1E2E4"},tagText:{color:"#5D6269",fontSize:8,fontWeight:"850"},metrics:{marginTop:20,flexDirection:"row",gap:8},metric:{flex:1,minHeight:112,padding:13,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#F8F8F8",borderWidth:1,borderColor:"#E1E2E4"},metricTitle:{marginTop:7,color:"#292D32",fontSize:10,fontWeight:"900"},metricSub:{marginTop:4,color:"#81868D",fontSize:7,lineHeight:11,textAlign:"center",fontWeight:"650"},security:{marginTop:18,padding:15,borderRadius:21,flexDirection:"row",gap:10,backgroundColor:"#F6F6F7",borderWidth:1,borderColor:"#E0E1E3"},securityTitle:{color:"#30343A",fontSize:10,fontWeight:"900"},securityText:{marginTop:4,color:"#6B7077",fontSize:9,lineHeight:15,fontWeight:"650"},sectionHead:{marginTop:24,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{color:"#1D2024",fontSize:18,fontWeight:"900"},sectionSub:{marginTop:3,color:"#858A91",fontSize:8,fontWeight:"650"},count:{minWidth:30,height:30,paddingHorizontal:8,borderRadius:15,textAlign:"center",textAlignVertical:"center",lineHeight:30,backgroundColor:"#F0F0F1",color:"#44484F",fontSize:9,fontWeight:"900"},tours:{gap:11,paddingVertical:13,paddingRight:3},emptyPackages:{marginTop:12,minHeight:120,borderRadius:22,alignItems:"center",justifyContent:"center",gap:8,backgroundColor:"#F8F8F8",borderWidth:1,borderColor:"#E1E2E4"},actions:{marginTop:17,flexDirection:"row",gap:9},primary:{flex:1.25,height:52,borderRadius:17,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#25282D"},primarySmall:{marginTop:6,height:46,paddingHorizontal:18,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#25282D"},primaryText:{color:"#FFF",fontSize:10,fontWeight:"900"},secondary:{flex:1,height:52,borderRadius:17,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#FFF",borderWidth:1,borderColor:"#D8D9DC"},secondaryText:{color:"#292D32",fontSize:10,fontWeight:"900"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:28,gap:10},emptyTitle:{color:"#25292E",fontSize:20,fontWeight:"900"},muted:{maxWidth:360,textAlign:"center",color:"#777C84",fontSize:10,lineHeight:16,fontWeight:"650"}});
