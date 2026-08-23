import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityCategory, PlaceSearchResult, TripActivity } from "@trava/shared";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { searchPlaces } from "@/features/maps/api/places.api";
import { TripMapSurface } from "@/features/maps/components/TripMapSurface";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { GradientPill, TRAVA, money } from "@/features/trips/components/TravaUI";
import { createActivity, deleteActivity, listActivities, updateActivity, type ActivityInput } from "../api/itinerary.api";

const MAP_FILTERS = [
  ["Work", "💼", ["meeting"]], ["Restaurants", "🍴", ["food"]], ["Shopping", "🛍", ["shopping"]], ["Hiking & Trails", "🥾", ["sightseeing"]], ["Parks", "🌲", ["sightseeing"]], ["Coffee", "☕", ["food"]],
] as const;
const CATEGORIES: ActivityCategory[] = ["flight", "stay", "food", "sightseeing", "transport", "shopping", "meeting", "other"];
const ICONS: Record<ActivityCategory, string> = { flight: "✈️", stay: "🏨", food: "🍜", sightseeing: "🗼", transport: "🚆", shopping: "🛍️", meeting: "💼", other: "📍" };

export function ItineraryScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeDay, setActiveDay] = useState(1);
  const [mapFilter, setMapFilter] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [fullMap, setFullMap] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; activity: TripActivity | null }>({ open: false, activity: null });

  const tripQ = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const activitiesQ = useQuery({ queryKey: ["trip-activities", tripId], queryFn: () => listActivities(tripId), enabled: Boolean(tripId) });
  const trip = tripQ.data;
  const activities = activitiesQ.data ?? [];
  const maxDay = Math.max(1, trip?.numberOfDays ?? 1, ...activities.map((a) => a.dayNumber));
  const dayActivities = useMemo(() => activities.filter((a) => a.dayNumber === activeDay).sort((a, b) => a.startTime.localeCompare(b.startTime)), [activeDay, activities]);
  const filteredMap = useMemo(() => {
    if (!mapFilter) return activities;
    const match = MAP_FILTERS.find(([label]) => label === mapFilter);
    if (!match) return activities;
    return activities.filter((a) => (match[2] as readonly string[]).includes(a.category));
  }, [activities, mapFilter]);
  const selected = activities.find((a) => a.id === selectedActivityId) ?? null;
  const previous = selected ? previousMappedActivity(activities, selected) : null;
  const route = selected ? estimateRoute(previous, selected) : null;

  const save = useMutation({
    mutationFn: ({ id, value }: { id?: string; value: ActivityInput }) => id ? updateActivity(tripId, id, value) : createActivity(tripId, value),
    onSuccess: async (saved) => { setEditor({ open: false, activity: null }); setActiveDay(saved.dayNumber); setSelectedActivityId(saved.id); await qc.invalidateQueries({ queryKey: ["trip-activities", tripId] }); },
    onError: (e) => Alert.alert("Activity", msg(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteActivity(tripId, id), onSuccess: async () => { setSelectedActivityId(null); await qc.invalidateQueries({ queryKey: ["trip-activities", tripId] }); }, onError: (e) => Alert.alert("Activity", msg(e)) });

  if (!trip) return <SafeAreaView style={styles.center}>{tripQ.isLoading ? <ActivityIndicator color={TRAVA.purple} size="large" /> : <Text>{msg(tripQ.error)}</Text>}</SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} />
      <ScrollView refreshControl={<RefreshControl refreshing={activitiesQ.isRefetching} onRefresh={() => void activitiesQ.refetch()} tintColor={TRAVA.purple} />} contentContainerStyle={styles.content}>
        <View style={styles.maxWidth}>
          <View style={styles.mapShell}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {MAP_FILTERS.map(([label, glyph]) => <Pressable key={label} onPress={() => setMapFilter((current) => current === label ? null : label)} style={[styles.filterChip, mapFilter === label && styles.filterChipActive]}><Text style={styles.filterGlyph}>{glyph}</Text><Text style={[styles.filterText, mapFilter === label && styles.filterTextActive]}>{label}</Text></Pressable>)}
              <Pressable onPress={() => setMapFilter(null)} style={styles.filterSettings}><Text style={styles.filterSettingsText}>☷</Text></Pressable>
            </ScrollView>
            <TripMapSurface activities={filteredMap} selectedActivityId={selectedActivityId} onSelectActivity={setSelectedActivityId} height={365} />
            <Pressable onPress={() => setFullMap(true)} style={styles.fullscreenButton}><Text style={styles.fullscreenGlyph}>⛶</Text></Pressable>
            <View style={styles.routePill}><Text style={styles.routePlane}>✈</Text><View><Text style={styles.routeTitle}>{routeLabel(activities)}</Text><Text style={styles.routeSub}>{trip.numberOfDays} days · {activities.length} saved stops</Text></View></View>
          </View>

          {route && selected ? <RoutePreview activity={selected} route={route} /> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => <Pressable key={day} onPress={() => setActiveDay(day)} style={styles.dayWrap}>{activeDay === day ? <GradientPill style={styles.dayActive}><Text style={styles.dayActiveText}>Day {day}</Text></GradientPill> : <View style={styles.day}><Text style={styles.dayText}>Day {day}</Text></View>}</Pressable>)}
            <Pressable onPress={() => setActiveDay(maxDay + 1)} style={styles.addDay}><Text style={styles.addDayText}>＋</Text></Pressable>
          </ScrollView>

          <View style={styles.timelineCard}>
            <View style={styles.timelineHeader}><View><Text style={styles.dayHeading}>Day {activeDay} – {trip.startDate ? formatDayDate(trip.startDate, activeDay) : "Plan your day"}</Text><Text style={styles.daySub}>{dayActivities.length} scheduled activities</Text></View><View style={styles.weather}><Text style={styles.weatherText}>🌤 18°C</Text></View></View>
            {activitiesQ.isLoading ? <ActivityIndicator color={TRAVA.purple} style={{ margin: 28 }} /> : null}
            {!activitiesQ.isLoading && !dayActivities.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>A fresh day ready to plan</Text><Text style={styles.emptyText}>Add your first activity and search a location to place it on the map.</Text></View> : null}
            {dayActivities.map((activity, index) => {
              const canEdit = trip.canManageTrip || activity.createdBy === user?.id;
              return <View key={activity.id} style={styles.timelineRow}><View style={styles.timeCol}><Text style={styles.time}>{toClock(activity.startTime)}</Text></View><View style={styles.rail}><View style={styles.dot}><View style={styles.dotInner}/></View>{index < dayActivities.length - 1 ? <View style={styles.line}/> : null}</View><Pressable onPress={() => setSelectedActivityId(activity.id)} style={[styles.activityCard, selectedActivityId === activity.id && styles.activitySelected]}><View style={styles.activityIcon}><Text style={styles.activityGlyph}>{ICONS[activity.category]}</Text></View><View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.activityPlace}>{activity.locationName}</Text>{activity.notes ? <Text numberOfLines={1} style={styles.activityNotes}>{activity.notes}</Text> : null}</View>{activity.estimatedCost > 0 ? <Text style={styles.cost}>{money(activity.estimatedCost, trip.currencyCode)}</Text> : null}{canEdit ? <Pressable onPress={() => setEditor({ open: true, activity })} style={styles.editButton}><Text style={styles.editGlyph}>✎</Text></Pressable> : null}</Pressable></View>;
            })}
            <Pressable onPress={() => setEditor({ open: true, activity: null })} style={styles.addActivity}><Text style={styles.addActivityText}>⊕ Add Activity</Text></Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal visible={fullMap} animationType="slide" onRequestClose={() => setFullMap(false)}><SafeAreaView style={styles.fullMapSafe}><View style={styles.fullMapHeader}><Text style={styles.fullMapTitle}>{trip.name} Map</Text><Pressable onPress={() => setFullMap(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><View style={styles.fullMapBody}><TripMapSurface activities={filteredMap} selectedActivityId={selectedActivityId} onSelectActivity={setSelectedActivityId} height={760} /></View></SafeAreaView></Modal>
      <ActivityEditorModal key={`${editor.open}-${editor.activity?.id ?? "new"}-${activeDay}`} visible={editor.open} activity={editor.activity} dayNumber={activeDay} currency={trip.currencyCode} saving={save.isPending} onClose={() => setEditor({ open: false, activity: null })} onDelete={editor.activity ? () => Alert.alert("Delete activity?", editor.activity?.title ?? "Activity", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { if (editor.activity) { remove.mutate(editor.activity.id); setEditor({ open: false, activity: null }); } } }]) : undefined} onSave={(value) => save.mutate({ id: editor.activity?.id, value })} />
    </SafeAreaView>
  );
}

function RoutePreview({ activity, route }: { activity: TripActivity; route: ReturnType<typeof estimateRoute> }) {
  if (!route) return null;
  return <View style={styles.routePreview}><View style={styles.routePreviewTop}><View><Text style={styles.routePreviewTitle}>{activity.title}</Text><Text style={styles.routePreviewPlace}>{activity.locationName}</Text></View><Text style={styles.routeDistance}>{route.distance.toFixed(1)} km</Text></View><View style={styles.modeRow}><Mode glyph="🚶" label="Walk" value={`${route.walk} min`} /><Mode glyph="🚗" label="Drive" value={`${route.drive} min`} active /><Mode glyph="🚆" label="Transit" value={`${route.transit} min`} /></View><Text style={styles.directionsText}>Head toward {activity.locationName} → continue on the fastest available route → arrive at destination.</Text></View>;
}
function Mode({ glyph, label, value, active }: { glyph: string; label: string; value: string; active?: boolean }) { return <View style={[styles.mode, active && styles.modeActive]}><Text style={styles.modeGlyph}>{glyph}</Text><Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text><Text style={[styles.modeValue, active && styles.modeLabelActive]}>{value}</Text></View>; }

function ActivityEditorModal({ visible, activity, dayNumber, currency, saving, onClose, onSave, onDelete }: { visible: boolean; activity: TripActivity | null; dayNumber: number; currency: string; saving: boolean; onClose(): void; onSave(value: ActivityInput): void; onDelete?: () => void }) {
  const [form, setForm] = useState<ActivityInput>(() => activity ? toInput(activity) : emptyActivity(dayNumber));
  const [search, setSearch] = useState(activity?.locationName ?? ""); const [results, setResults] = useState<PlaceSearchResult[]>([]); const [searching, setSearching] = useState(false); const [error, setError] = useState<string | null>(null);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{activity ? "Edit Activity" : "Add Activity"}</Text><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}><Field label="Activity title" value={form.title} onChangeText={(v) => setForm((c) => ({ ...c, title: v }))} placeholder="Dinner in Shinjuku"/><Text style={styles.fieldLabel}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{CATEGORIES.map((category) => <Pressable key={category} onPress={() => setForm((c) => ({ ...c, category }))} style={[styles.categoryChip, form.category === category && styles.categoryChipActive]}><Text style={[styles.categoryText, form.category === category && styles.categoryTextActive]}>{ICONS[category]} {category}</Text></Pressable>)}</ScrollView><Text style={styles.fieldLabel}>Location</Text><View style={styles.searchRow}><TextInput value={search} onChangeText={setSearch} placeholder="Search a place" placeholderTextColor="#98A1B3" style={[styles.input, { flex: 1 }]} /><Pressable disabled={searching || search.trim().length < 3} onPress={async () => { setSearching(true); try { setResults(await searchPlaces(search)); } catch (e) { setError(msg(e)); } finally { setSearching(false); } }} style={styles.searchButton}><Text style={styles.searchButtonText}>{searching ? "…" : "Search"}</Text></Pressable></View>{results.map((place) => <Pressable key={place.id} onPress={() => { setForm((c) => ({ ...c, locationName: place.displayName, latitude: place.latitude, longitude: place.longitude })); setSearch(place.displayName); setResults([]); }} style={styles.result}><Text style={styles.resultTitle}>{place.name}</Text><Text numberOfLines={1} style={styles.resultSub}>{place.displayName}</Text></Pressable>)}<View style={styles.formRow}><Field compact label="Start" value={form.startTime} onChangeText={(v) => setForm((c) => ({ ...c, startTime: v }))} placeholder="09:00"/><Field compact label="End" value={form.endTime ?? ""} onChangeText={(v) => setForm((c) => ({ ...c, endTime: v || null }))} placeholder="10:00"/></View><Field label={`Estimated cost (${currency})`} value={String(form.estimatedCost || "")} onChangeText={(v) => setForm((c) => ({ ...c, estimatedCost: Number(v || 0) }))} keyboardType="decimal-pad" placeholder="0"/><Field label="Notes" value={form.notes ?? ""} onChangeText={(v) => setForm((c) => ({ ...c, notes: v || null }))} multiline placeholder="Reservation, reminder, dress code..."/>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.modalActions}>{onDelete ? <Pressable onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable> : null}<Pressable disabled={saving} onPress={() => { if (form.title.trim().length < 2 || search.trim().length < 2) return setError("Add a title and location."); onSave({ ...form, dayNumber, title: form.title.trim(), locationName: search.trim() }); }} style={styles.saveButton}>{saving ? <ActivityIndicator color="#FFF"/> : <Text style={styles.saveText}>Save Activity</Text>}</Pressable></View></ScrollView></View></View></Modal>;
}

function Field({ label, compact, multiline, ...props }: { label: string; compact?: boolean; multiline?: boolean } & ComponentProps<typeof TextInput>) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#98A1B3" style={[styles.input, multiline && styles.multiline]}/></View>; }
function emptyActivity(dayNumber: number): ActivityInput { return { dayNumber, activityDate: null, title: "", category: "sightseeing", locationName: "", latitude: null, longitude: null, startTime: "09:00", endTime: null, notes: null, estimatedCost: 0 }; }
function toInput(a: TripActivity): ActivityInput { return { dayNumber: a.dayNumber, activityDate: a.activityDate, title: a.title, category: a.category, locationName: a.locationName, latitude: a.latitude, longitude: a.longitude, startTime: a.startTime, endTime: a.endTime, notes: a.notes, estimatedCost: a.estimatedCost }; }
function previousMappedActivity(activities: TripActivity[], selected: TripActivity) { const sorted = activities.filter((a) => a.latitude !== null && a.longitude !== null).sort((a,b) => a.dayNumber-b.dayNumber || a.startTime.localeCompare(b.startTime)); const index = sorted.findIndex((a) => a.id === selected.id); return index > 0 ? sorted[index - 1] : null; }
function estimateRoute(from: TripActivity | null, to: TripActivity) { if (to.latitude === null || to.longitude === null) return null; const distance = from?.latitude !== null && from?.latitude !== undefined && from.longitude !== null ? haversine(from.latitude, from.longitude, to.latitude, to.longitude) : 4.2; return { distance, walk: Math.max(4, Math.round(distance / 4.8 * 60)), drive: Math.max(3, Math.round(distance / 28 * 60)), transit: Math.max(5, Math.round(distance / 18 * 60 + 4)) }; }
function haversine(a:number,b:number,c:number,d:number){const R=6371;const p=Math.PI/180;const x=(c-a)*p,y=(d-b)*p;const q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function routeLabel(activities: TripActivity[]) { const flights = activities.filter((a) => a.category === "flight"); return flights.length >= 2 ? `${shortCode(flights[0].locationName)} → ${shortCode(flights[flights.length-1].locationName)}` : "CEB → NRT"; }
function shortCode(value: string) { const match = value.match(/\b[A-Z]{3}\b/); return match?.[0] ?? value.slice(0,3).toUpperCase(); }
function formatDayDate(start:string,day:number){const d=new Date(`${start}T00:00:00`);d.setDate(d.getDate()+day-1);return d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});}
function toClock(v:string){const [h,m]=v.split(":").map(Number);const date=new Date();date.setHours(h||0,m||0,0,0);return date.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});}
function msg(e:unknown){return e instanceof Error?e.message:"Something went wrong.";}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF9FB"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF9FB"},content:{padding:16,paddingBottom:100},maxWidth:{width:"100%",maxWidth:820,alignSelf:"center",gap:14},
  mapShell:{position:"relative"},filters:{position:"absolute",zIndex:5,top:14,left:14,right:14,gap:7,paddingRight:70},filterChip:{height:44,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:13,borderRadius:22,backgroundColor:"rgba(255,255,255,.92)",borderWidth:1,borderColor:"rgba(255,255,255,.92)",boxShadow:"0 8px 18px rgba(70,65,100,.10)"},filterChipActive:{backgroundColor:"#F1EBFF",borderColor:"#D7C9FF"},filterGlyph:{fontSize:15},filterText:{color:TRAVA.ink,fontSize:10,fontWeight:"900"},filterTextActive:{color:TRAVA.purple},filterSettings:{height:44,width:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:"#FFF"},filterSettingsText:{color:TRAVA.ink,fontSize:17},fullscreenButton:{position:"absolute",right:14,top:14,zIndex:6,width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:"rgba(255,255,255,.94)"},fullscreenGlyph:{fontSize:18,color:TRAVA.ink},routePill:{position:"absolute",left:18,bottom:18,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:14,paddingVertical:11,borderRadius:19,backgroundColor:"rgba(255,255,255,.94)",boxShadow:"0 10px 24px rgba(52,48,80,.12)"},routePlane:{fontSize:24},routeTitle:{color:TRAVA.ink,fontSize:11,fontWeight:"900"},routeSub:{marginTop:2,color:"#727D92",fontSize:8,fontWeight:"600"},
  routePreview:{padding:14,borderRadius:22,backgroundColor:"rgba(255,255,255,.88)",borderWidth:1,borderColor:"#ECEEF5"},routePreviewTop:{flexDirection:"row",justifyContent:"space-between",gap:12},routePreviewTitle:{color:TRAVA.ink,fontSize:13,fontWeight:"900"},routePreviewPlace:{marginTop:3,color:"#798399",fontSize:9,fontWeight:"600"},routeDistance:{color:TRAVA.purple,fontSize:10,fontWeight:"900"},modeRow:{marginTop:11,flexDirection:"row",gap:8},mode:{flex:1,alignItems:"center",padding:10,borderRadius:15,backgroundColor:"#F7F7FC"},modeActive:{backgroundColor:TRAVA.purple},modeGlyph:{fontSize:18},modeLabel:{marginTop:3,color:TRAVA.ink,fontSize:9,fontWeight:"900"},modeValue:{marginTop:2,color:"#818A9D",fontSize:8,fontWeight:"700"},modeLabelActive:{color:"#FFF"},directionsText:{marginTop:10,color:"#69758B",fontSize:9,lineHeight:14,fontWeight:"600"},
  days:{gap:9,alignItems:"center"},dayWrap:{height:54},day:{minWidth:126,height:54,alignItems:"center",justifyContent:"center",borderRadius:27,backgroundColor:"rgba(255,255,255,.82)",borderWidth:1,borderColor:"#ECEEF5"},dayText:{color:"#747F95",fontSize:11,fontWeight:"900"},dayActive:{minWidth:126,height:54},dayActiveText:{color:"#FFF",fontSize:11,fontWeight:"900"},addDay:{width:54,height:54,alignItems:"center",justifyContent:"center",borderRadius:27,backgroundColor:"#FFF",borderWidth:1,borderColor:"#ECEEF5"},addDayText:{color:TRAVA.purple,fontSize:24},
  timelineCard:{padding:18,borderRadius:28,backgroundColor:"rgba(255,255,255,.86)",borderWidth:1,borderColor:"rgba(255,255,255,.9)",boxShadow:"0 14px 34px rgba(75,69,105,.08)"},timelineHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},dayHeading:{color:TRAVA.ink,fontSize:20,fontWeight:"900"},daySub:{marginTop:3,color:"#8791A3",fontSize:9,fontWeight:"600"},weather:{paddingHorizontal:12,paddingVertical:8,borderRadius:14,backgroundColor:"#FFF0F7"},weatherText:{color:"#586178",fontSize:10,fontWeight:"900"},empty:{alignItems:"center",padding:28},emptyTitle:{color:TRAVA.ink,fontSize:14,fontWeight:"900"},emptyText:{marginTop:5,textAlign:"center",color:"#7D879A",fontSize:9,lineHeight:14,fontWeight:"600"},timelineRow:{minHeight:108,flexDirection:"row",alignItems:"stretch"},timeCol:{width:86,paddingTop:24},time:{color:"#526B9A",fontSize:11,fontWeight:"900"},rail:{width:26,alignItems:"center"},dot:{marginTop:25,width:18,height:18,alignItems:"center",justifyContent:"center",borderRadius:9,borderWidth:2,borderColor:"#7C5CFF",backgroundColor:"#FFF"},dotInner:{width:5,height:5,borderRadius:3,backgroundColor:"#7C5CFF"},line:{flex:1,width:2,backgroundColor:"#B9A9FF"},activityCard:{flex:1,minWidth:0,marginBottom:10,flexDirection:"row",alignItems:"center",gap:10,padding:12,borderRadius:20,backgroundColor:"#FFF",borderWidth:1,borderColor:"#ECEEF5"},activitySelected:{borderColor:"#BDAEFF",backgroundColor:"#FCFAFF"},activityIcon:{width:58,height:58,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:"#F7F7FC"},activityGlyph:{fontSize:28},activityCopy:{flex:1,minWidth:0},activityTitle:{color:TRAVA.ink,fontSize:11,fontWeight:"900"},activityPlace:{marginTop:3,color:"#617292",fontSize:9,fontWeight:"700"},activityNotes:{marginTop:3,color:"#9299A8",fontSize:8,fontWeight:"600"},cost:{color:TRAVA.purple,fontSize:11,fontWeight:"900"},editButton:{width:34,height:34,alignItems:"center",justifyContent:"center"},editGlyph:{color:"#43506D",fontSize:18},addActivity:{marginTop:5,minHeight:52,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:"#F4EEFF"},addActivityText:{color:TRAVA.purple,fontSize:12,fontWeight:"900"},
  fullMapSafe:{flex:1,backgroundColor:"#FFF9FB"},fullMapHeader:{minHeight:64,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16},fullMapTitle:{color:TRAVA.ink,fontSize:20,fontWeight:"900"},fullMapBody:{flex:1,padding:12},close:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:"#F2F3F7"},closeText:{color:TRAVA.ink,fontSize:22},
  modalBackdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(15,18,34,.45)"},modalSheet:{maxHeight:"88%",borderTopLeftRadius:30,borderTopRightRadius:30,backgroundColor:"#FFF",paddingTop:18},modalHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:18},modalTitle:{color:TRAVA.ink,fontSize:20,fontWeight:"900"},modalContent:{padding:18,paddingBottom:34},field:{marginTop:12},fieldCompact:{flex:1},fieldLabel:{marginBottom:6,color:"#56627A",fontSize:9,fontWeight:"900"},input:{minHeight:48,paddingHorizontal:13,borderRadius:15,backgroundColor:"#F4F5F9",color:TRAVA.ink,fontSize:11,fontWeight:"700"},multiline:{minHeight:90,paddingTop:12,textAlignVertical:"top"},categoryRow:{gap:7},categoryChip:{paddingHorizontal:11,paddingVertical:9,borderRadius:13,backgroundColor:"#F3F4F8"},categoryChipActive:{backgroundColor:TRAVA.purple},categoryText:{color:"#647188",fontSize:8,fontWeight:"900",textTransform:"capitalize"},categoryTextActive:{color:"#FFF"},searchRow:{flexDirection:"row",gap:8},searchButton:{width:82,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:TRAVA.purple},searchButtonText:{color:"#FFF",fontSize:9,fontWeight:"900"},result:{marginTop:6,padding:10,borderRadius:13,backgroundColor:"#FAF9FF"},resultTitle:{color:TRAVA.ink,fontSize:10,fontWeight:"900"},resultSub:{marginTop:3,color:"#7D879A",fontSize:8,fontWeight:"600"},formRow:{flexDirection:"row",gap:9},error:{marginTop:10,color:"#C83B4A",fontSize:9,fontWeight:"700"},modalActions:{marginTop:16,flexDirection:"row",gap:9},deleteButton:{flex:1,minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:"#FFF0F3"},deleteText:{color:"#C83B4A",fontSize:10,fontWeight:"900"},saveButton:{flex:2,minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:TRAVA.purple},saveText:{color:"#FFF",fontSize:10,fontWeight:"900"},
});
