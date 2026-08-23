import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SearchableLocationField, type LocationChoice } from "@/features/maps/components/SearchableLocationField";
import { TripMapSurface } from "@/features/maps/components/TripMapSurface";
import { PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { PremiumCategoryIcon } from "@/features/trips/components/PremiumCategoryIcon";
import { fetchTripWeather, type TripWeather } from "@/features/trips/utils/weather";
import { useLocalTripWorkspace, type LocalActivity } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const FILTERS: Array<{ name: string; icon: TravaIconName; categories: LocalActivity["category"][] }> = [
  { name: "Work", icon: "briefcase-outline", categories: ["meeting"] },
  { name: "Food", icon: "restaurant-outline", categories: ["food"] },
  { name: "Shopping", icon: "bag-handle-outline", categories: ["shopping"] },
  { name: "Sights", icon: "camera-outline", categories: ["sightseeing"] },
  { name: "Transit", icon: "train-outline", categories: ["transport", "flight"] },
];

const CATEGORY_META: Record<LocalActivity["category"], { label: string; icon: TravaIconName; bg: string; fg: string }> = {
  flight: { label: "Flight", icon: "airplane-outline", bg: "#EAF5FF", fg: "#5C9FE7" },
  stay: { label: "Stay", icon: "bed-outline", bg: "#F0EEFF", fg: "#8482E8" },
  food: { label: "Food", icon: "restaurant-outline", bg: "#FFF1F6", fg: "#E77EAB" },
  sightseeing: { label: "Sightseeing", icon: "camera-outline", bg: "#EEF8FF", fg: "#6A9ED7" },
  transport: { label: "Transport", icon: "train-outline", bg: "#EDF8F4", fg: "#54A88E" },
  shopping: { label: "Shopping", icon: "bag-handle-outline", bg: "#FFF4EC", fg: "#DB9566" },
  meeting: { label: "Work", icon: "briefcase-outline", bg: "#F1F3FF", fg: "#7187D8" },
  other: { label: "Other", icon: "location-outline", bg: "#F3F5F8", fg: "#71809A" },
};

export function ItineraryScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, addActivity, updateActivity, deleteActivity, setDayCount } = useLocalTripWorkspace(tripId);
  const [day, setDay] = useState(1);
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<LocalActivity | null | "new">(null);
  const [weather, setWeather] = useState<TripWeather | null>(null);

  const totalDays = useMemo(() => Math.max(tripDayCount(trip.startDate, trip.endDate, state.activities), state.dayCountOverride ?? 1), [trip.startDate, trip.endDate, state.activities, state.dayCountOverride]);
  const dayItems = useMemo(() => state.activities.filter((a) => a.dayNumber === day).sort((a, b) => a.startTime.localeCompare(b.startTime)), [state.activities, day]);
  const mapItems = useMemo(() => {
    if (!filter) return state.activities;
    const active = FILTERS.find((item) => item.name === filter);
    return active ? state.activities.filter((activity) => active.categories.includes(activity.category)) : state.activities;
  }, [state.activities, filter]);
  const mappedCount = mapItems.filter((item) => item.latitude != null && item.longitude != null).length;

  useEffect(() => {
    const anchor = dayItems.find((item) => item.latitude != null && item.longitude != null);
    if (!anchor || anchor.latitude == null || anchor.longitude == null) { setWeather(null); return; }
    let live = true;
    void fetchTripWeather(anchor.latitude, anchor.longitude, anchor.locationName).then((value) => { if (live) setWeather(value); });
    return () => { live = false; };
  }, [dayItems]);

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Japan"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <View style={s.mapCard}>
        <View style={s.mapLabel}><Ionicons name="map-outline" size={15} color="#5579A9"/><View><Text style={s.mapLabelTitle}>Interactive itinerary map</Text><Text style={s.mapLabelSub}>Drag, zoom, and tap a location icon.</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {FILTERS.map((item) => <Pressable key={item.name} onPress={() => setFilter((value) => value === item.name ? null : item.name)} style={[s.filter, filter === item.name && s.filterOn]}><Ionicons name={item.icon} size={16} color={filter === item.name ? "#5D86C8" : "#40516F"}/><Text style={[s.filterText, filter === item.name && s.filterTextOn]}>{item.name}</Text></Pressable>)}
          <Pressable accessibilityLabel="Clear map filters" onPress={() => setFilter(null)} style={s.clearFilter}><Ionicons name="options-outline" size={18} color="#5E7395"/></Pressable>
        </ScrollView>
        <TripMapSurface activities={mapItems} selectedActivityId={selected} onSelectActivity={setSelected} height={390}/>
        <View style={s.route}><View style={s.routeIcon}><Ionicons name="navigate-outline" size={20} color="#668FD2"/></View><View><Text style={s.routeTitle}>{mappedCount} mapped {mappedCount === 1 ? "stop" : "stops"}</Text><Text style={s.routeSub}>{filter ? `${filter} filter active` : "Full trip route"}</Text></View></View>
      </View>

      <View><Text style={s.controlTitle}>Trip days</Text><Text style={s.controlSub}>Tap a day to view its schedule.</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>
        {Array.from({ length: totalDays }, (_, index) => index + 1).map((d) => (
          <Pressable key={`trip-day-${d}`} accessibilityLabel={`Open day ${d}`} onPress={() => setDay(d)} style={[s.dayGlass, day === d && s.dayGlassActive]}>
            <Text style={[s.dayGlassText, day === d && s.dayGlassTextActive]}>Day {d}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityLabel="Add another trip day" onPress={() => { const next = totalDays + 1; setDayCount(next); setDay(next); }} style={[s.dayGlass, s.addDayGlass]}>
          <Ionicons name="add" size={17} color="#42536E"/><Text style={s.addDayText}>Add day</Text>
        </Pressable>
      </ScrollView>

      <View style={s.timelineCard}>
        <View style={s.timelineHead}><View><Text style={s.dayTitle}>Day {day} · {dayLabel(trip.startDate, day)}</Text><Text style={s.daySubtitle}>{dayItems.length ? `${dayItems.length} scheduled ${dayItems.length === 1 ? "activity" : "activities"}` : "Nothing scheduled yet"}</Text></View><View style={s.weather}><Text style={s.weatherEmoji}>{weather?.emoji ?? "🌤️"}</Text><Text style={s.weatherText}>{weather?.temperature != null ? `${Math.round(weather.temperature)}°C` : "Weather"}</Text></View></View>{weather ? <View style={s.weatherTip}><Text style={s.weatherTipIcon}>✦</Text><View style={{flex:1}}><Text style={s.weatherTipTitle}>{weather.label}</Text><Text style={s.weatherTipText}>{weather.tip}</Text></View></View> : null}
        {dayItems.length === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Ionicons name="calendar-outline" size={25} color="#7EA4DD"/></View><Text style={s.emptyTitle}>This day is open</Text><Text style={s.emptySub}>Add your first activity and choose a real location from search. It will appear on the map immediately.</Text></View> : null}
        {dayItems.map((a, i) => {
          const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
          return <View key={a.id} style={s.row}><View style={s.timeCol}><Text style={s.time}>{clock(a.startTime)}</Text></View><View style={s.rail}><View style={s.dot}><View style={s.dotInner}/></View>{i < dayItems.length - 1 ? <View style={s.line}/> : null}</View><View style={[s.activity, selected === a.id && s.activityOn]}><Pressable onPress={() => setSelected(a.id)} style={s.activityMain}><PremiumCategoryIcon category={a.category} size={48}/><View style={s.activityCopy}><Text style={s.activityTitle}>{a.title}</Text><Text style={s.activityPlace}>{a.locationName}</Text>{a.detail ? <Text style={s.activityDetail}>{a.detail}</Text> : null}</View>{a.estimatedCost > 0 ? <Text style={s.cost}>${a.estimatedCost}</Text> : null}</Pressable><Pressable accessibilityLabel={`Edit ${a.title}`} onPress={() => setEditor(a)} style={s.edit}><Ionicons name="create-outline" size={19} color="#6D82A4"/></Pressable></View></View>;
        })}
        <Pressable onPress={() => setEditor("new")} style={({ pressed }) => pressed && { opacity: .8 }}><LinearGradient colors={["#EDF7FF", "#FBEFF6"]} style={s.addActivity}><Ionicons name="add-circle-outline" size={19} color="#6E96D7"/><Text style={s.addActivityText}>Add activity to Day {day}</Text></LinearGradient></Pressable>
      </View>
    </View></ScrollView>
    <ActivityModal key={`activity-modal-${editor === "new" ? "new" : editor?.id ?? "idle"}-${day}`} value={editor} day={day} onClose={() => setEditor(null)} onSave={(input) => {
      if (editor && editor !== "new") updateActivity(editor.id, input);
      else addActivity({ dayNumber: day, ...input });
      setEditor(null);
    }} onDelete={editor && editor !== "new" ? () => { deleteActivity(editor.id); setEditor(null); } : undefined}/>
  </ScreenShell></SafeAreaView>;
}

function ActivityModal({ value, day, onClose, onSave, onDelete }: {
  value: LocalActivity | null | "new";
  day: number;
  onClose(): void;
  onSave(value: Omit<LocalActivity, "id" | "dayNumber">): void;
  onDelete?: () => void;
}) {
  const current = value && value !== "new" ? value : null;
  const [title, setTitle] = useState(current?.title ?? "");
  const [place, setPlace] = useState(current?.locationName ?? "");
  const [choice, setChoice] = useState<LocationChoice | null>(current?.latitude != null && current.longitude != null ? { id: current.id, name: current.locationName, displayName: current.locationName, latitude: current.latitude, longitude: current.longitude } : null);
  const [category, setCategory] = useState<LocalActivity["category"]>(current?.category ?? "sightseeing");
  const [time, setTime] = useState(current?.startTime ?? "10:00");
  const [cost, setCost] = useState(String(current?.estimatedCost ?? 0));
  const [error, setError] = useState<string | null>(null);
  if (!value) return null;

  function save() {
    if (title.trim().length < 2) { setError("Give this activity a clear name."); return; }
    if (!choice) { setError("Choose a location from the searchable dropdown so TRAVA can place it on the map."); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { setError("Use a 24-hour time such as 09:30 or 18:00."); return; }
    onSave({ title: title.trim(), locationName: choice.displayName, detail: choice.displayName, latitude: choice.latitude, longitude: choice.longitude, category, startTime: time, estimatedCost: Number(cost) || 0 });
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>{current ? "Edit activity" : `Add activity · Day ${day}`}</Text><Text style={s.modalSub}>Pick a real place so the map and route update correctly.</Text></View><Pressable onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#71809A"/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
    <Text style={s.fieldLabel}>Activity</Text><TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. TeamLab Planets" placeholderTextColor="#9BA6B8"/>
    <Text style={s.fieldLabel}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>{Object.entries(CATEGORY_META).map(([key, meta]) => <Pressable key={key} onPress={() => setCategory(key as LocalActivity["category"])} style={[s.categoryChip, category === key && s.categoryChipOn]}><Ionicons name={meta.icon} size={15} color={category === key ? "#5E85C6" : "#7B879A"}/><Text style={[s.categoryText, category === key && s.categoryTextOn]}>{meta.label}</Text></Pressable>)}</ScrollView>
    <Text style={s.fieldLabel}>Location</Text><SearchableLocationField value={place} onChangeText={(text) => { setPlace(text); if (text !== choice?.displayName) setChoice(null); setError(null); }} onSelect={(location) => { setChoice(location); setPlace(location.displayName); setError(null); }} />
    {choice ? <View style={s.locationConfirmed}><Ionicons name="checkmark-circle" size={16} color="#4DAA8A"/><Text style={s.locationConfirmedText}>Mapped at {choice.latitude.toFixed(4)}, {choice.longitude.toFixed(4)}</Text></View> : null}
    <View style={s.modalRow}><View style={s.flex}><Text style={s.fieldLabel}>Start time</Text><TextInput style={s.input} value={time} onChangeText={setTime} placeholder="10:00" placeholderTextColor="#9BA6B8"/></View><View style={s.flex}><Text style={s.fieldLabel}>Estimated cost</Text><TextInput style={s.input} value={cost} onChangeText={(text) => setCost(cleanMoney(text))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9BA6B8"/></View></View>
    {error ? <View style={s.errorBox}><Ionicons name="alert-circle-outline" size={16} color="#D76B7D"/><Text style={s.errorText}>{error}</Text></View> : null}
    <View style={s.modalActions}>{onDelete ? <Pressable onPress={onDelete} style={s.deleteBtn}><Ionicons name="trash-outline" size={17} color="#D65E76"/><Text style={s.deleteText}>Delete</Text></Pressable> : null}<Pressable onPress={onClose} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={save} style={s.savePress}><LinearGradient colors={["#83B8F4", "#A8AAF5", "#EF9FC4"]} style={s.saveBtn}><Text style={s.saveText}>{current ? "Save changes" : "Add activity"}</Text></LinearGradient></Pressable></View>
  </ScrollView></View></View></Modal>;
}

function tripDayCount(startDate: string | null | undefined, endDate: string | null | undefined, activities: LocalActivity[]) {
  if (startDate && endDate) {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  }
  return Math.max(1, ...activities.map((item) => item.dayNumber || 1));
}

function cleanMoney(value: string) { const cleaned = value.replace(/[^0-9.]/g, ""); const [whole, ...rest] = cleaned.split("."); return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole; }
function clock(value: string) { const [h = "0", m = "00"] = value.split(":"); const n = Number(h); return `${n % 12 || 12}:${m} ${n >= 12 ? "PM" : "AM"}`; }
function dayLabel(startDate: string | null | undefined, day: number) {
  const base = new Date(`${startDate || "2026-03-10"}T12:00:00`);
  if (Number.isNaN(base.getTime())) return `Day ${day}`;
  base.setDate(base.getDate() + day - 1);
  return base.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" }, scroll: { padding: 22, paddingBottom: 130 }, max: { width: "100%", maxWidth: 640, alignSelf: "center", gap: 18 },
  mapCard: { position: "relative", borderRadius: 28 }, mapLabel: { position: "absolute", left: 16, top: 14, zIndex: 11, maxWidth: 230, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "#E8EEF6", boxShadow: "0 8px 18px rgba(60,75,105,.10)" }, mapLabelTitle: { color: PX.ink, fontSize: 10, fontWeight: "900" }, mapLabelSub: { marginTop: 1, color: PX.muted, fontSize: 8, fontWeight: "600" },
  filters: { position: "absolute", left: 16, right: 16, top: 66, zIndex: 10, gap: 8, paddingRight: 10 }, filter: { height: 40, paddingHorizontal: 12, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "#E9EEF5", boxShadow: "0 7px 16px rgba(60,75,105,.08)" }, filterOn: { backgroundColor: "#EEF6FF", borderColor: "#C9DDF6" }, filterText: { color: "#40516F", fontSize: 10, fontWeight: "800" }, filterTextOn: { color: "#5D86C8" }, clearFilter: { width: 42, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "#E9EEF5" },
  route: { position: "absolute", left: 18, bottom: 18, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,255,255,.96)", boxShadow: "0 10px 22px rgba(68,72,108,.12)" }, routeIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF6FF" }, routeTitle: { color: PX.ink, fontSize: 12, fontWeight: "900" }, routeSub: { marginTop: 2, color: PX.muted, fontSize: 9, fontWeight: "600" },
  controlTitle: { color: PX.ink, fontSize: 15, fontWeight: "900" }, controlSub: { marginTop: 3, color: PX.muted, fontSize: 10, fontWeight: "600" }, days: { gap: 10, paddingVertical: 2 }, dayGlass: { minWidth: 96, height: 48, paddingHorizontal: 20, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.50)", borderWidth: 1, borderColor: "rgba(219,227,238,.92)", boxShadow: "0 8px 22px rgba(72,90,118,.055)" }, dayGlassActive: { backgroundColor: "rgba(255,255,255,.94)", borderColor: "#B9C9DC", boxShadow: "0 9px 24px rgba(67,91,124,.10)" }, dayGlassText: { color: "#6B7890", fontSize: 12, fontWeight: "800" }, dayGlassTextActive: { color: "#203553" }, addDayGlass: { flexDirection: "row", gap: 5, borderStyle: "dashed", backgroundColor: "#FAFBFC" }, addDayText: { color: "#42536E", fontSize: 11, fontWeight: "900" },
  timelineCard: { padding: 22, borderRadius: 29, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#ECEEF4", boxShadow: "0 14px 34px rgba(67,71,104,.08)" }, timelineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, dayTitle: { color: PX.ink, fontSize: 19, fontWeight: "900" }, daySubtitle: { marginTop: 3, color: PX.muted, fontSize: 10, fontWeight: "600" }, weather: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F4F8FD" }, weatherText: { color: "#607694", fontSize: 10, fontWeight: "800" }, weatherEmoji: { fontSize: 16 }, weatherTip: { marginBottom: 12, padding: 12, borderRadius: 17, flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "#EAECF0" }, weatherTipIcon: { color: "#6B6F77", fontSize: 14, fontWeight: "900" }, weatherTipTitle: { color: PX.ink, fontSize: 10, fontWeight: "900" }, weatherTipText: { marginTop: 3, color: PX.muted, fontSize: 9, lineHeight: 14, fontWeight: "600" },
  empty: { marginVertical: 14, padding: 20, borderRadius: 20, alignItems: "center", backgroundColor: "#F8FBFF" }, emptyIcon: { width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF4FF" }, emptyTitle: { marginTop: 10, color: PX.ink, fontSize: 13, fontWeight: "900" }, emptySub: { marginTop: 5, maxWidth: 360, textAlign: "center", color: PX.muted, fontSize: 9, lineHeight: 14, fontWeight: "600" },
  row: { minHeight: 104, flexDirection: "row" }, timeCol: { width: 93, paddingTop: 26 }, time: { color: "#4D608A", fontSize: 13, fontWeight: "800" }, rail: { width: 28, alignItems: "center" }, dot: { marginTop: 28, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#84A9E1", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", zIndex: 2 }, dotInner: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#84A9E1" }, line: { width: 2, flex: 1, backgroundColor: "#D1DFF1" },
  activity: { flex: 1, minHeight: 92, marginBottom: 12, padding: 10, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#EEF0F5", boxShadow: "0 8px 20px rgba(71,76,109,.06)" }, activityOn: { borderColor: "#BCD4F1", backgroundColor: "#FCFDFF" }, activityMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }, activityIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, activityCopy: { flex: 1, minWidth: 0 }, activityTitle: { color: PX.ink, fontSize: 13, fontWeight: "900" }, activityPlace: { marginTop: 3, color: "#52628A", fontSize: 10, fontWeight: "700" }, activityDetail: { marginTop: 2, color: "#7D88A0", fontSize: 9, fontWeight: "600" }, cost: { color: "#688AC0", fontSize: 13, fontWeight: "900" }, edit: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F9FC" },
  addActivity: { height: 56, borderRadius: 20, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E4EDF8" }, addActivityText: { color: "#6288C6", fontSize: 13, fontWeight: "900" },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(12,18,38,.42)" }, modal: { width: "100%", maxWidth: 500, maxHeight: "88%", padding: 20, borderRadius: 26, backgroundColor: "#FFF" }, modalHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, modalTitle: { color: PX.ink, fontSize: 19, fontWeight: "900" }, modalSub: { marginTop: 3, color: PX.muted, fontSize: 9, fontWeight: "600" }, closeBtn: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" }, modalScroll: { paddingTop: 8, paddingBottom: 2 }, fieldLabel: { marginTop: 11, marginBottom: 6, color: "#526079", fontSize: 9, fontWeight: "900" }, input: { height: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "#F6F8FC", borderWidth: 1, borderColor: "#E8ECF3", color: PX.ink, fontSize: 12, fontWeight: "700" }, categoryRow: { gap: 7, paddingBottom: 2 }, categoryChip: { minHeight: 37, paddingHorizontal: 11, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F7F8FB", borderWidth: 1, borderColor: "#E9ECF2" }, categoryChipOn: { backgroundColor: "#EEF6FF", borderColor: "#C8DDF7" }, categoryText: { color: "#707C90", fontSize: 9, fontWeight: "800" }, categoryTextOn: { color: "#5E85C6" }, locationConfirmed: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }, locationConfirmedText: { color: "#5C8E7D", fontSize: 9, fontWeight: "700" }, modalRow: { flexDirection: "row", gap: 8 }, flex: { flex: 1 }, errorBox: { marginTop: 12, padding: 10, borderRadius: 13, flexDirection: "row", gap: 7, alignItems: "flex-start", backgroundColor: "#FFF4F6" }, errorText: { flex: 1, color: "#B75E70", fontSize: 9, lineHeight: 14, fontWeight: "700" }, modalActions: { marginTop: 16, flexDirection: "row", gap: 8 }, deleteBtn: { height: 46, paddingHorizontal: 14, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F3" }, deleteText: { color: "#D65E76", fontWeight: "900", fontSize: 10 }, cancelBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF0F5" }, cancelText: { color: PX.muted, fontWeight: "900", fontSize: 10 }, savePress: { flex: 1.6, height: 46 }, saveBtn: { flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, saveText: { color: "#FFF", fontWeight: "900", fontSize: 10 },
});
