import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { useHomeDashboard } from "@/features/home/hooks/useHomeDashboard";
import { useHomeFavorites } from "@/features/home/hooks/useHomeFavorites";
import type { HomeListing } from "@/features/home/types/home.types";
import { formatMoney } from "@/features/home/utils/home-normalizers";
import { savePendingInquiry } from "@/features/home/utils/home-storage";

function href(value: string): Href { return value as Href; }

export function PackageDetailsScreen() {
  const router = useRouter();
  const { packageId: raw } = useLocalSearchParams<{ packageId: string }>();
  const packageId = String(raw ?? "");
  const { user } = useAuth();
  const dashboard = useHomeDashboard(user?.id);
  const favorites = useHomeFavorites(user?.id);
  const tour = dashboard.data?.tours.find((item) => String(item.id) === packageId) ?? null;
  const agency = tour ? dashboard.data?.agencies.find((item) => String(item.id) === String(tour.agencyId)) ?? null : null;
  const listing: HomeListing | null = tour ? { type: "tour", item: tour } : null;

  async function inquire() {
    if (!tour || !user?.id) return;
    await savePendingInquiry({ type: "tour", item: tour });
    const agencyId = String(tour.agencyId ?? "travel-agency");
    const roomId = `agency-${agencyId}-traveler-${user.id}`;
    router.push({ pathname: `/chat/${roomId}` as never, params: { agencyId, agencyName: agency?.name ?? "Travel agency", packageId: String(tour.id), packageTitle: tour.title, packagePrice: String(tour.price), packageCurrency: tour.currencyCode, packageImage: tour.imageUrl ?? "", packageDestination: tour.destination ?? "", packageDays: String(tour.durationDays || 0), packageNights: String(tour.durationNights || 0) } } as never);
  }

  if (!dashboard.data && dashboard.isLoading) return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.center}><ActivityIndicator color="#2C2F34"/><Text style={s.centerText}>Loading package…</Text></View></SafeAreaView>;
  if (!tour) return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.center}><View style={s.emptyIcon}><Ionicons name="briefcase-outline" size={28} color="#34383E"/></View><Text style={s.emptyTitle}>Package unavailable</Text><Text style={s.centerText}>This package is not in the current TRAVA catalog or cached dashboard.</Text><Pressable onPress={() => router.back()} style={s.darkButton}><Text style={s.darkText}>Go back</Text></Pressable></View></SafeAreaView>;

  const saved = listing ? favorites.isFavorite(listing) : false;
  const highlights = [
    `Explore ${tour.destination || tour.country || "your destination"} with a curated travel plan`,
    `${tour.durationDays || 1} day${tour.durationDays === 1 ? "" : "s"}${tour.durationNights ? ` and ${tour.durationNights} nights` : ""} of coordinated travel`,
    agency ? `Planned and supported by ${agency.name}` : "Travel support available through TRAVA messaging",
    "Confirm exact inclusions, dates and terms directly with the travel agency before booking",
  ];

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
    <View style={s.top}><Pressable onPress={() => router.back()} style={s.circle}><Ionicons name="chevron-back" size={23} color="#23262B"/></Pressable><Text style={s.topTitle}>Package details</Text><Pressable onPress={() => listing && favorites.toggleFavorite(listing)} style={s.circle}><Ionicons name={saved ? "heart" : "heart-outline"} size={21} color="#23262B"/></Pressable></View>

    <View style={s.cover}>{tour.imageUrl ? <Image source={{ uri: tour.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill}/> : <View style={s.coverFallback}><Ionicons name="image-outline" size={38} color="#73777D"/></View>}<View style={s.coverShade}/><View style={s.coverMeta}><Text style={s.coverTag}>{tour.category || "CURATED TRIP"}</Text><Text style={s.coverTitle}>{tour.title}</Text><Text style={s.coverDestination}>{tour.destination || tour.country || "Destination"}</Text></View></View>

    <View style={s.headRow}><View style={{ flex: 1 }}><Text style={s.title}>{tour.title}</Text><View style={s.metaRow}><Meta icon="calendar-outline" text={`${tour.durationDays || 1} Days${tour.durationNights ? ` · ${tour.durationNights} Nights` : ""}`}/><Meta icon="location-outline" text={tour.destination || tour.country || "Destination"}/></View></View><View style={s.priceBox}><Text style={s.price}>{formatMoney(tour.price, tour.currencyCode)}</Text><Text style={s.per}>per person</Text></View></View>

    {tour.description ? <Text style={s.description}>{tour.description}</Text> : <Text style={s.description}>A curated TRAVA travel package with destination, duration and agency context ready for inquiry and migration into a complete booking workflow.</Text>}

    <View style={s.metrics}><Metric icon="bed-outline" title="Stay" subtitle="Confirm with agency"/><Metric icon="car-outline" title="Transport" subtitle="See inclusions"/><Metric icon="restaurant-outline" title="Meals" subtitle="Package terms"/><Metric icon="people-outline" title="Guide" subtitle="If included"/></View>

    <Section title="Highlights">{highlights.map((text) => <View key={text} style={s.point}><Ionicons name="checkmark-circle-outline" size={18} color="#3F444B"/><Text style={s.pointText}>{text}</Text></View>)}</Section>

    <Section title="Package information"><InfoRow label="Destination" value={tour.destination || tour.country || "Not specified"}/><InfoRow label="Duration" value={`${tour.durationDays || 1} days${tour.durationNights ? ` / ${tour.durationNights} nights` : ""}`}/><InfoRow label="Price" value={formatMoney(tour.price, tour.currencyCode)}/><InfoRow label="Category" value={tour.category || "Travel package"}/></Section>

    {agency ? <Pressable onPress={() => router.push(href(`/agency/${encodeURIComponent(String(agency.id))}`))} style={s.agency}><View style={s.agencyLogo}>{agency.logoUrl ? <Image source={{ uri: agency.logoUrl }} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Text style={s.agencyLetter}>{agency.name.slice(0,1).toUpperCase()}</Text>}</View><View style={{flex:1}}><Text style={s.agencyLabel}>TRAVEL AGENCY</Text><Text style={s.agencyName}>{agency.name}</Text><Text numberOfLines={1} style={s.agencySub}>{agency.subtitle || "TRAVA travel partner"}</Text></View><Ionicons name="chevron-forward" size={20} color="#686D75"/></Pressable> : null}

    <View style={s.security}><Ionicons name="shield-checkmark-outline" size={20} color="#3B4047"/><Text style={s.securityText}>For your safety, confirm pricing, inclusions and payment terms inside TRAVA. Package inquiry does not transfer funds.</Text></View>

    <View style={s.actions}><Pressable onPress={() => listing && favorites.toggleFavorite(listing)} style={s.secondary}><Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={19} color="#292D32"/><Text style={s.secondaryText}>{saved ? "Saved" : "Save package"}</Text></Pressable><Pressable onPress={() => void inquire()} style={s.primary}><Ionicons name="chatbubble-ellipses-outline" size={19} color="#FFF"/><Text style={s.primaryText}>Inquire in chat</Text></Pressable></View>
  </View></ScrollView></SafeAreaView>;
}

function Meta({ icon, text }: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }) { return <View style={s.metaPill}><Ionicons name={icon} size={14} color="#555A61"/><Text style={s.metaText}>{text}</Text></View>; }
function Metric({ icon, title, subtitle }: { icon: ComponentProps<typeof Ionicons>["name"]; title: string; subtitle: string }) { return <View style={s.metric}><Ionicons name={icon} size={21} color="#30343A"/><Text style={s.metricTitle}>{title}</Text><Text style={s.metricSub}>{subtitle}</Text></View>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text><View style={s.sectionBody}>{children}</View></View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={s.infoRow}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value}</Text></View>; }

const s = StyleSheet.create({safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:18,paddingBottom:120},max:{width:"100%",maxWidth:760,alignSelf:"center"},top:{height:58,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},circle:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F7F8",borderWidth:1,borderColor:"#E2E3E5"},topTitle:{color:"#1A1D21",fontSize:16,fontWeight:"900"},cover:{marginTop:10,height:330,borderRadius:32,overflow:"hidden",backgroundColor:"#EEE",borderWidth:1,borderColor:"#DFE0E2"},coverFallback:{flex:1,alignItems:"center",justifyContent:"center"},coverShade:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(13,15,18,.24)"},coverMeta:{position:"absolute",left:22,right:22,bottom:22},coverTag:{alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:5,borderRadius:9,overflow:"hidden",backgroundColor:"rgba(255,255,255,.88)",color:"#33373D",fontSize:8,fontWeight:"900",letterSpacing:.7},coverTitle:{marginTop:10,color:"#FFF",fontSize:30,lineHeight:35,fontWeight:"900",letterSpacing:-.8},coverDestination:{marginTop:4,color:"rgba(255,255,255,.88)",fontSize:11,fontWeight:"700"},headRow:{marginTop:20,flexDirection:"row",gap:16,alignItems:"flex-start"},title:{color:"#15181C",fontSize:27,lineHeight:32,fontWeight:"900",letterSpacing:-.6},metaRow:{marginTop:10,flexDirection:"row",flexWrap:"wrap",gap:7},metaPill:{height:34,paddingHorizontal:10,borderRadius:17,flexDirection:"row",alignItems:"center",gap:5,backgroundColor:"#F6F6F7",borderWidth:1,borderColor:"#E2E3E5"},metaText:{color:"#5F646C",fontSize:9,fontWeight:"750"},priceBox:{alignItems:"flex-end"},price:{color:"#181B1F",fontSize:23,fontWeight:"900"},per:{marginTop:3,color:"#858A91",fontSize:8,fontWeight:"700"},description:{marginTop:16,color:"#595E66",fontSize:12,lineHeight:20,fontWeight:"600"},metrics:{marginTop:19,flexDirection:"row",gap:8},metric:{flex:1,minHeight:92,padding:11,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:"#F8F8F8",borderWidth:1,borderColor:"#E2E3E5"},metricTitle:{marginTop:6,color:"#272B30",fontSize:10,fontWeight:"900"},metricSub:{marginTop:2,color:"#81868E",fontSize:7,textAlign:"center",fontWeight:"650"},section:{marginTop:22},sectionTitle:{color:"#1E2227",fontSize:16,fontWeight:"900"},sectionBody:{marginTop:10,gap:9},point:{flexDirection:"row",alignItems:"flex-start",gap:9},pointText:{flex:1,color:"#555A62",fontSize:10,lineHeight:16,fontWeight:"650"},infoRow:{minHeight:47,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#E3E4E6"},infoLabel:{color:"#858990",fontSize:9,fontWeight:"700"},infoValue:{flex:1,textAlign:"right",color:"#292D32",fontSize:10,fontWeight:"850"},agency:{marginTop:22,minHeight:84,padding:12,borderRadius:22,flexDirection:"row",alignItems:"center",gap:11,backgroundColor:"#F8F8F8",borderWidth:1,borderColor:"#E1E2E4"},agencyLogo:{width:56,height:56,borderRadius:28,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#E9E9EA"},agencyLetter:{color:"#31353A",fontSize:20,fontWeight:"900"},agencyLabel:{color:"#8B8F96",fontSize:7,fontWeight:"900",letterSpacing:.7},agencyName:{marginTop:2,color:"#25292E",fontSize:13,fontWeight:"900"},agencySub:{marginTop:3,color:"#7B8087",fontSize:8,fontWeight:"650"},security:{marginTop:18,padding:13,borderRadius:18,flexDirection:"row",alignItems:"flex-start",gap:9,backgroundColor:"#F6F6F7",borderWidth:1,borderColor:"#E0E1E3"},securityText:{flex:1,color:"#666B72",fontSize:9,lineHeight:15,fontWeight:"650"},actions:{marginTop:18,flexDirection:"row",gap:9},secondary:{flex:1,height:52,borderRadius:17,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderWidth:1,borderColor:"#D8D9DC",backgroundColor:"#FFF"},secondaryText:{color:"#292D32",fontSize:10,fontWeight:"900"},primary:{flex:1.25,height:52,borderRadius:17,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#25282D"},primaryText:{color:"#FFF",fontSize:10,fontWeight:"900"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:28,gap:10},centerText:{maxWidth:360,textAlign:"center",color:"#777C84",fontSize:10,lineHeight:16,fontWeight:"650"},emptyIcon:{width:64,height:64,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#F2F2F3"},emptyTitle:{color:"#25292E",fontSize:20,fontWeight:"900"},darkButton:{marginTop:7,height:46,paddingHorizontal:18,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#282B30"},darkText:{color:"#FFF",fontSize:10,fontWeight:"900"}});
