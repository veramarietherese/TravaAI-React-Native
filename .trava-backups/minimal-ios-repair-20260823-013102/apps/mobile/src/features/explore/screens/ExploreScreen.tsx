import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { AgencyCard } from "@/features/home/components/AgencyCard";
import { TourPackageCard } from "@/features/home/components/TourPackageCard";
import { useHomeDashboard } from "@/features/home/hooks/useHomeDashboard";
import { useHomeFavorites } from "@/features/home/hooks/useHomeFavorites";
import type { HomeListing } from "@/features/home/types/home.types";

export function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const dashboard = useHomeDashboard(user?.id);
  const favorites = useHomeFavorites(user?.id);
  const [search, setSearch] = useState("");
  const data = dashboard.data;

  const tours = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.tours;
    return data.tours.filter((item) => [item.title, item.destination, item.country, item.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [data, search]);
  const agencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.agencies;
    return data.agencies.filter((item) => [item.name, item.subtitle, ...item.specialties].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [data, search]);

  return <SafeAreaView style={styles.safe} edges={["top"]}><StatusBar style="dark" /><ScrollView refreshControl={<RefreshControl refreshing={dashboard.isRefreshing} onRefresh={() => void dashboard.refresh()} tintColor="#7359ED" />} contentContainerStyle={styles.content}><View style={styles.maxWidth}>
    <View style={styles.top}><View><Text style={styles.eyebrow}>TRAVEL DISCOVERY</Text><Text style={styles.title}>Explore</Text><Text style={styles.subtitle}>Find destinations, packages, and travel partners that fit your next trip.</Text></View><Pressable onPress={() => router.push("/trip/create" as Href)} style={styles.plan}><Text style={styles.planText}>＋ Plan trip</Text></Pressable></View>
    <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search destination, tour, or agency" placeholderTextColor="#98A1B2" style={styles.input}/></View>
    {!data && dashboard.isLoading ? <View style={styles.loading}><ActivityIndicator color="#7359ED"/><Text style={styles.loadingText}>Finding travel ideas…</Text></View> : null}
    {data ? <><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Tour Packages</Text><Text style={styles.count}>{tours.length}</Text></View><View style={styles.grid}>{tours.map((tour) => { const listing: HomeListing={type:"tour",item:tour}; return <TourPackageCard key={String(tour.id)} tour={tour} width={285} favorite={favorites.isFavorite(listing)} onToggleFavorite={() => favorites.toggleFavorite(listing)} onOpen={() => router.push(`/package/${encodeURIComponent(String(tour.id))}` as Href)}/>; })}</View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Travel Agencies</Text><Text style={styles.count}>{agencies.length}</Text></View><View style={styles.grid}>{agencies.map((agency) => { const listing: HomeListing={type:"agency",item:agency}; return <AgencyCard key={String(agency.id)} agency={agency} width={310} favorite={favorites.isFavorite(listing)} onToggleFavorite={() => favorites.toggleFavorite(listing)} onOpen={() => router.push(`/agency/${encodeURIComponent(String(agency.id))}` as Href)}/>; })}</View></> : null}
  </View></ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#F9FAFF"},content:{padding:17,paddingBottom:120},maxWidth:{width:"100%",maxWidth:980,alignSelf:"center"},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12},eyebrow:{color:"#7259EC",fontSize:8,fontWeight:"900",letterSpacing:1.2},title:{marginTop:3,color:"#15213C",fontSize:32,fontWeight:"900",letterSpacing:-.8},subtitle:{marginTop:5,maxWidth:470,color:"#7D879A",fontSize:10,lineHeight:15,fontWeight:"600"},plan:{paddingHorizontal:13,paddingVertical:10,borderRadius:14,backgroundColor:"#FF6688"},planText:{color:"#FFF",fontSize:9,fontWeight:"900"},search:{marginTop:18,height:49,flexDirection:"row",alignItems:"center",paddingHorizontal:13,borderRadius:17,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E8EAF1"},searchIcon:{color:"#7F899A",fontSize:20},input:{flex:1,height:"100%",paddingHorizontal:9,color:"#24304A",fontSize:11,fontWeight:"700"},loading:{marginTop:45,alignItems:"center",gap:8},loadingText:{color:"#8992A3",fontSize:10,fontWeight:"700"},sectionHead:{marginTop:25,marginBottom:10,flexDirection:"row",alignItems:"center",gap:7},sectionTitle:{color:"#17233E",fontSize:17,fontWeight:"900"},count:{minWidth:22,height:22,borderRadius:11,textAlign:"center",lineHeight:22,backgroundColor:"#EEE9FF",color:"#7259EC",fontSize:9,fontWeight:"900"},grid:{flexDirection:"row",flexWrap:"wrap",gap:12,justifyContent:"center"}});
