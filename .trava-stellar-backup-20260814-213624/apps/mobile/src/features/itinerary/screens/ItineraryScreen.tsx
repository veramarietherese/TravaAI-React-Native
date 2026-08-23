import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityCategory, PlaceSearchResult, TripActivity } from "@trava/shared";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { searchPlaces } from "@/features/maps/api/places.api";
import { TripMapSurface } from "@/features/maps/components/TripMapSurface";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { createActivity, deleteActivity, listActivities, updateActivity, type ActivityInput } from "../api/itinerary.api";

const CATEGORIES: ActivityCategory[] = ["flight", "stay", "food", "sightseeing", "transport", "shopping", "meeting", "other"];
const ICONS: Record<ActivityCategory, string> = { flight: "✈", stay: "▣", food: "◉", sightseeing: "⌖", transport: "↔", shopping: "▱", meeting: "◌", other: "•" };

function emptyActivity(dayNumber: number): ActivityInput {
  return { dayNumber, activityDate: null, title: "", category: "sightseeing", locationName: "", latitude: null, longitude: null, startTime: "09:00", endTime: null, notes: null, estimatedCost: 0 };
}

export function ItineraryScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeDay, setActiveDay] = useState(1);
  const [editor, setEditor] = useState<{ open: boolean; activity: TripActivity | null }>({ open: false, activity: null });
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const activitiesQuery = useQuery({ queryKey: ["trip-activities", tripId], queryFn: () => listActivities(tripId), enabled: Boolean(tripId) });
  const trip = tripQuery.data;
  const activities = activitiesQuery.data ?? [];
  const maxDay = Math.max(1, trip?.numberOfDays ?? 1, ...activities.map((item) => item.dayNumber));
  const dayActivities = activities.filter((item) => item.dayNumber === activeDay).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const saveMutation = useMutation({
    mutationFn: async (input: { value: ActivityInput; id?: string }) => input.id ? updateActivity(tripId, input.id, input.value) : createActivity(tripId, input.value),
    onSuccess: async (saved) => {
      setEditor({ open: false, activity: null });
      setActiveDay(saved.dayNumber);
      setSelectedActivityId(saved.id);
      await queryClient.invalidateQueries({ queryKey: ["trip-activities", tripId] });
    },
    onError: (error) => Alert.alert("Save activity", error instanceof Error ? error.message : "Unable to save this activity."),
  });
  const removeMutation = useMutation({
    mutationFn: (activityId: string) => deleteActivity(tripId, activityId),
    onSuccess: async () => { setSelectedActivityId(null); await queryClient.invalidateQueries({ queryKey: ["trip-activities", tripId] }); },
    onError: (error) => Alert.alert("Delete activity", error instanceof Error ? error.message : "Unable to delete this activity."),
  });

  function confirmDelete(activity: TripActivity) {
    Alert.alert("Delete activity?", `${activity.title} will be removed from the shared itinerary.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeMutation.mutate(activity.id) },
    ]);
  }

  if (!trip) {
    return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" size="large" /> : <Text style={styles.errorText}>{tripQuery.error instanceof Error ? tripQuery.error.message : "Trip unavailable."}</Text>}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} subtitle="Itinerary and map" />
      <ScrollView refreshControl={<RefreshControl refreshing={activitiesQuery.isRefetching} onRefresh={() => void activitiesQuery.refetch()} tintColor="#7257EC" />} contentContainerStyle={styles.content}>
        <View style={styles.maxWidth}>
          <View style={styles.headingRow}><View><Text style={styles.eyebrow}>DAILY PLAN</Text><Text style={styles.heading}>Itinerary</Text><Text style={styles.subheading}>Build a route your whole travel group can follow.</Text></View><Pressable onPress={() => router.push(`/trip/${tripId}/map` as Href)} style={styles.mapButton}><Text style={styles.mapButtonText}>Full map</Text></Pressable></View>
          <TripMapSurface activities={activities} selectedActivityId={selectedActivityId} onSelectActivity={setSelectedActivityId} height={285} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => <Pressable key={day} onPress={() => setActiveDay(day)} style={[styles.day, activeDay === day && styles.dayActive]}><Text style={[styles.dayText, activeDay === day && styles.dayTextActive]}>Day {day}</Text><Text style={[styles.dayCount, activeDay === day && styles.dayCountActive]}>{activities.filter((item) => item.dayNumber === day).length} stops</Text></Pressable>)}
            <Pressable onPress={() => setActiveDay(maxDay + 1)} style={styles.addDay}><Text style={styles.addDayText}>＋</Text></Pressable>
          </ScrollView>

          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Day {activeDay}</Text><Text style={styles.sectionSubtitle}>{dayActivities.length ? `${dayActivities.length} scheduled activities` : "A fresh day ready to plan"}</Text></View><Pressable onPress={() => setEditor({ open: true, activity: null })} style={styles.primaryButton}><Text style={styles.primaryButtonText}>＋ Add activity</Text></Pressable></View>

          {activitiesQuery.isLoading ? <ActivityIndicator color="#7257EC" style={styles.loader} /> : null}
          {!activitiesQuery.isLoading && !dayActivities.length ? <View style={styles.empty}><Text style={styles.emptyIcon}>◷</Text><Text style={styles.emptyTitle}>Nothing scheduled yet</Text><Text style={styles.emptyText}>Add your first stop, search its location, and it will immediately appear on the map.</Text><Pressable onPress={() => setEditor({ open: true, activity: null })} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create first activity</Text></Pressable></View> : null}

          <View style={styles.timeline}>{dayActivities.map((activity, index) => {
            const canEdit = trip.canManageTrip || activity.createdBy === user?.id;
            return <View key={activity.id} style={styles.timelineRow}><View style={styles.timeColumn}><Text style={styles.time}>{activity.startTime}</Text>{activity.endTime ? <Text style={styles.endTime}>{activity.endTime}</Text> : null}</View><View style={styles.rail}><View style={styles.dot}><Text style={styles.dotText}>{index + 1}</Text></View>{index < dayActivities.length - 1 ? <View style={styles.line} /> : null}</View><View style={[styles.activityCard, selectedActivityId === activity.id && styles.activitySelected]}><Pressable onPress={() => setSelectedActivityId(activity.id)} style={styles.activityTop}><View style={styles.categoryIcon}><Text style={styles.categoryGlyph}>{ICONS[activity.category]}</Text></View><View style={styles.activityCopy}><Text style={styles.activityTitle}>{activity.title}</Text><Text style={styles.activityPlace}>{activity.locationName}</Text></View>{activity.estimatedCost > 0 ? <Text style={styles.cost}>{trip.currencyCode} {activity.estimatedCost.toLocaleString()}</Text> : null}</Pressable>{activity.notes ? <Text style={styles.notes}>{activity.notes}</Text> : null}{canEdit ? <View style={styles.activityActions}><Pressable onPress={() => setEditor({ open: true, activity })}><Text style={styles.editLink}>Edit</Text></Pressable><Pressable onPress={() => confirmDelete(activity)}><Text style={styles.deleteLink}>Delete</Text></Pressable></View> : null}</View></View>;
          })}</View>
        </View>
      </ScrollView>
      <ActivityEditorModal key={`${editor.open}-${editor.activity?.id ?? "new"}-${activeDay}`} visible={editor.open} initial={editor.activity} dayNumber={activeDay} currency={trip.currencyCode} saving={saveMutation.isPending} onClose={() => setEditor({ open: false, activity: null })} onSave={(value) => saveMutation.mutate({ value, id: editor.activity?.id })} />
    </SafeAreaView>
  );
}

function ActivityEditorModal({ visible, initial, dayNumber, currency, saving, onClose, onSave }: { visible: boolean; initial: TripActivity | null; dayNumber: number; currency: string; saving: boolean; onClose(): void; onSave(value: ActivityInput): void }) {
  const [form, setForm] = useState<ActivityInput>(() => initial ? toInput(initial) : emptyActivity(dayNumber));
  const [search, setSearch] = useState(initial?.locationName ?? "");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetKey = `${visible}-${initial?.id ?? "new"}-${dayNumber}`;
  return <Modal key={resetKey} visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{initial ? "Edit activity" : "New activity"}</Text><Text style={styles.modalSubtitle}>Day {dayNumber} · shared with accepted members</Text></View><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
    <Field label="Activity title" value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="e.g. Check in at hotel" />
    <Text style={styles.fieldLabel}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{CATEGORIES.map((category) => <Pressable key={category} onPress={() => setForm((current) => ({ ...current, category }))} style={[styles.categoryChoice, form.category === category && styles.categoryChoiceActive]}><Text style={[styles.categoryChoiceText, form.category === category && styles.categoryChoiceTextActive]}>{ICONS[category]} {category}</Text></Pressable>)}</ScrollView>
    <Text style={styles.fieldLabel}>Location</Text><View style={styles.searchRow}><TextInput value={search} onChangeText={setSearch} placeholder="Search a place or address" placeholderTextColor="#98A1B3" style={[styles.input, styles.searchInput]} /><Pressable disabled={searching || search.trim().length < 3} onPress={async () => { setSearching(true); setError(null); try { setResults(await searchPlaces(search)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Location search failed."); } finally { setSearching(false); } }} style={styles.searchButton}><Text style={styles.searchButtonText}>{searching ? "…" : "Search"}</Text></Pressable></View>
    {results.length ? <View style={styles.results}>{results.map((place) => <Pressable key={place.id} onPress={() => { setForm((current) => ({ ...current, locationName: place.displayName, latitude: place.latitude, longitude: place.longitude })); setSearch(place.displayName); setResults([]); }} style={styles.result}><Text style={styles.resultTitle}>{place.name}</Text><Text numberOfLines={2} style={styles.resultText}>{place.displayName}</Text></Pressable>)}</View> : null}
    {form.latitude !== null && form.longitude !== null ? <Text style={styles.coordinate}>Mapped at {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}</Text> : <Text style={styles.helper}>Choose a search result to add a native map marker.</Text>}
    <View style={styles.formRow}><Field compact label="Start time" value={form.startTime} onChangeText={(value) => setForm((current) => ({ ...current, startTime: value }))} placeholder="09:00" /><Field compact label="End time" value={form.endTime ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, endTime: value || null }))} placeholder="10:30" /></View>
    <View style={styles.formRow}><Field compact label="Date (optional)" value={form.activityDate ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, activityDate: value || null }))} placeholder="YYYY-MM-DD" /><Field compact label={`Estimated cost (${currency})`} value={String(form.estimatedCost || "")} onChangeText={(value) => setForm((current) => ({ ...current, estimatedCost: Number(value || 0) }))} keyboardType="decimal-pad" placeholder="0" /></View>
    <Field label="Notes" value={form.notes ?? ""} onChangeText={(value) => setForm((current) => ({ ...current, notes: value || null }))} placeholder="Reservation details, reminders, dress code…" multiline />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
    <Pressable disabled={saving} onPress={() => { if (form.title.trim().length < 2 || search.trim().length < 2) { setError("Add an activity title and location."); return; } if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime)) { setError("Use 24-hour HH:MM for the start time."); return; } onSave({ ...form, dayNumber, title: form.title.trim(), locationName: search.trim() }); }} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{initial ? "Save changes" : "Add to itinerary"}</Text>}</Pressable>
  </ScrollView></View></View></Modal>;
}

function toInput(activity: TripActivity): ActivityInput { return { dayNumber: activity.dayNumber, activityDate: activity.activityDate, title: activity.title, category: activity.category, locationName: activity.locationName, latitude: activity.latitude, longitude: activity.longitude, startTime: activity.startTime, endTime: activity.endTime, notes: activity.notes, estimatedCost: activity.estimatedCost }; }
function Field({ label, compact, multiline, ...props }: { label: string; compact?: boolean; multiline?: boolean } & ComponentProps<typeof TextInput>) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#98A1B3" style={[styles.input, multiline && styles.multiline]} /></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FF", padding: 24 }, content: { padding: 16, paddingBottom: 70 }, maxWidth: { width: "100%", maxWidth: 820, alignSelf: "center" },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }, eyebrow: { color: "#7257EC", fontSize: 9, letterSpacing: 1.2, fontWeight: "900" }, heading: { marginTop: 3, color: "#15213A", fontSize: 28, fontWeight: "900" }, subheading: { marginTop: 4, color: "#7B869B", fontSize: 11, lineHeight: 16, fontWeight: "600" }, mapButton: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, backgroundColor: "#17223C" }, mapButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  days: { paddingVertical: 16, gap: 8 }, day: { minWidth: 84, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E8F1" }, dayActive: { backgroundColor: "#7257EC", borderColor: "#7257EC" }, dayText: { color: "#4D5A73", fontSize: 11, fontWeight: "900" }, dayTextActive: { color: "#FFFFFF" }, dayCount: { marginTop: 3, color: "#9AA2B1", fontSize: 8, fontWeight: "700" }, dayCountActive: { color: "#DED7FF" }, addDay: { width: 48, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#EEEAFE" }, addDayText: { color: "#7257EC", fontSize: 23, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }, sectionTitle: { color: "#17223C", fontSize: 20, fontWeight: "900" }, sectionSubtitle: { marginTop: 3, color: "#8490A4", fontSize: 10, fontWeight: "600" }, primaryButton: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, backgroundColor: "#FF6F91" }, primaryButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" }, loader: { marginVertical: 28 },
  empty: { alignItems: "center", padding: 32, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EBF3" }, emptyIcon: { color: "#7257EC", fontSize: 38 }, emptyTitle: { marginTop: 8, color: "#17223C", fontSize: 17, fontWeight: "900" }, emptyText: { marginTop: 6, maxWidth: 320, textAlign: "center", color: "#7F8A9E", fontSize: 10, lineHeight: 16, fontWeight: "600" }, emptyButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, backgroundColor: "#7257EC" }, emptyButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  timeline: { gap: 0 }, timelineRow: { flexDirection: "row", alignItems: "stretch", minHeight: 118 }, timeColumn: { width: 62, paddingTop: 16 }, time: { color: "#475672", fontSize: 10, fontWeight: "900" }, endTime: { marginTop: 4, color: "#A0A7B5", fontSize: 8, fontWeight: "700" }, rail: { width: 34, alignItems: "center" }, dot: { marginTop: 14, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F0ECFF", borderWidth: 2, borderColor: "#7257EC", zIndex: 2 }, dotText: { color: "#7257EC", fontSize: 9, fontWeight: "900" }, line: { flex: 1, width: 2, backgroundColor: "#C9BFFF" }, activityCard: { flex: 1, marginBottom: 12, padding: 14, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EBF2" }, activitySelected: { borderColor: "#7257EC", backgroundColor: "#FBFAFF" }, activityTop: { flexDirection: "row", alignItems: "center", gap: 10 }, categoryIcon: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#F0ECFF" }, categoryGlyph: { color: "#7257EC", fontSize: 20, fontWeight: "900" }, activityCopy: { flex: 1, minWidth: 0 }, activityTitle: { color: "#17223C", fontSize: 13, fontWeight: "900" }, activityPlace: { marginTop: 4, color: "#748097", fontSize: 9, lineHeight: 13, fontWeight: "600" }, cost: { color: "#7257EC", fontSize: 9, fontWeight: "900" }, notes: { marginTop: 10, color: "#66738A", fontSize: 10, lineHeight: 16, fontWeight: "600" }, activityActions: { marginTop: 11, flexDirection: "row", gap: 16 }, editLink: { color: "#7257EC", fontSize: 9, fontWeight: "900" }, deleteLink: { color: "#C83B4A", fontSize: 9, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,15,30,0.48)" }, modalSheet: { maxHeight: "94%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#FFFFFF" }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: "#ECEEF5" }, modalTitle: { color: "#17223C", fontSize: 20, fontWeight: "900" }, modalSubtitle: { marginTop: 3, color: "#8791A3", fontSize: 9, fontWeight: "600" }, close: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#F1F2F7" }, closeText: { color: "#4F5B71", fontSize: 22, fontWeight: "700" }, modalContent: { padding: 18, paddingBottom: 38, gap: 12 }, field: { width: "100%" }, fieldCompact: { flex: 1, minWidth: 0 }, fieldLabel: { marginBottom: 6, color: "#536078", fontSize: 9, fontWeight: "900" }, input: { minHeight: 47, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: "#F4F5F9", color: "#17223C", fontSize: 11, fontWeight: "700" }, multiline: { minHeight: 90, textAlignVertical: "top" }, categories: { gap: 7 }, categoryChoice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 13, backgroundColor: "#F3F4F8" }, categoryChoiceActive: { backgroundColor: "#7257EC" }, categoryChoiceText: { color: "#657188", fontSize: 9, fontWeight: "800", textTransform: "capitalize" }, categoryChoiceTextActive: { color: "#FFFFFF" }, searchRow: { flexDirection: "row", gap: 8 }, searchInput: { flex: 1 }, searchButton: { minWidth: 72, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#17223C" }, searchButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" }, results: { overflow: "hidden", borderRadius: 15, borderWidth: 1, borderColor: "#E6E8F1" }, result: { padding: 11, backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7E9F1" }, resultTitle: { color: "#17223C", fontSize: 10, fontWeight: "900" }, resultText: { marginTop: 3, color: "#7C879A", fontSize: 9, lineHeight: 13, fontWeight: "600" }, coordinate: { color: "#3E8A68", fontSize: 9, fontWeight: "800" }, helper: { color: "#929AAA", fontSize: 9, lineHeight: 14, fontWeight: "600" }, formRow: { flexDirection: "row", gap: 9 }, saveButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#7257EC" }, saveButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.55 }, errorText: { color: "#C83B4A", fontSize: 10, lineHeight: 15, fontWeight: "700" },
});
