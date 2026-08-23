import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchBudget } from "@/features/budget/api/budget.api";
import { listActivities } from "@/features/itinerary/api/itinerary.api";
import { WeatherPreparationCard } from "@/features/weather/components/WeatherPreparationCard";
import { deleteTrip, fetchTrip } from "../api/trips.api";
import { FlightStatusCard } from "../components/FlightStatusCard";
import { TripWorkspaceHeader } from "../components/TripWorkspaceHeader";

const WORKSPACE = [
  ["▦", "Itinerary", "Daily plan & routes", "itinerary", ["#FFF2F6", "#FFF8FA"]],
  ["▣", "Budget", "Track your budget", "budget", ["#EDFFF5", "#F7FFFB"]],
  ["▤", "Expenses", "Split shared costs", "expenses", ["#FFF4E9", "#FFF9F3"]],
  ["✓", "Checklist", "Stay organized", "checklist", ["#F5EEFF", "#FBF8FF"]],
  ["▱", "Documents", "Travel documents", "documents", ["#EDF7FF", "#F7FBFF"]],
] as const;

export function TripDetailsScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const router = useRouter();
  const queryClient = useQueryClient();

  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId), staleTime: 30_000 });
  const activityQuery = useQuery({ queryKey: ["trip-activities", tripId], queryFn: () => listActivities(tripId), enabled: Boolean(tripId), staleTime: 20_000 });
  const budgetQuery = useQuery({ queryKey: ["trip-budget", tripId], queryFn: () => fetchBudget(tripId), enabled: Boolean(tripId), staleTime: 20_000 });

  const removeMutation = useMutation({
    mutationFn: () => deleteTrip(tripId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
      router.replace("/(traveler)/(tabs)/trips" as Href);
    },
    onError: (error) => Alert.alert("Delete trip", error instanceof Error ? error.message : "Unable to delete trip."),
  });

  const trip = tripQuery.data;
  if (!trip) return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" size="large" /> : <Text style={styles.error}>Trip unavailable.</Text>}</SafeAreaView>;

  const activities = activityQuery.data ?? [];
  const firstMapped = activities.find((activity) => activity.latitude !== null && activity.longitude !== null);
  const nextActivities = activities.slice().sort((a,b) => a.dayNumber - b.dayNumber || a.startTime.localeCompare(b.startTime)).slice(0,3);
  const budget = budgetQuery.data?.summary;
  const total = budget?.totalBudget ?? trip.totalBudget;
  const spent = budget?.actualSpending ?? 0;
  const budgetPercent = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;

  async function refresh() {
    await Promise.all([tripQuery.refetch(), activityQuery.refetch(), budgetQuery.refetch()]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={tripQuery.isRefetching || activityQuery.isRefetching} onRefresh={() => void refresh()} tintColor="#7257EC" />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.maxWidth}>
          <View style={styles.hero}>
            {trip.coverImageUrl ? <Image source={{ uri: trip.coverImageUrl }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : <LinearGradient colors={["#EA94AE", "#6D71D8"]} style={StyleSheet.absoluteFill} />}
            <LinearGradient colors={["rgba(13,20,37,.04)", "rgba(13,20,37,.66)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroTop}>
              <View style={styles.status}><Text style={styles.statusText}>{trip.status.toUpperCase()}</Text></View>
              {trip.canManageTrip ? <Pressable onPress={() => router.push(`/trip/${tripId}/edit` as Href)} style={styles.editTrip}><Text style={styles.editTripText}>⌁ Edit</Text></Pressable> : null}
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{trip.numberOfDays} DAY TRIP</Text>
              <Text style={styles.heroTitle}>{trip.name}</Text>
              <Text style={styles.heroDestination}>⌖ {trip.destination} · {formatRange(trip.startDate, trip.endDate)}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Budget Used</Text><Text style={styles.summaryValue}>{money(spent, trip.currencyCode)} / {money(total, trip.currencyCode)}</Text><View style={styles.track}><LinearGradient colors={["#EF4B9A", "#7658ED"]} style={[styles.fill, { width: `${budgetPercent}%` }]} /></View></View>
            <View style={styles.summaryMini}><Text style={styles.summaryMiniIcon}>✈</Text><Text style={styles.summaryMiniValue}>{trip.flightNumber || "—"}</Text><Text style={styles.summaryMiniLabel}>Flight</Text></View>
            <View style={styles.summaryMini}><Text style={styles.summaryMiniIcon}>♙</Text><Text style={styles.summaryMiniValue}>{trip.memberCount}</Text><Text style={styles.summaryMiniLabel}>Travelers</Text></View>
          </View>

          <WeatherPreparationCard latitude={firstMapped?.latitude} longitude={firstMapped?.longitude} destination={trip.destination} />

          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Trip Overview</Text><Text style={styles.sectionSub}>Everything important, without the clutter.</Text></View></View>
          <View style={styles.workspaceGrid}>
            {WORKSPACE.map(([glyph,label,subtitle,suffix,colors], index) => (
              <Pressable key={suffix} onPress={() => router.push(`/trip/${tripId}/${suffix}` as Href)} style={({pressed}) => [styles.workspacePress, index < 2 ? styles.workspaceHalf : styles.workspaceThird, pressed && styles.pressed]}>
                <LinearGradient colors={[colors[0],colors[1]]} style={styles.workspaceCard}>
                  <View><Text style={styles.workspaceTitle}>{label}</Text><Text style={styles.workspaceSub}>{subtitle}</Text></View>
                  <View style={styles.workspaceIcon}><Text style={styles.workspaceGlyph}>{glyph}</Text></View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          <View style={styles.itineraryPanel}>
            <View style={styles.panelHead}><View><Text style={styles.sectionTitle}>Itinerary Overview</Text><Text style={styles.sectionSub}>{activities.length} planned activities</Text></View><Pressable onPress={() => router.push(`/trip/${tripId}/itinerary` as Href)}><Text style={styles.link}>Open Itinerary ›</Text></Pressable></View>
            <View style={styles.timeline}>
              {nextActivities.map((activity, index) => (
                <View key={activity.id} style={styles.timelineRow}>
                  <View style={styles.timeBlock}><Text style={styles.time}>{activity.startTime}</Text><Text style={styles.day}>Day {activity.dayNumber}</Text></View>
                  <View style={styles.rail}><View style={styles.dot} />{index < nextActivities.length - 1 ? <View style={styles.line} /> : null}</View>
                  <View style={styles.activity}><Text style={styles.activityTitle}>{activity.title}</Text><Text numberOfLines={1} style={styles.activityPlace}>{activity.locationName}</Text>{activity.estimatedCost > 0 ? <Text style={styles.activityCost}>{money(activity.estimatedCost, trip.currencyCode)}</Text> : null}</View>
                </View>
              ))}
              {!nextActivities.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No itinerary yet</Text><Text style={styles.emptyText}>Add the first activity to activate route mapping and live weather preparation.</Text><Pressable onPress={() => router.push(`/trip/${tripId}/itinerary` as Href)} style={styles.primary}><Text style={styles.primaryText}>Build itinerary</Text></Pressable></View> : null}
            </View>
          </View>

          <FlightStatusCard tripId={tripId} initialFlightNumber={trip.flightNumber} initialFlightDate={trip.flightDate} canEdit={trip.canManageTrip} />

          <View style={styles.peoplePanel}>
            <View style={styles.panelHead}><View><Text style={styles.sectionTitle}>Travel Group</Text><Text style={styles.sectionSub}>Owner and accepted travelers</Text></View><Pressable onPress={() => router.push(`/trip/${tripId}/members` as Href)}><Text style={styles.link}>Manage ›</Text></Pressable></View>
            <View style={styles.people}>{trip.members.filter((m) => m.status === "accepted").slice(0,5).map((member) => <View key={member.id} style={styles.personRow}><View style={styles.avatar}>{member.avatarUrl ? <Image source={{uri:member.avatarUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Text style={styles.avatarText}>{member.fullName.slice(0,1)}</Text>}</View><View style={styles.personCopy}><Text style={styles.personName}>{member.fullName}</Text><Text style={styles.personRole}>{member.role === "owner" ? "Trip owner" : "Traveler"}</Text></View></View>)}</View>
          </View>

          {trip.canManageTrip ? <Pressable disabled={removeMutation.isPending} onPress={() => Alert.alert("Delete this trip?", "This removes shared trip data. Local-only documents remain on this device.", [{text:"Cancel",style:"cancel"},{text:"Delete trip",style:"destructive",onPress:()=>removeMutation.mutate()}])} style={styles.deleteTrip}>{removeMutation.isPending ? <ActivityIndicator color="#C74457"/> : <Text style={styles.deleteTripText}>Delete Trip</Text>}</Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatRange(start:string|null,end:string|null){if(!start)return"Dates not set";const fmt=(v:string)=>new Date(`${v}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"});return end?`${fmt(start)} – ${fmt(end)}`:fmt(start)}
function money(value:number,code:string){const symbol=code==="PHP"?"₱":code==="USD"?"$":`${code} `;return`${symbol}${Number(value||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FAFAFD"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#FAFAFD"},error:{color:"#C83B4A",fontSize:10,fontWeight:"700"},content:{padding:14,paddingBottom:100},maxWidth:{width:"100%",maxWidth:760,alignSelf:"center"},
  hero:{height:225,overflow:"hidden",borderRadius:24},heroTop:{flexDirection:"row",justifyContent:"space-between",padding:13},status:{paddingHorizontal:9,paddingVertical:5,borderRadius:9,backgroundColor:"rgba(255,255,255,.9)"},statusText:{color:"#6651D3",fontSize:6,fontWeight:"900"},editTrip:{paddingHorizontal:10,paddingVertical:7,borderRadius:10,backgroundColor:"rgba(20,25,42,.72)"},editTripText:{color:"#FFFFFF",fontSize:7,fontWeight:"900"},heroCopy:{position:"absolute",left:16,right:16,bottom:16},heroEyebrow:{color:"#EEE9FF",fontSize:7,letterSpacing:1,fontWeight:"900"},heroTitle:{marginTop:4,color:"#FFFFFF",fontSize:29,lineHeight:32,fontWeight:"900"},heroDestination:{marginTop:4,color:"#F4F4FA",fontSize:8,fontWeight:"700"},
  summaryRow:{marginTop:8,flexDirection:"row",gap:7},summaryCard:{flex:2,minHeight:78,padding:12,borderRadius:17,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},summaryLabel:{color:"#68738A",fontSize:7,fontWeight:"800"},summaryValue:{marginTop:5,color:"#1E2941",fontSize:10,fontWeight:"900"},track:{marginTop:10,height:6,borderRadius:3,overflow:"hidden",backgroundColor:"#F3DDE9"},fill:{height:"100%",borderRadius:3},summaryMini:{flex:1,alignItems:"center",justifyContent:"center",borderRadius:17,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},summaryMiniIcon:{color:"#715AE8",fontSize:14},summaryMiniValue:{marginTop:3,color:"#1E2941",fontSize:8,fontWeight:"900"},summaryMiniLabel:{marginTop:2,color:"#9299A8",fontSize:6,fontWeight:"700"},
  sectionHeader:{marginTop:15},sectionTitle:{color:"#1C263D",fontSize:12,fontWeight:"900"},sectionSub:{marginTop:2,color:"#9098A8",fontSize:7,fontWeight:"700"},workspaceGrid:{marginTop:8,flexDirection:"row",flexWrap:"wrap",gap:7},workspacePress:{minWidth:0},workspaceHalf:{width:"49%",flexGrow:1},workspaceThird:{width:"31.8%",flexGrow:1},workspaceCard:{minHeight:76,flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:11,borderRadius:16},workspaceTitle:{color:"#202A41",fontSize:8,fontWeight:"900"},workspaceSub:{marginTop:3,color:"#8B94A5",fontSize:6,fontWeight:"700"},workspaceIcon:{width:38,height:38,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.75)"},workspaceGlyph:{color:"#7257EC",fontSize:17,fontWeight:"900"},
  itineraryPanel:{marginTop:10,padding:13,borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},panelHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},link:{color:"#7257EC",fontSize:7,fontWeight:"900"},timeline:{marginTop:10},timelineRow:{minHeight:58,flexDirection:"row"},timeBlock:{width:55,paddingTop:3},time:{color:"#4F5E79",fontSize:7,fontWeight:"900"},day:{marginTop:2,color:"#A0A6B3",fontSize:5,fontWeight:"700"},rail:{width:24,alignItems:"center"},dot:{width:10,height:10,borderRadius:5,marginTop:3,backgroundColor:"#FFFFFF",borderWidth:3,borderColor:"#8468F5"},line:{flex:1,width:2,backgroundColor:"#B8A9FF"},activity:{flex:1,minWidth:0,marginBottom:7,padding:9,borderRadius:13,backgroundColor:"#F8F8FC"},activityTitle:{color:"#202A41",fontSize:8,fontWeight:"900"},activityPlace:{marginTop:3,color:"#858FA1",fontSize:6,fontWeight:"700"},activityCost:{position:"absolute",right:9,top:9,color:"#7257EC",fontSize:6,fontWeight:"900"},
  empty:{alignItems:"center",padding:20},emptyTitle:{color:"#202A41",fontSize:10,fontWeight:"900"},emptyText:{marginTop:4,maxWidth:340,textAlign:"center",color:"#9098A8",fontSize:7,lineHeight:11,fontWeight:"700"},primary:{marginTop:9,paddingHorizontal:13,paddingVertical:8,borderRadius:10,backgroundColor:"#7257EC"},primaryText:{color:"#FFFFFF",fontSize:7,fontWeight:"900"},
  peoplePanel:{marginTop:10,padding:13,borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},people:{marginTop:8,gap:6},personRow:{flexDirection:"row",alignItems:"center"},avatar:{width:33,height:33,borderRadius:17,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#EEE9FF"},avatarText:{color:"#7257EC",fontSize:11,fontWeight:"900"},personCopy:{marginLeft:8},personName:{color:"#202A41",fontSize:8,fontWeight:"900"},personRole:{marginTop:2,color:"#8F97A6",fontSize:6,fontWeight:"700"},
  deleteTrip:{marginTop:12,height:45,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#FFF0F3",borderWidth:1,borderColor:"#FFDCE3"},deleteTripText:{color:"#C74457",fontSize:8,fontWeight:"900"},pressed:{opacity:.72}
});
