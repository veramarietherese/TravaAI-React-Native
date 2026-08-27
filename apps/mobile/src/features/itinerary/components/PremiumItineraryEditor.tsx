import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { TripMapSurface } from "@/features/maps/components/TripMapSurface";
import { searchWorldPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import type { LocalActivity } from "@/features/trips/hooks/useLocalTripWorkspace";

type LocationChoice = { id: string; name: string; displayName: string; latitude: number; longitude: number };

export function PremiumItineraryEditor({ value, day, onClose, onSave, onDelete }: {
  value: LocalActivity | null | "new";
  day: number;
  onClose(): void;
  onSave(input: Omit<LocalActivity, "id" | "dayNumber">): void;
  onDelete?(): void;
}) {
  const current = value && value !== "new" ? value : null;
  const currentChoice = current?.latitude != null && current?.longitude != null ? {
    id: current.id,
    name: current.locationName,
    displayName: current.detail || current.locationName,
    latitude: current.latitude,
    longitude: current.longitude,
  } satisfies LocationChoice : null;
  const [query, setQuery] = useState(current?.locationName ?? "");
  const [results, setResults] = useState<LocationChoice[]>(currentChoice ? [currentChoice] : []);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<LocationChoice | null>(currentChoice);
  const [cost, setCost] = useState(current?.estimatedCost ? String(current.estimatedCost) : "");
  const [notes, setNotes] = useState(current?.detail ?? "");
  const initial = toWheel(current?.startTime ?? "08:00");
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [meridiem, setMeridiem] = useState(initial.meridiem);
  const req = useRef(0);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
// eslint-disable-next-line react-hooks/set-state-in-effect -- short-query state intentionally falls back to the currently selected itinerary location
      setResults(currentChoice && text ? [currentChoice] : []);
      setLoading(false);
      return;
    }
    const id = ++req.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const remote = await searchWorldPlaces(text, choice ? { latitude: choice.latitude, longitude: choice.longitude } : null, 10);
        if (id !== req.current) return;
        const mapped = remote.map(toChoice);
        setResults(dedupe(currentChoice ? [currentChoice, ...mapped] : mapped).slice(0, 10));
      } finally {
        if (id === req.current) setLoading(false);
      }
    }, 230);
    return () => clearTimeout(timer);
  }, [choice?.latitude, choice?.longitude, currentChoice?.id, query]);

  const mapActivities = useMemo(() => choice ? [{ id: "preview", title: choice.name, category: "other", locationName: choice.displayName, latitude: choice.latitude, longitude: choice.longitude }] : [], [choice]);

  function choose(item: LocationChoice) {
    setChoice(item);
    setQuery(item.name);
    setResults([item]);
    if (!notes || notes === current?.detail) setNotes(item.displayName);
  }

  function save() {
    if (!choice) return;
    onSave({
      title: choice.name,
      locationName: choice.name,
      detail: notes.trim() || choice.displayName,
      latitude: choice.latitude,
      longitude: choice.longitude,
      category: current?.category ?? "other",
      startTime: fromWheel(hour, minute, meridiem),
      estimatedCost: Number(cost) || 0,
    });
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}>
    <View style={s.head}><Text style={s.title}>{current ? "Edit Itinerary Item" : `Add Itinerary Item · Day ${day}`}</Text><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={23} color="#56637B" /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <View style={s.search}><Ionicons name="search" size={22} color="#6E7D98" /><TextInput ref={searchRef} value={query} onChangeText={(text) => { setQuery(text); if (choice && text !== choice.name) setChoice(null); }} placeholder="Search any place worldwide…" placeholderTextColor="#93A0B4" autoCorrect={false} style={s.searchInput} />{loading ? <ActivityIndicator size="small" color="#5E73F3" /> : query ? <Pressable onPress={() => { setQuery(""); setChoice(null); setResults([]); searchRef.current?.focus(); }}><Ionicons name="close-circle" size={20} color="#A5ADBA" /></Pressable> : null}</View>
      {query.trim().length >= 2 || results.length ? <View style={s.results}>
        {loading && !results.length ? <View style={s.loadingRow}><ActivityIndicator size="small" color="#5E73F3" /><Text style={s.loadingText}>Searching real worldwide locations…</Text></View> : null}
        {!loading && query.trim().length >= 2 && !results.length ? <Text style={s.emptyText}>No exact match. Try the full place name, city, airport, hotel, cafe, or landmark.</Text> : null}
        {results.map((item, index) => { const selected = choice?.id === item.id; return <Pressable key={`${item.id}-${item.latitude}-${item.longitude}`} onPress={() => choose(item)} style={s.result}><LinearGradient colors={selected ? ["#4F7CF7", "#BD6EED"] : ["#3AAEF7", "#9B69F4"]} style={s.resultIcon}><Ionicons name="location" size={19} color="#FFF" /></LinearGradient><View style={s.resultCopy}><Text numberOfLines={1} style={s.resultName}>{item.name}</Text><Text numberOfLines={2} style={s.resultAddress}>{item.displayName}</Text></View>{selected ? <View style={s.check}><Ionicons name="checkmark" size={17} color="#FFF" /></View> : <Ionicons name="navigate-outline" size={20} color="#AAB4C4" />}</Pressable>; })}
        <View style={s.powered}><Ionicons name="map-outline" size={15} color="#96A4BA" /><Text style={s.poweredText}>Worldwide OpenStreetMap / Photon search</Text></View>
      </View> : <View style={s.searchHelp}><Ionicons name="globe-outline" size={18} color="#73839B" /><Text style={s.searchHelpText}>Type at least 2 characters. Cebu, Manila, Tokyo, airports, hotels, cafes, restaurants and landmarks are all searchable.</Text></View>}

      {choice ? <View style={s.mapWrap}><TripMapSurface activities={mapActivities} selectedActivityId="preview" height={220} /><View style={s.mapLabel}><Text style={s.mapLabelText}>{choice.name}</Text></View><View style={s.mapNavigate}><Ionicons name="navigate" size={22} color="#25324C" /></View></View> : null}
      {choice ? <View style={s.detected}><View style={s.detectedIcon}><Ionicons name="checkmark" size={16} color="#FFF" /></View><Text style={s.detectedText}>Mapped at {choice.latitude.toFixed(4)}, {choice.longitude.toFixed(4)}</Text><Pressable onPress={() => { setQuery(""); setChoice(null); setResults([]); searchRef.current?.focus(); }}><Text style={s.change}>Change</Text></Pressable></View> : null}

      <View style={s.scheduleHead}><View style={s.scheduleTitleRow}><Ionicons name="time-outline" size={20} color="#34435F" /><Text style={s.scheduleTitle}>Schedule</Text></View><View style={s.timezone}><Text style={s.timezoneText}>Local time</Text></View></View>
      <View style={s.wheels}><TimeWheel values={Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))} value={hour} onChange={setHour} /><TimeWheel values={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))} value={minute} onChange={setMinute} /><TimeWheel values={["AM", "PM"]} value={meridiem} onChange={(next) => setMeridiem(next as "AM" | "PM")} /></View>

      <View style={s.fieldLabelRow}><Ionicons name="cash-outline" size={20} color="#40506B" /><Text style={s.fieldLabel}>Estimated cost (PHP)</Text></View><TextInput value={cost} onChangeText={(text) => setCost(text.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8F9AAF" style={s.input} />
      <View style={s.fieldLabelRow}><Ionicons name="document-text-outline" size={20} color="#40506B" /><Text style={s.fieldLabel}>Notes (optional)</Text></View><View style={s.notesWrap}><TextInput value={notes} onChangeText={(text) => setNotes(text.slice(0, 200))} multiline placeholder="Add notes about this stop…" placeholderTextColor="#8F9AAF" style={s.notes} /><Text style={s.count}>{notes.length}/200</Text></View>

      {!choice ? <View style={s.chooseWarning}><Ionicons name="location-outline" size={18} color="#8A6A32" /><Text style={s.chooseWarningText}>Choose a search result before saving so TRAVA stores the real map coordinates.</Text></View> : null}
      <View style={s.actions}>{onDelete ? <Pressable onPress={onDelete} style={s.delete}><Ionicons name="trash-outline" size={20} color="#EF4260" /><Text style={s.deleteText}>Delete</Text></Pressable> : null}<Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={!choice} onPress={save} style={[s.savePress, !choice && { opacity: .4 }]}><LinearGradient colors={["#76B7F8", "#A2A7F3", "#EF8AB8"]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={s.save}><Text style={s.saveText}>{current ? "Save changes" : "Add activity"}</Text></LinearGradient></Pressable></View>
    </ScrollView>
  </View></View></Modal>;
}

function toChoice(item: WorldPlaceResult): LocationChoice { return { id: item.id, name: item.name, displayName: item.displayName, latitude: item.latitude, longitude: item.longitude }; }
function dedupe(items: LocationChoice[]) { const seen = new Set<string>(); return items.filter((item) => { const key = `${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function TimeWheel({ values, value, onChange }: { values: string[]; value: string; onChange(value: string): void }) { const index = Math.max(0, values.indexOf(value)); const before = values[(index - 1 + values.length) % values.length]; const after = values[(index + 1) % values.length]; return <View style={s.wheel}><Pressable onPress={() => onChange(before)}><Text style={s.wheelFade}>{before}</Text></Pressable><View style={s.wheelSelected}><Text style={s.wheelSelectedText}>{value}</Text></View><Pressable onPress={() => onChange(after)}><Text style={s.wheelFade}>{after}</Text></Pressable></View>; }
function toWheel(time: string) { const [hRaw = "8", mRaw = "00"] = time.split(":"); let h = Number(hRaw); const meridiem: "AM" | "PM" = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return { hour: String(h).padStart(2, "0"), minute: String(Number(mRaw) || 0).padStart(2, "0"), meridiem }; }
function fromWheel(hour: string, minute: string, meridiem: "AM" | "PM") { let h = Number(hour) % 12; if (meridiem === "PM") h += 12; return `${String(h).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`; }

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(19,29,51,.34)" }, modal: { width: "100%", maxWidth: 640, maxHeight: "94%", borderRadius: 31, backgroundColor: "#FFF", borderWidth: 1, borderColor: "rgba(255,255,255,.72)", boxShadow: "0 30px 70px rgba(27,38,63,.20)" }, head: { height: 76, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { color: "#101A35", fontSize: 20, fontWeight: "900" }, close: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#E4E8EF" }, scroll: { paddingHorizontal: 22, paddingBottom: 22 },
  search: { minHeight: 58, paddingHorizontal: 15, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#DFE4EC" }, searchInput: { flex: 1, minHeight: 54, color: "#17213B", fontSize: 13, fontWeight: "700" }, results: { marginTop: 12, overflow: "hidden", borderRadius: 19, borderWidth: 1, borderColor: "#E3E7EE", backgroundColor: "#FFF" }, result: { minHeight: 67, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8ECF2" }, resultIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" }, resultCopy: { flex: 1, minWidth: 0 }, resultName: { color: "#17213B", fontSize: 12, fontWeight: "900" }, resultAddress: { marginTop: 4, color: "#7A879B", fontSize: 9, lineHeight: 13, fontWeight: "600" }, check: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#2E6DF6" }, loadingRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9 }, loadingText: { color: "#6E7C91", fontSize: 10, fontWeight: "700" }, emptyText: { padding: 14, color: "#768399", fontSize: 10, lineHeight: 15, fontWeight: "600" }, powered: { minHeight: 38, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FAFBFD" }, poweredText: { color: "#96A4BA", fontSize: 8, fontWeight: "700" }, searchHelp: { marginTop: 10, minHeight: 54, paddingHorizontal: 13, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#EBEEF3" }, searchHelpText: { flex: 1, color: "#768399", fontSize: 9, lineHeight: 14, fontWeight: "600" },
  mapWrap: { marginTop: 14, height: 220, overflow: "hidden", borderRadius: 18, position: "relative" }, mapLabel: { position: "absolute", left: 0, right: 0, bottom: 18, alignItems: "center" }, mapLabelText: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(255,255,255,.84)", color: "#2447A1", fontSize: 11, fontWeight: "900" }, mapNavigate: { position: "absolute", right: 15, bottom: 15, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.96)", boxShadow: "0 8px 19px rgba(38,56,88,.16)" }, detected: { marginTop: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#F4FAF7", borderWidth: 1, borderColor: "#E2F0E8" }, detectedIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#4DB58B" }, detectedText: { flex: 1, color: "#4C9A78", fontSize: 10, fontWeight: "800" }, change: { color: "#674BFF", fontSize: 10, fontWeight: "900" },
  scheduleHead: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, scheduleTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, scheduleTitle: { color: "#34435F", fontSize: 12, fontWeight: "900" }, timezone: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "#F2F6FB" }, timezoneText: { color: "#5C6E8A", fontSize: 9, fontWeight: "800" }, wheels: { marginTop: 9, height: 118, flexDirection: "row", justifyContent: "center", gap: 2 }, wheel: { width: 120, alignItems: "center", justifyContent: "center" }, wheelFade: { height: 32, textAlign: "center", color: "#B7BBC4", fontSize: 15, fontWeight: "600" }, wheelSelected: { width: "100%", height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F2F6" }, wheelSelectedText: { color: "#14171E", fontSize: 17, fontWeight: "800" },
  fieldLabelRow: { marginTop: 15, marginBottom: 7, flexDirection: "row", alignItems: "center", gap: 8 }, fieldLabel: { color: "#40506B", fontSize: 11, fontWeight: "900" }, input: { height: 53, paddingHorizontal: 14, borderRadius: 16, color: "#17213B", fontSize: 12, fontWeight: "700", borderWidth: 1, borderColor: "#E2E6EE" }, notesWrap: { minHeight: 88, borderRadius: 16, borderWidth: 1, borderColor: "#E2E6EE", padding: 13, position: "relative" }, notes: { minHeight: 58, color: "#17213B", fontSize: 11, textAlignVertical: "top" }, count: { position: "absolute", right: 12, bottom: 9, color: "#8E9AAF", fontSize: 8, fontWeight: "700" }, chooseWarning: { marginTop: 13, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF8EA", borderWidth: 1, borderColor: "#F2E2B9" }, chooseWarningText: { flex: 1, color: "#8A6A32", fontSize: 9, lineHeight: 14, fontWeight: "700" }, actions: { marginTop: 18, flexDirection: "row", gap: 10 }, delete: { height: 52, paddingHorizontal: 17, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFF0F3" }, deleteText: { color: "#EF4260", fontSize: 11, fontWeight: "900" }, cancel: { flex: 1, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF1F5" }, cancelText: { color: "#66738A", fontSize: 11, fontWeight: "900" }, savePress: { flex: 1.5 }, save: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }, saveText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
});
