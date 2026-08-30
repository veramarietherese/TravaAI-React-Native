import { TravaButton } from "@/components/ui/TravaButton";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TravaGlassNav } from "@/components/navigation/TravaGlassNav";
import { tripCoverSource } from "@/components/travel/trip-cover-images";
import { SearchableLocationField, type LocationChoice } from "@/features/maps/components/SearchableLocationField";
import { TripMapSurface } from "@/features/maps/components/TripMapSurface";
import { PremiumCategoryIcon } from "@/features/trips/components/PremiumCategoryIcon";
import type { TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalActivity } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";
import { fetchTripWeather, type TripWeather } from "@/features/trips/utils/weather";

type MapMode = "map" | "satellite";

const WORKSPACE_TABS = [
  ["Overview", ""],
  ["Itinerary", "/itinerary"],
  ["Budget", "/budget"],
  ["Expenses", "/expenses"],
  ["Checklist", "/checklist"],
  ["Documents", "/documents"],
] as const;

const CATEGORY_META: Record<LocalActivity["category"], { label: string; icon: TravaIconName; accent: string }> = {
  flight: { label: "Airport", icon: "airplane-outline", accent: "#2E9BFF" },
  stay: { label: "Hotel", icon: "bed-outline", accent: "#FF6AAE" },
  food: { label: "Food", icon: "restaurant-outline", accent: "#FF4F91" },
  sightseeing: { label: "Attraction", icon: "camera-outline", accent: "#8F5CFF" },
  transport: { label: "Transport", icon: "train-outline", accent: "#6653FF" },
  shopping: { label: "Shopping", icon: "bag-handle-outline", accent: "#31B870" },
  meeting: { label: "Work", icon: "briefcase-outline", accent: "#5D77D7" },
  other: { label: "Activity", icon: "location-outline", accent: "#7A87A0" },
};

export function ItineraryScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compact = width < 760;
  const { trip } = useTripLite(tripId);
  const { state, addActivity, updateActivity, deleteActivity, setDayCount, deleteDay } = useLocalTripWorkspace(tripId);

  const [day, setDay] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<LocalActivity | null | "new">(null);
  const [weather, setWeather] = useState<TripWeather | null>(null);
  const [deleteDayOpen, setDeleteDayOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("map");
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapY, setMapY] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const totalDays = useMemo(
    () => state.manualDayCount ?? Math.max(
      tripDayCount(trip.startDate, trip.endDate, state.activities),
      state.dayCountOverride ?? 1,
    ),
    [trip.startDate, trip.endDate, state.activities, state.dayCountOverride, state.manualDayCount],
  );

  const dayItems = useMemo(
    () => state.activities
      .filter((activity) => activity.dayNumber === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [state.activities, day],
  );

  const mappedCount = useMemo(
    () => state.activities.filter((activity) => activity.latitude != null && activity.longitude != null).length,
    [state.activities],
  );

  useEffect(() => {
    const anchor = dayItems.find((item) => item.latitude != null && item.longitude != null);
    if (!anchor || anchor.latitude == null || anchor.longitude == null) {
      const timer = setTimeout(() => setWeather(null), 0);
      return () => clearTimeout(timer);
    }
    let live = true;
    void fetchTripWeather(anchor.latitude, anchor.longitude, anchor.locationName)
      .then((value) => { if (live) setWeather(value); });
    return () => { live = false; };
  }, [dayItems]);

  function openMapFor(activity: LocalActivity) {
    setSelected(activity.id);
    setDay(activity.dayNumber);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, mapY - 12), animated: true });
    });
  }

  function handleMapSelect(activityId: string) {
    setSelected(activityId);
    const activity = state.activities.find((item) => item.id === activityId);
    if (activity) setDay(activity.dayNumber);
  }

  function showTripMenu() {
    Alert.alert("Trip options", "Manage this itinerary without leaving the workspace.", [
      { text: "Edit trip", onPress: () => router.push(`/trip/${tripId}/edit` as Href) },
      { text: `Delete Day ${day}`, style: "destructive", onPress: () => setDeleteDayOpen(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const mapHeight = compact ? 330 : 370;
  const fullscreenHeight = Math.max(360, height - 170);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={s.screen}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.pageScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.max}>
            <View style={[s.hero, compact && s.heroCompact]}>
              <Image
                source={tripCoverSource({ name: trip.name, destination: trip.destination, coverImageUrl: trip.coverImageUrl }, 0)}
                contentFit="cover"
                contentPosition="center"
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["rgba(241,249,255,.74)", "rgba(255,255,255,.62)", "rgba(255,245,250,.40)"]}
                locations={[0, 0.52, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["rgba(255,255,255,.86)", "rgba(255,255,255,.22)", "rgba(255,255,255,.06)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to trips"
                onPress={() => router.replace("/(traveler)/(tabs)/trips" as Href)}
                style={({ pressed }) => [s.heroBack, pressed && s.pressed]}
              >
                <Ionicons name="chevron-back" size={24} color="#17233F" />
              </Pressable>

              <View style={[s.heroActions, compact && s.heroActionsCompact]}>
                <View style={s.peopleWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open travel group"
                    onPress={() => router.push(`/trip/${tripId}/members` as Href)}
                    style={({ pressed }) => [s.heroAction, pressed && s.pressed]}
                  >
                    <Ionicons name="people-outline" size={20} color="#17233F" />
                  </Pressable>
                  <View pointerEvents="none" style={s.presenceDot} />
                </View>
                <View style={s.peopleWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Trip notifications"
                    onPress={() => Alert.alert("Trip notifications", "You’re all caught up for this trip.")}
                    style={({ pressed }) => [s.heroAction, pressed && s.pressed]}
                  >
                    <Ionicons name="notifications-outline" size={20} color="#17233F" />
                  </Pressable>
                  <View pointerEvents="none" style={s.notificationDot} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More trip options"
                  onPress={showTripMenu}
                  style={({ pressed }) => [s.heroAction, pressed && s.pressed]}
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color="#17233F" />
                </Pressable>
              </View>

              <View style={[s.heroCopy, compact && s.heroCopyCompact]}>
                <View style={s.statusPill}>
                  <Ionicons name="airplane-outline" size={13} color="#6480AE" />
                  <Text style={s.statusText}>{trip.status === "ongoing" ? "Active trip" : "Upcoming trip"}</Text>
                </View>
                <Text numberOfLines={2} style={[s.heroTitle, compact && s.heroTitleCompact]}>{trip.name || trip.destination || "Trip"}</Text>
                <View style={[s.heroMeta, compact && s.heroMetaCompact]}>
                  <Meta icon="calendar-outline" text={formatDateRange(trip.startDate, trip.endDate)} />
                  <Meta icon="location-outline" text={trip.destination || "Destination pending"} />
                  <Meta icon="people-outline" text={`${totalDays} ${totalDays === 1 ? "day" : "days"} · ${Math.max(1, trip.memberCount || 1)} ${Math.max(1, trip.memberCount || 1) === 1 ? "traveler" : "travelers"}`} />
                </View>
                <Text numberOfLines={2} style={s.heroDescription}>
                  {trip.description?.trim() || `Plan every stop, route, meal, and moment for ${trip.destination || "this trip"}.`}
                </Text>
              </View>
            </View>

            <WorkspaceTabs tripId={tripId} router={router} />

            <View onLayout={(event) => setMapY(event.nativeEvent.layout.y)} style={s.mapCard}>
              <TripMapSurface
                activities={state.activities}
                selectedActivityId={selected}
                onSelectActivity={handleMapSelect}
                height={mapHeight}
                mapMode={mapMode}
              />

              <View pointerEvents="none" style={s.mapLabel}>
                <View style={s.mapLabelIcon}><Ionicons name="map-outline" size={19} color="#2478FF" /></View>
                <View>
                  <Text style={s.mapLabelTitle}>Interactive itinerary map</Text>
                  <Text style={s.mapLabelSub}>Explore your destinations, route, and daily stops.</Text>
                </View>
              </View>

              <View style={s.mapTools}>
                <View style={s.mapModeToggle}>
                  <Pressable onPress={() => setMapMode("map")} style={[s.mapModeButton, mapMode === "map" && s.mapModeActive]}>
                    <Text style={[s.mapModeText, mapMode === "map" && s.mapModeTextActive]}>Map</Text>
                  </Pressable>
                  <Pressable onPress={() => setMapMode("satellite")} style={[s.mapModeButton, mapMode === "satellite" && s.mapModeActive]}>
                    <Text style={[s.mapModeText, mapMode === "satellite" && s.mapModeTextActive]}>Satellite</Text>
                  </Pressable>
                </View>
                <Pressable accessibilityLabel="Open map fullscreen" onPress={() => setMapFullscreen(true)} style={({ pressed }) => [s.fullscreenButton, pressed && s.pressed]}>
                  <Ionicons name="expand-outline" size={19} color="#263754" />
                </Pressable>
              </View>

              <View pointerEvents="none" style={s.routeBadge}>
                <View style={s.routeBadgeIcon}><Ionicons name="git-branch-outline" size={21} color="#2679FF" /></View>
                <View>
                  <Text style={s.routeTitle}>{mappedCount} mapped {mappedCount === 1 ? "stop" : "stops"}</Text>
                  <Text style={s.routeSub}>Full trip route</Text>
                </View>
              </View>
            </View>

            <View style={s.daysSection}>
              <View>
                <Text style={s.sectionTitle}>Trip days</Text>
                <Text style={s.sectionSub}>Tap a day to view its schedule.</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.daysRow}>
                {Array.from({ length: totalDays }, (_, index) => index + 1).map((dayNumber) => (
                  <Pressable
                    key={`day-${dayNumber}`}
                    accessibilityLabel={`Open Day ${dayNumber}`}
                    onPress={() => setDay(dayNumber)}
                    style={({ pressed }) => [
                      s.dayChip,
                      day === dayNumber && s.dayChipActive,
                      pressed && s.dayChipPressed,
                    ]}
                  >
                    {day === dayNumber ? (
                      <LinearGradient colors={["#34B8FF", "#4B8DFF"]} style={StyleSheet.absoluteFill} />
                    ) : null}
                    <Text style={[s.dayChipTitle, day === dayNumber && s.dayChipTitleActive]}>Day {dayNumber}</Text>
                    <Text style={[s.dayChipDate, day === dayNumber && s.dayChipDateActive]}>{shortDayDate(trip.startDate, dayNumber)}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityLabel="Add another trip day"
                  onPress={() => {
                    const next = totalDays + 1;
                    setDayCount(next);
                    setDay(next);
                  }}
                  style={({ pressed }) => [s.addDayChip, pressed && s.pressed]}
                >
                  <Ionicons name="add" size={21} color="#1676F3" />
                  <Text style={s.addDayText}>Add day</Text>
                </Pressable>
              </ScrollView>
            </View>

            <View style={s.timelineCard}>
              <View style={[s.timelineHeader, compact && s.timelineHeaderCompact]}>
                <View style={s.timelineHeaderCopy}>
                  <Text style={s.timelineTitle}>Day {day} · {dayLabel(trip.startDate, day)}</Text>
                  <Text style={s.timelineSubtitle}>
                    {dayItems.length ? `${dayItems.length} scheduled ${dayItems.length === 1 ? "activity" : "activities"}` : "Nothing scheduled yet"}
                  </Text>
                </View>
                <View style={s.timelineHeaderActions}>
                  <View style={s.weatherPill}>
                    <Ionicons name={weatherIcon(weather?.label)} size={21} color="#F5A623" />
                    <View>
                      <Text style={s.weatherTemperature}>{weather?.temperature != null ? `${Math.round(weather.temperature)}°C` : "Weather"}</Text>
                      <Text numberOfLines={1} style={s.weatherLabel}>{weather?.label || "Tap a mapped stop"}</Text>
                    </View>
                  </View>
                  <Pressable accessibilityLabel={`Delete Day ${day}`} onPress={() => setDeleteDayOpen(true)} style={({ pressed }) => [s.dayMenuButton, pressed && s.pressed]}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#75839A" />
                  </Pressable>
                </View>
              </View>

              {dayItems.length === 0 ? (
                <View style={s.emptyDay}>
                  <View style={s.emptySparkles}>
                    <Ionicons name="sparkles" size={18} color="#BFD5FF" />
                    <View style={s.emptyCalendar}><Ionicons name="calendar-outline" size={27} color="#5D91FF" /></View>
                    <Ionicons name="sparkles" size={14} color="#E1C9FF" />
                  </View>
                  <Text style={s.emptyTitle}>This day is open</Text>
                  <Text style={s.emptyText}>Add your first activity and choose a real location from search. It will appear on the map immediately.</Text>
                </View>
              ) : (
                <View style={s.timelineList}>
                  {dayItems.map((activity, index) => {
                    const meta = CATEGORY_META[activity.category] ?? CATEGORY_META.other;
                    return (
                      <View key={activity.id} style={[s.timelineRow, index === dayItems.length - 1 && s.timelineRowLast]}>
                        <View style={s.timeColumn}>
                          <View style={[s.timelineDot, { borderColor: meta.accent }]}><View style={[s.timelineDotInner, { backgroundColor: meta.accent }]} /></View>
                          {index < dayItems.length - 1 ? <View style={s.timelineRail} /> : null}
                          <Text style={s.timeText}>{clock(activity.startTime)}</Text>
                        </View>

                        <View style={s.activityIconWrap}>
                          <PremiumCategoryIcon category={activity.category} size={48} />
                        </View>

                        <Pressable onPress={() => openMapFor(activity)} style={({ pressed }) => [s.activityCopy, pressed && { opacity: .76 }]}>
                          <Text numberOfLines={2} style={s.activityTitle}>{activity.title}</Text>
                          <Text numberOfLines={1} style={s.activityMeta}>{meta.label} · {shortLocation(activity.locationName)}</Text>
                          {activity.detail ? <Text numberOfLines={1} style={s.activityDetail}>{activity.detail}</Text> : null}
                          <View style={s.activityBadges}>
                            {activity.estimatedCost > 0 ? (
                              <View style={s.costBadge}><Text style={s.costBadgeText}>{formatCost(activity.estimatedCost, trip.currencyCode)}</Text></View>
                            ) : null}
                            {activity.latitude != null && activity.longitude != null ? (
                              <View style={s.mappedBadge}><Ionicons name="location-outline" size={12} color="#2D77E8" /><Text style={s.mappedBadgeText}>Mapped</Text></View>
                            ) : null}
                          </View>
                        </Pressable>

                        <View style={s.activityActions}>
                          {activity.latitude != null && activity.longitude != null ? (
                            <Pressable accessibilityLabel={`View ${activity.title} on map`} onPress={() => openMapFor(activity)} style={({ pressed }) => [s.viewMapButton, pressed && s.pressed]}>
                              <Ionicons name="location-outline" size={15} color="#2775E7" />
                              {!compact ? <Text style={s.viewMapText}>View on map</Text> : null}
                            </Pressable>
                          ) : null}
                          <Pressable accessibilityLabel={`Edit ${activity.title}`} onPress={() => setEditor(activity)} style={({ pressed }) => [s.moreActivityButton, pressed && s.pressed]}>
                            <Ionicons name="ellipsis-horizontal" size={20} color="#5E6C83" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <TravaButton tone="blue" label={`Add activity to Day ${day}`} icon="add-outline" trailingIcon="chevron-forward" onPress={() => setEditor("new")} style={{ marginTop: 18 }} />
            </View>
          </View>
        </ScrollView>

        <TravaGlassNav placement="floating" />

        <Modal visible={mapFullscreen} transparent animationType="fade" onRequestClose={() => setMapFullscreen(false)}>
          <View style={s.fullscreenBackdrop}>
            <View style={s.fullscreenCard}>
              <View style={s.fullscreenHead}>
                <View>
                  <Text style={s.fullscreenTitle}>Full trip route</Text>
                  <Text style={s.fullscreenSub}>{mappedCount} mapped {mappedCount === 1 ? "stop" : "stops"}</Text>
                </View>
                <View style={s.fullscreenHeadActions}>
                  <View style={s.mapModeToggle}>
                    <Pressable onPress={() => setMapMode("map")} style={[s.mapModeButton, mapMode === "map" && s.mapModeActive]}><Text style={[s.mapModeText, mapMode === "map" && s.mapModeTextActive]}>Map</Text></Pressable>
                    <Pressable onPress={() => setMapMode("satellite")} style={[s.mapModeButton, mapMode === "satellite" && s.mapModeActive]}><Text style={[s.mapModeText, mapMode === "satellite" && s.mapModeTextActive]}>Satellite</Text></Pressable>
                  </View>
                  <Pressable accessibilityLabel="Close fullscreen map" onPress={() => setMapFullscreen(false)} style={s.fullscreenClose}><Ionicons name="close" size={22} color="#263754" /></Pressable>
                </View>
              </View>
              <TripMapSurface
                activities={state.activities}
                selectedActivityId={selected}
                onSelectActivity={handleMapSelect}
                height={fullscreenHeight}
                mapMode={mapMode}
              />
            </View>
          </View>
        </Modal>

        <Modal visible={deleteDayOpen} transparent animationType="fade" onRequestClose={() => setDeleteDayOpen(false)}>
          <View style={s.backdrop}>
            <View style={s.deleteDayModal}>
              <View style={s.deleteDayIcon}><Ionicons name="trash-outline" size={26} color="#D96883" /></View>
              <Text style={s.deleteDayTitle}>Delete Day {day}?</Text>
              <Text style={s.deleteDayBody}>Activities on this day will be removed, and later days will shift forward.</Text>
              <View style={s.deleteDayActions}>
                <Pressable onPress={() => setDeleteDayOpen(false)} style={s.cancelDelete}><Text style={s.cancelDeleteText}>Cancel</Text></Pressable>
                <Pressable
                  onPress={() => {
                    const next = Math.max(1, totalDays - 1);
                    deleteDay(day);
                    setDay(Math.min(Math.max(1, day - 1), next));
                    setDeleteDayOpen(false);
                  }}
                  style={s.confirmDelete}
                >
                  <Text style={s.confirmDeleteText}>Delete day</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <ActivityModal
          key={`activity-modal-${editor === "new" ? "new" : editor?.id ?? "idle"}-${day}`}
          value={editor}
          day={day}
          currencyCode={trip.currencyCode}
          onClose={() => setEditor(null)}
          onSave={(input) => {
            if (editor && editor !== "new") updateActivity(editor.id, input);
            else addActivity({ dayNumber: day, ...input });
            setEditor(null);
          }}
          onDelete={editor && editor !== "new" ? () => { deleteActivity(editor.id); setEditor(null); } : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

function WorkspaceTabs({ tripId, router }: { tripId: string; router: ReturnType<typeof useRouter> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
      {WORKSPACE_TABS.map(([label, suffix]) => {
        const active = label === "Itinerary";
        const target = `/trip/${tripId}${suffix}`;
        return (
          <Pressable
            key={label}
            onPress={() => router.replace(target as Href)}
            style={({ pressed }) => [s.tab, active && s.tabActive, pressed && s.tabPressed]}
          >
            <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Meta({ icon, text }: { icon: TravaIconName; text: string }) {
  return <View style={s.metaItem}><Ionicons name={icon} size={16} color="#345177" /><Text style={s.metaText}>{text}</Text></View>;
}

function ActivityModal({ value, day, currencyCode, onClose, onSave, onDelete }: {
  value: LocalActivity | null | "new";
  day: number;
  currencyCode: string;
  onClose(): void;
  onSave(value: Omit<LocalActivity, "id" | "dayNumber">): void;
  onDelete?: () => void;
}) {
  const current = value && value !== "new" ? value : null;
  const [title, setTitle] = useState(current?.title ?? "");
  const [place, setPlace] = useState(current?.locationName ?? "");
  const [choice, setChoice] = useState<LocationChoice | null>(
    current?.latitude != null && current.longitude != null
      ? {
          id: current.id,
          name: current.locationName,
          displayName: current.locationName,
          latitude: current.latitude,
          longitude: current.longitude,
        }
      : null,
  );
  const [category, setCategory] = useState<LocalActivity["category"]>(current?.category ?? "sightseeing");
  const [time, setTime] = useState(current?.startTime ?? "10:00");
  const [cost, setCost] = useState(String(current?.estimatedCost ?? 0));
  const [error, setError] = useState<string | null>(null);

  if (!value) return null;

  function save() {
    if (title.trim().length < 2) {
      setError("Give this activity a clear name.");
      return;
    }
    if (!choice) {
      setError("Choose a location from the search dropdown so TRAVA can place it on the map.");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError("Use a 24-hour time such as 09:30 or 18:00.");
      return;
    }
    onSave({
      title: title.trim(),
      locationName: choice.displayName,
      detail: choice.displayName,
      latitude: choice.latitude,
      longitude: choice.longitude,
      category,
      startTime: time,
      estimatedCost: Number(cost) || 0,
    });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.activityModal}>
          <View style={s.modalHead}>
            <View style={s.modalHeadCopy}>
              <Text style={s.modalTitle}>{current ? "Edit activity" : `Add activity · Day ${day}`}</Text>
              <Text style={s.modalSub}>Choose a real location so the route updates immediately.</Text>
            </View>
            <Pressable accessibilityLabel="Close activity editor" onPress={onClose} style={s.modalClose}><Ionicons name="close" size={21} color="#6C7B91" /></Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
            <Text style={s.fieldLabel}>Activity name</Text>
            <TextInput value={title} onChangeText={(text) => { setTitle(text); setError(null); }} style={s.input} placeholder="e.g. Osaka Castle" placeholderTextColor="#9BA7B9" />

            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <Pressable key={key} onPress={() => setCategory(key as LocalActivity["category"])} style={[s.categoryChip, category === key && s.categoryChipActive]}>
                  <Ionicons name={meta.icon} size={15} color={category === key ? "#276FE8" : "#748298"} />
                  <Text style={[s.categoryChipText, category === key && s.categoryChipTextActive]}>{meta.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Location</Text>
            <SearchableLocationField
              value={place}
              onChangeText={(text) => {
                setPlace(text);
                if (text !== choice?.displayName) setChoice(null);
                setError(null);
              }}
              onSelect={(location) => {
                setChoice(location);
                setPlace(location.displayName);
                setError(null);
              }}
            />
            {choice ? (
              <View style={s.locationConfirmed}><Ionicons name="checkmark-circle" size={16} color="#34A87D" /><Text style={s.locationConfirmedText}>This stop will appear on the itinerary map.</Text></View>
            ) : null}

            <View style={s.formRow}>
              <View style={s.formFlex}>
                <Text style={s.fieldLabel}>Start time</Text>
                <TextInput value={time} onChangeText={(text) => { setTime(text); setError(null); }} style={s.input} placeholder="10:00" placeholderTextColor="#9BA7B9" />
              </View>
              <View style={s.formFlex}>
                <Text style={s.fieldLabel}>Estimated cost ({currencyCode})</Text>
                <TextInput value={cost} onChangeText={(text) => setCost(cleanMoney(text))} keyboardType="decimal-pad" style={s.input} placeholder="0" placeholderTextColor="#9BA7B9" />
              </View>
            </View>

            {error ? <View style={s.errorBox}><Ionicons name="alert-circle-outline" size={17} color="#D9657E" /><Text style={s.errorText}>{error}</Text></View> : null}

            <View style={s.modalActions}>
              {onDelete ? (
                <Pressable onPress={onDelete} style={s.deleteActivityButton}><Ionicons name="trash-outline" size={17} color="#D85E79" /><Text style={s.deleteActivityText}>Delete</Text></Pressable>
              ) : null}
              <Pressable onPress={onClose} style={s.cancelActivityButton}><Text style={s.cancelActivityText}>Cancel</Text></Pressable>
              <Pressable onPress={save} style={s.saveActivityPress}>
                <LinearGradient colors={["#4EBFFF", "#8B8BFF", "#EF8FBD"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.saveActivityButton}>
                  <Text style={s.saveActivityText}>{current ? "Save changes" : "Add activity"}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function tripDayCount(startDate: string | null | undefined, endDate: string | null | undefined, activities: LocalActivity[]) {
  if (startDate && endDate) {
    const start = new Date(`${startDate}T12:00:00`);
    const end = new Date(`${endDate}T12:00:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    }
  }
  return Math.max(1, ...activities.map((item) => item.dayNumber || 1));
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate && !endDate) return "Dates not set";
  if (startDate && !endDate) return startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (!startDate && endDate) return endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startDate!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${endDate!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function dayLabel(startDate: string | null | undefined, day: number) {
  const base = parseDate(startDate);
  if (!base) return `Day ${day}`;
  base.setDate(base.getDate() + day - 1);
  return base.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortDayDate(startDate: string | null | undefined, day: number) {
  const base = parseDate(startDate);
  if (!base) return `Day ${day}`;
  base.setDate(base.getDate() + day - 1);
  return base.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortLocation(location: string) {
  const value = location.trim();
  const first = value.split(",")[0]?.trim();
  return first || value || "Location";
}

function cleanMoney(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

function clock(value: string) {
  const [h = "00", m = "00"] = value.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function formatCost(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "PHP",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || "PHP"} ${Math.round(value).toLocaleString()}`;
  }
}

function weatherIcon(label?: string): TravaIconName {
  const value = (label || "").toLowerCase();
  if (value.includes("rain") || value.includes("shower")) return "rainy-outline";
  if (value.includes("cloud")) return "partly-sunny-outline";
  if (value.includes("sun") || value.includes("clear")) return "sunny-outline";
  if (value.includes("storm") || value.includes("thunder")) return "thunderstorm-outline";
  return "partly-sunny-outline";
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FBFF" },
  screen: { flex: 1, backgroundColor: "#F9FBFF" },
  pageScroll: { paddingBottom: 150 },
  max: { width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: 22, gap: 18 },

  hero: {
    height: 236,
    marginTop: 6,
    borderRadius: 0,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#EAF3FF",
  },
  heroCompact: { height: 272 },
  heroBack: {
    position: "absolute", left: 18, top: 20, zIndex: 5,
    width: 50, height: 50, borderRadius: 25,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.90)", borderWidth: 1, borderColor: "rgba(225,231,240,.90)",
    boxShadow: "0 9px 22px rgba(55,72,99,.10)",
  },
  heroActions: { position: "absolute", right: 18, top: 20, zIndex: 5, flexDirection: "row", gap: 8 },
  heroActionsCompact: { top: 18 },
  heroAction: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.90)", borderWidth: 1, borderColor: "rgba(225,231,240,.92)",
    boxShadow: "0 9px 22px rgba(55,72,99,.09)",
  },
  peopleWrap: { position: "relative" },
  presenceDot: { position: "absolute", right: 1, bottom: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: "#39B980", borderWidth: 2, borderColor: "#FFFFFF" },
  notificationDot: { position: "absolute", right: 3, top: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF607B", borderWidth: 2, borderColor: "#FFFFFF" },
  heroCopy: { position: "absolute", left: 74, top: 56, width: "58%", maxWidth: 570 },
  heroCopyCompact: { left: 22, right: 22, width: "auto", top: 86 },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 27, borderRadius: 14, backgroundColor: "rgba(255,255,255,.62)" },
  statusText: { color: "#667DA2", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: .45 },
  heroTitle: { marginTop: 9, color: "#0E1C35", fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -1.1 },
  heroTitleCompact: { fontSize: 28, lineHeight: 33 },
  heroMeta: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  heroMetaCompact: { gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: "#344D73", fontSize: 11.5, fontWeight: "700" },
  heroDescription: { marginTop: 10, color: "#334968", fontSize: 12.5, lineHeight: 18, fontWeight: "600", maxWidth: 580 },

  tabs: {
    width: "100%", minWidth: "100%", padding: 4, gap: 4,
    backgroundColor: "rgba(255,255,255,.93)", borderRadius: 24,
    borderWidth: 1, borderColor: "#E8EDF5", boxShadow: "0 10px 25px rgba(67,83,108,.065)",
  },
  tab: { minWidth: 122, flexGrow: 1, height: 46, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#E6F2FF" },
  tabPressed: { opacity: .72 },
  tabText: { color: "#2C405F", fontSize: 12.5, fontWeight: "700" },
  tabTextActive: { color: "#1676F3", fontWeight: "900" },

  mapCard: { position: "relative", borderRadius: 28, overflow: "visible" },
  mapLabel: {
    position: "absolute", left: 18, top: 16, zIndex: 20,
    minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 19,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,.95)", borderWidth: 1, borderColor: "rgba(224,232,244,.96)",
    boxShadow: "0 10px 25px rgba(54,75,108,.12)",
  },
  mapLabelIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF5FF" },
  mapLabelTitle: { color: "#10213C", fontSize: 12.5, fontWeight: "900" },
  mapLabelSub: { marginTop: 2, color: "#667892", fontSize: 9.5, fontWeight: "600" },
  mapTools: { position: "absolute", right: 16, top: 16, zIndex: 20, flexDirection: "row", gap: 8 },
  mapModeToggle: { height: 44, padding: 4, flexDirection: "row", borderRadius: 22, backgroundColor: "rgba(255,255,255,.95)", borderWidth: 1, borderColor: "#E3E9F3" },
  mapModeButton: { minWidth: 74, height: 34, paddingHorizontal: 13, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  mapModeActive: { backgroundColor: "#E7F2FF" },
  mapModeText: { color: "#425777", fontSize: 10.5, fontWeight: "800" },
  mapModeTextActive: { color: "#1676F3" },
  fullscreenButton: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.95)", borderWidth: 1, borderColor: "#E3E9F3" },
  routeBadge: {
    position: "absolute", left: 18, bottom: 16, zIndex: 20,
    minHeight: 58, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,.95)", boxShadow: "0 10px 24px rgba(53,74,106,.12)",
  },
  routeBadgeIcon: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF6FF" },
  routeTitle: { color: "#10213C", fontSize: 12.5, fontWeight: "900" },
  routeSub: { marginTop: 2, color: "#6C7A91", fontSize: 9.5, fontWeight: "600" },

  daysSection: { gap: 10 },
  sectionTitle: { color: "#10213C", fontSize: 20, fontWeight: "900", letterSpacing: -.35 },
  sectionSub: { marginTop: 2, color: "#738198", fontSize: 11, fontWeight: "600" },
  daysRow: { gap: 10, paddingVertical: 2, paddingRight: 4 },
  dayChip: {
    minWidth: 122, height: 62, paddingHorizontal: 18, borderRadius: 31, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "#E5ECF5",
    boxShadow: "0 8px 20px rgba(60,78,108,.05)",
  },
  dayChipActive: { borderColor: "transparent", boxShadow: "0 12px 25px rgba(44,138,255,.20)" },
  dayChipPressed: { opacity: .78 },
  dayChipTitle: { color: "#243956", fontSize: 13, fontWeight: "900", zIndex: 1 },
  dayChipTitleActive: { color: "#FFFFFF" },
  dayChipDate: { marginTop: 2, color: "#718097", fontSize: 10, fontWeight: "700", zIndex: 1 },
  dayChipDateActive: { color: "rgba(255,255,255,.94)" },
  addDayChip: { minWidth: 132, height: 62, paddingHorizontal: 18, borderRadius: 31, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#F9FBFF", borderWidth: 1, borderColor: "#D9E6F7" },
  addDayText: { color: "#24446F", fontSize: 12.5, fontWeight: "900" },

  timelineCard: { padding: 22, borderRadius: 28, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8EDF4", boxShadow: "0 14px 34px rgba(59,76,105,.07)" },
  timelineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7ECF3" },
  timelineHeaderCompact: { alignItems: "flex-start", flexDirection: "column" },
  timelineHeaderCopy: { flex: 1 },
  timelineTitle: { color: "#10213C", fontSize: 20, lineHeight: 26, fontWeight: "900", letterSpacing: -.35 },
  timelineSubtitle: { marginTop: 3, color: "#718097", fontSize: 11, fontWeight: "600" },
  timelineHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  weatherPill: { minWidth: 146, height: 54, paddingHorizontal: 14, borderRadius: 27, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F3F8FF" },
  weatherTemperature: { color: "#20344F", fontSize: 13, fontWeight: "900" },
  weatherLabel: { marginTop: 1, maxWidth: 94, color: "#718097", fontSize: 9, fontWeight: "600" },
  dayMenuButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8EDF4", backgroundColor: "#FFFFFF" },

  emptyDay: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 28, alignItems: "center", borderRadius: 22, backgroundColor: "#F7FAFF" },
  emptySparkles: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyCalendar: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E9F3FF" },
  emptyTitle: { marginTop: 9, color: "#12213A", fontSize: 14, fontWeight: "900" },
  emptyText: { marginTop: 5, maxWidth: 420, textAlign: "center", color: "#6F7D93", fontSize: 10.5, lineHeight: 16, fontWeight: "600" },

  timelineList: { marginTop: 3 },
  timelineRow: { minHeight: 112, flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7ECF3" },
  timelineRowLast: { borderBottomWidth: 0 },
  timeColumn: { width: 92, minHeight: 76, position: "relative", paddingLeft: 20, justifyContent: "center" },
  timelineDot: { position: "absolute", left: 0, top: 26, width: 12, height: 12, borderRadius: 6, borderWidth: 2, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", zIndex: 2 },
  timelineDotInner: { width: 4, height: 4, borderRadius: 2 },
  timelineRail: { position: "absolute", left: 5, top: 38, bottom: -36, width: 2, backgroundColor: "#E0E8F4" },
  timeText: { color: "#253B59", fontSize: 12.5, fontWeight: "900" },
  activityIconWrap: { width: 62, alignItems: "center", justifyContent: "center" },
  activityCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  activityTitle: { color: "#10213C", fontSize: 14.5, lineHeight: 19, fontWeight: "900" },
  activityMeta: { marginTop: 3, color: "#637590", fontSize: 10.5, fontWeight: "700" },
  activityDetail: { marginTop: 5, color: "#7A879A", fontSize: 10, fontWeight: "600" },
  activityBadges: { marginTop: 7, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  costBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: "#F2F5FA" },
  costBadgeText: { color: "#50627F", fontSize: 9.5, fontWeight: "800" },
  mappedBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#EDF5FF" },
  mappedBadgeText: { color: "#2D77E8", fontSize: 9.5, fontWeight: "800" },
  activityActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  viewMapButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F8FBFF", borderWidth: 1, borderColor: "#DDE9F8" },
  viewMapText: { color: "#2775E7", fontSize: 9.5, fontWeight: "900" },
  moreActivityButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E7ECF3", backgroundColor: "#FFFFFF" },
  addActivityPress: { marginTop: 16 },
  addActivityButton: { height: 58, borderRadius: 29, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 12px 28px rgba(112,119,255,.22)" },
  addActivityText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" },

  fullscreenBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(13,22,39,.56)", alignItems: "center", justifyContent: "center" },
  fullscreenCard: { width: "100%", maxWidth: 1180, maxHeight: "94%", padding: 14, borderRadius: 28, backgroundColor: "#FFFFFF" },
  fullscreenHead: { minHeight: 64, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  fullscreenTitle: { color: "#10213C", fontSize: 18, fontWeight: "900" },
  fullscreenSub: { marginTop: 2, color: "#718097", fontSize: 10.5, fontWeight: "600" },
  fullscreenHeadActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  fullscreenClose: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F8FC" },

  backdrop: { flex: 1, padding: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(13,22,39,.48)" },
  deleteDayModal: { width: "100%", maxWidth: 420, padding: 24, borderRadius: 28, alignItems: "center", backgroundColor: "#FFFFFF" },
  deleteDayIcon: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F4" },
  deleteDayTitle: { marginTop: 14, color: "#10213C", fontSize: 19, fontWeight: "900" },
  deleteDayBody: { marginTop: 7, color: "#718097", fontSize: 10.5, lineHeight: 16, textAlign: "center", fontWeight: "600" },
  deleteDayActions: { width: "100%", marginTop: 18, flexDirection: "row", gap: 9 },
  cancelDelete: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F5F9" },
  cancelDeleteText: { color: "#66758C", fontSize: 10.5, fontWeight: "900" },
  confirmDelete: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#E9829A" },
  confirmDeleteText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },

  activityModal: { width: "100%", maxWidth: 560, maxHeight: "90%", padding: 22, borderRadius: 28, backgroundColor: "#FFFFFF" },
  modalHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  modalHeadCopy: { flex: 1 },
  modalTitle: { color: "#10213C", fontSize: 20, fontWeight: "900" },
  modalSub: { marginTop: 3, color: "#718097", fontSize: 10.5, fontWeight: "600" },
  modalClose: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F7FB" },
  modalScroll: { paddingTop: 8, paddingBottom: 2 },
  fieldLabel: { marginTop: 13, marginBottom: 6, color: "#445875", fontSize: 10, fontWeight: "900" },
  input: { height: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "#F6F8FC", borderWidth: 1, borderColor: "#E7ECF3", color: "#15243A", fontSize: 12.5, fontWeight: "700" },
  categoryRow: { gap: 7, paddingBottom: 2 },
  categoryChip: { minHeight: 38, paddingHorizontal: 11, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#E6EBF3" },
  categoryChipActive: { backgroundColor: "#EDF5FF", borderColor: "#C9DDF9" },
  categoryChipText: { color: "#728095", fontSize: 9.5, fontWeight: "800" },
  categoryChipTextActive: { color: "#276FE8" },
  locationConfirmed: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  locationConfirmedText: { color: "#4D8B74", fontSize: 9.5, fontWeight: "700" },
  formRow: { flexDirection: "row", gap: 8 },
  formFlex: { flex: 1 },
  errorBox: { marginTop: 12, padding: 11, borderRadius: 14, flexDirection: "row", gap: 7, alignItems: "flex-start", backgroundColor: "#FFF2F5" },
  errorText: { flex: 1, color: "#B65A70", fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
  modalActions: { marginTop: 17, flexDirection: "row", gap: 8 },
  deleteActivityButton: { height: 48, paddingHorizontal: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFF0F4" },
  deleteActivityText: { color: "#D85E79", fontSize: 10.5, fontWeight: "900" },
  cancelActivityButton: { flex: 1, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F3F8" },
  cancelActivityText: { color: "#66758C", fontSize: 10.5, fontWeight: "900" },
  saveActivityPress: { flex: 1.55, height: 48 },
  saveActivityButton: { flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  saveActivityText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },

  pressed: { opacity: .76, transform: [{ scale: .98 }] },
});
