import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GLOBE_COUNTRY_BY_CODE, type GlobeCountry } from "../data/globe-country-data";
import type { HomeTravelRoute, HomeTravelRouteInput } from "../types/home.types";
import { CountryPickerModal } from "./CountryPickerModal";

type JourneyMode = "one-way" | "multi-stop" | "round-trip";

interface TravelRouteEditorModalProps {
  visible: boolean;
  routes: HomeTravelRoute[];
  saving: boolean;
  error: string | null;
  onClose(): void;
  onAdd(input: HomeTravelRouteInput): Promise<HomeTravelRoute>;
  onDelete(routeId: string): Promise<void>;
  onFocus(countryCode: string): void;
}

const MODE_OPTIONS: Array<{ key: JourneyMode; label: string; hint: string }> = [
  { key: "one-way", label: "One-way", hint: "A → B" },
  { key: "multi-stop", label: "Multi-stop", hint: "A → B → C+" },
  { key: "round-trip", label: "Round trip", hint: "A → B → A" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDistance(distanceKm: number): string {
  return `${Math.round(distanceKm).toLocaleString("en-US")} km`;
}

function countryName(code: string): string {
  return GLOBE_COUNTRY_BY_CODE.get(code)?.name ?? code;
}

function buildLegs(codes: string[]): Array<[string, string]> {
  const legs: Array<[string, string]> = [];
  for (let index = 0; index < codes.length - 1; index += 1) {
    legs.push([codes[index], codes[index + 1]]);
  }
  return legs;
}

export function TravelRouteEditorModal({
  visible,
  routes,
  saving,
  error,
  onClose,
  onAdd,
  onDelete,
  onFocus,
}: TravelRouteEditorModalProps) {
  const [mode, setMode] = useState<JourneyMode>("one-way");
  const [waypoints, setWaypoints] = useState<string[]>(["", ""]);
  const [traveledAt, setTraveledAt] = useState(today);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<string | null>(null);

  const resolvedWaypoints = useMemo(
    () => waypoints.map((code) => GLOBE_COUNTRY_BY_CODE.get(code) ?? null),
    [waypoints],
  );

  const journeyCodes = useMemo(() => {
    const base = waypoints.filter(Boolean);
    if (mode === "round-trip" && base.length >= 2 && base[0]) return [...base, base[0]];
    return base;
  }, [mode, waypoints]);

  const journeyPreview = useMemo(() => {
    if (!journeyCodes.length) return "Choose your route";
    return journeyCodes.map((code) => countryName(code)).join(" → ");
  }, [journeyCodes]);

  function close() {
    setLocalError(null);
    setSaveProgress(null);
    setPickerIndex(null);
    onClose();
  }

  function changeMode(nextMode: JourneyMode) {
    setMode(nextMode);
    setLocalError(null);
    setSaveProgress(null);

    setWaypoints((current) => {
      const origin = current[0] ?? "";
      const next = current[1] ?? "";
      if (nextMode === "multi-stop") {
        if (current.length >= 3) return current;
        return [origin, next, ""];
      }
      if (nextMode === "round-trip") {
        return current.length >= 2 ? current.slice(0, Math.max(2, current.length)) : [origin, next];
      }
      return [origin, current[current.length - 1] ?? next];
    });
  }

  function selectCountry(country: GlobeCountry) {
    if (pickerIndex === null) return;
    setWaypoints((current) => current.map((code, index) => (index === pickerIndex ? country.code : code)));
    setPickerIndex(null);
    setLocalError(null);
  }

  function addStop() {
    setWaypoints((current) => [...current, ""]);
    setLocalError(null);
  }

  function removeStop(index: number) {
    setWaypoints((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setLocalError(null);
  }

  function swapEndpoints() {
    setWaypoints((current) => {
      if (current.length < 2) return current;
      const next = [...current];
      const last = next.length - 1;
      [next[0], next[last]] = [next[last], next[0]];
      return next;
    });
    setLocalError(null);
  }

  async function saveJourney() {
    const minimumStops = mode === "multi-stop" ? 3 : 2;
    if (waypoints.length < minimumStops || waypoints.some((code) => !code)) {
      setLocalError(
        mode === "multi-stop"
          ? "Choose an origin, at least one stop, and a destination."
          : "Choose an origin and destination country.",
      );
      return;
    }

    if (traveledAt && !/^\d{4}-\d{2}-\d{2}$/.test(traveledAt)) {
      setLocalError("Use the date format YYYY-MM-DD.");
      return;
    }

    const codes = mode === "round-trip" ? [...waypoints, waypoints[0]] : [...waypoints];
    for (let index = 0; index < codes.length - 1; index += 1) {
      if (codes[index] === codes[index + 1]) {
        setLocalError("Two consecutive stops cannot be the same country.");
        return;
      }
    }

    const legs = buildLegs(codes);
    const savedRoutes: HomeTravelRoute[] = [];
    setLocalError(null);
    setSaveProgress(`Saving 0 of ${legs.length} flight legs…`);

    try {
      for (let index = 0; index < legs.length; index += 1) {
        const [originCode, destinationCode] = legs[index];
        const route = await onAdd({
          originCode,
          destinationCode,
          traveledAt: traveledAt || today(),
        });
        savedRoutes.push(route);
        setSaveProgress(`Saving ${index + 1} of ${legs.length} flight legs…`);
      }

      const lastRoute = savedRoutes[savedRoutes.length - 1];
      if (lastRoute) onFocus(lastRoute.destinationCode);

      const finalCode = codes[codes.length - 1] ?? "";
      if (mode === "one-way") setWaypoints([finalCode, ""]);
      if (mode === "multi-stop") setWaypoints([finalCode, "", ""]);
      if (mode === "round-trip") setWaypoints([codes[0] ?? "", ""]);
      setTraveledAt(today());
      setSaveProgress(null);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save this journey.";
      setSaveProgress(null);
      setLocalError(
        savedRoutes.length
          ? `${savedRoutes.length} of ${legs.length} legs were saved. ${message}`
          : message,
      );
    }
  }

  async function removeRoute(routeId: string) {
    if (saving || deletingId) return;
    setDeletingId(routeId);
    setLocalError(null);
    try {
      await onDelete(routeId);
    } catch (deleteError) {
      setLocalError(deleteError instanceof Error ? deleteError.message : "Unable to remove this route.");
    } finally {
      setDeletingId(null);
    }
  }

  function stopLabel(index: number) {
    if (index === 0) return "From";
    if (index === waypoints.length - 1) return "Destination";
    return `Stop ${index}`;
  }

  const pickerSelectedCode = pickerIndex === null ? "" : waypoints[pickerIndex] ?? "";
  const pickerDisabledCode =
    pickerIndex === null
      ? ""
      : waypoints[pickerIndex - 1] || waypoints[pickerIndex + 1] || "";

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>TRAVEL FOOTPRINT</Text>
              <Text style={styles.title}>Build your journey</Text>
              <Text style={styles.subtitle}>
                Add one flight, multiple stops, or a complete round trip. Every leg updates your globe automatically.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close journey builder"
              onPress={close}
              style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.routeBuilder}>
              <Text style={styles.builderTitle}>How are you traveling?</Text>
              <Text style={styles.builderCopy}>Choose the route style first, then build the journey in the order you traveled.</Text>

              <View style={styles.modeTabs}>
                {MODE_OPTIONS.map((option) => {
                  const active = mode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => changeMode(option.key)}
                      style={({ pressed }) => [
                        styles.modeTab,
                        active && styles.modeTabActive,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{option.label}</Text>
                      <Text style={[styles.modeHint, active && styles.modeHintActive]}>{option.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.journeyPreview}>
                <View style={styles.previewIcon}>
                  <Text style={styles.previewIconText}>✈︎</Text>
                </View>
                <View style={styles.previewCopy}>
                  <Text style={styles.previewEyebrow}>JOURNEY PREVIEW</Text>
                  <Text style={styles.previewTitle} numberOfLines={2}>{journeyPreview}</Text>
                  <Text style={styles.previewMeta}>
                    {Math.max(0, journeyCodes.length - 1)} {journeyCodes.length - 1 === 1 ? "flight leg" : "flight legs"}
                  </Text>
                </View>
              </View>

              <View style={styles.stopsStack}>
                {waypoints.map((code, index) => {
                  const country = resolvedWaypoints[index];
                  const canRemove = index > 0 && index < waypoints.length - 1 && waypoints.length > (mode === "multi-stop" ? 3 : 2);
                  return (
                    <View key={`${index}-${code || "empty"}`} style={styles.stopBlock}>
                      {index > 0 ? <View style={styles.stopConnector} /> : null}
                      <View style={styles.stopHeader}>
                        <Text style={styles.fieldLabel}>{stopLabel(index)}</Text>
                        {canRemove ? (
                          <Pressable onPress={() => removeStop(index)} style={styles.removeStopButton}>
                            <Text style={styles.removeStopText}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setPickerIndex(index)}
                        style={({ pressed }) => [styles.countryField, pressed && styles.countryFieldPressed]}
                      >
                        <View style={[styles.countryBadge, country && styles.countryBadgeSelected]}>
                          <Text style={styles.countryBadgeText}>{country?.code || String(index + 1).padStart(2, "0")}</Text>
                        </View>
                        <View style={styles.fieldCopy}>
                          <Text style={[styles.fieldValue, !country && styles.fieldPlaceholder]}>
                            {country?.name || (index === 0 ? "Choose starting country" : "Choose next country")}
                          </Text>
                          <Text style={styles.fieldHint}>Tap to search or browse countries</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    </View>
                  );
                })}

                {mode === "round-trip" ? (
                  <View style={styles.returnRow}>
                    <View style={styles.stopConnector} />
                    <View style={styles.returnBadge}><Text style={styles.returnGlyph}>↩︎</Text></View>
                    <View style={styles.returnCopy}>
                      <Text style={styles.returnLabel}>Return to origin</Text>
                      <Text style={styles.returnValue}>{resolvedWaypoints[0]?.name || "Your starting country"}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {mode !== "one-way" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={addStop}
                  style={({ pressed }) => [styles.addStopButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.addStopPlus}>＋</Text>
                  <Text style={styles.addStopText}>Add another stop</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Swap origin and destination"
                  onPress={swapEndpoints}
                  style={({ pressed }) => [styles.swapButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.swapGlyph}>⇅</Text>
                  <Text style={styles.swapText}>Swap direction</Text>
                </Pressable>
              )}

              <Text style={styles.fieldLabel}>Travel date</Text>
              <TextInput
                value={traveledAt}
                onChangeText={setTraveledAt}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8A94A8"
                style={styles.dateInput}
              />

              {localError || error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{localError || error}</Text>
                </View>
              ) : null}

              {saveProgress ? (
                <View style={styles.progressBox}>
                  <ActivityIndicator size="small" color="#7657E8" />
                  <Text style={styles.progressText}>{saveProgress}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving || Boolean(saveProgress)}
                onPress={() => void saveJourney()}
                style={({ pressed }) => [
                  styles.saveButton,
                  (saving || Boolean(saveProgress)) && styles.buttonDisabled,
                  pressed && !saving && !saveProgress && styles.buttonPressed,
                ]}
              >
                {saving || saveProgress ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveGlyph}>✈︎</Text>}
                <Text style={styles.saveText}>
                  {saving || saveProgress ? "Saving journey…" : mode === "one-way" ? "Add flight to globe" : "Save journey to globe"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.listTitle}>Saved flight legs</Text>
                <Text style={styles.listSubtitle}>{routes.length} {routes.length === 1 ? "leg" : "legs"} mapped on your globe</Text>
              </View>
            </View>

            {routes.length ? (
              routes
                .slice()
                .reverse()
                .map((route, index) => (
                  <View key={route.id} style={styles.routeRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Focus ${route.destinationName} on globe`}
                      onPress={() => onFocus(route.destinationCode)}
                      style={styles.routeMain}
                    >
                      <View style={styles.routeNumber}>
                        <Text style={styles.routeNumberText}>{routes.length - index}</Text>
                      </View>
                      <View style={styles.routeCopy}>
                        <Text style={styles.routeTitle} numberOfLines={1}>
                          {route.originName} → {route.destinationName}
                        </Text>
                        <Text style={styles.routeMeta}>
                          {formatDistance(route.distanceKm)} • {route.traveledAt}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove route from ${route.originName} to ${route.destinationName}`}
                      disabled={saving || deletingId === route.id}
                      onPress={() => void removeRoute(route.id)}
                      style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
                    >
                      {deletingId === route.id ? (
                        <ActivityIndicator size="small" color="#E05278" />
                      ) : (
                        <Text style={styles.deleteGlyph}>×</Text>
                      )}
                    </Pressable>
                  </View>
                ))
            ) : (
              <View style={styles.emptyRoutes}>
                <Text style={styles.emptyIcon}>✈︎</Text>
                <Text style={styles.emptyTitle}>No journeys yet</Text>
                <Text style={styles.emptyCopy}>Choose one-way, multi-stop, or round trip to start your travel footprint.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CountryPickerModal
        visible={pickerIndex !== null}
        title={pickerIndex === 0 ? "Choose your starting country" : "Choose the next country"}
        selectedCode={pickerSelectedCode}
        disabledCode={pickerDisabledCode}
        onClose={() => setPickerIndex(null)}
        onSelect={selectCountry}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(116,92,220,0.12)",
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 14 },
  eyebrow: { color: "#7657E8", fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  title: { marginTop: 4, color: "#111D3A", fontSize: 24, lineHeight: 30, fontWeight: "900" },
  subtitle: { marginTop: 4, maxWidth: 500, color: "#6F7B91", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: "#E5E2F2", backgroundColor: "#FFFFFF" },
  closeGlyph: { color: "#26324B", fontSize: 25, lineHeight: 27, fontWeight: "500" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 50 },
  routeBuilder: { padding: 18, borderRadius: 28, borderWidth: 1, borderColor: "#E7E1F4", backgroundColor: "#FFFFFF" },
  builderTitle: { color: "#17233E", fontSize: 18, lineHeight: 23, fontWeight: "900" },
  builderCopy: { marginTop: 4, marginBottom: 14, color: "#7A8599", fontSize: 11, lineHeight: 17, fontWeight: "600" },
  modeTabs: { flexDirection: "row", gap: 7, padding: 5, borderRadius: 19, backgroundColor: "#F3F1FB" },
  modeTab: { flex: 1, minHeight: 58, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "transparent" },
  modeTabActive: { borderColor: "rgba(118,87,232,0.16)", backgroundColor: "#FFFFFF" },
  modeLabel: { color: "#68748D", fontSize: 11, fontWeight: "800" },
  modeLabelActive: { color: "#5E42D4" },
  modeHint: { marginTop: 2, color: "#A1A7B6", fontSize: 9, fontWeight: "700" },
  modeHintActive: { color: "#9B86ED" },
  journeyPreview: { marginTop: 14, padding: 13, flexDirection: "row", alignItems: "center", borderRadius: 19, borderWidth: 1, borderColor: "rgba(116,92,220,0.12)", backgroundColor: "#F7F4FF" },
  previewIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#EAE3FF" },
  previewIconText: { color: "#6648DD", fontSize: 18, fontWeight: "900" },
  previewCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  previewEyebrow: { color: "#8A73E5", fontSize: 8, letterSpacing: 1, fontWeight: "900" },
  previewTitle: { marginTop: 3, color: "#1B2743", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  previewMeta: { marginTop: 2, color: "#7A8599", fontSize: 9, fontWeight: "700" },
  stopsStack: { marginTop: 14 },
  stopBlock: { position: "relative" },
  stopConnector: { width: 2, height: 13, marginLeft: 21, backgroundColor: "#DED6FA" },
  stopHeader: { minHeight: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { marginTop: 11, marginBottom: 7, color: "#4B5870", fontSize: 11, fontWeight: "800" },
  removeStopButton: { marginTop: 8, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#FFF1F5" },
  removeStopText: { color: "#CC5476", fontSize: 9, fontWeight: "800" },
  countryField: { minHeight: 67, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", borderRadius: 19, borderWidth: 1, borderColor: "#E0E3EF", backgroundColor: "#FBFCFF" },
  countryFieldPressed: { borderColor: "#CFC4F5", backgroundColor: "#F9F7FF" },
  countryBadge: { width: 43, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#F0EEF8" },
  countryBadgeSelected: { backgroundColor: "#E9E3FF" },
  countryBadgeText: { color: "#6549DA", fontSize: 11, fontWeight: "900" },
  fieldCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  fieldValue: { color: "#17233E", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  fieldPlaceholder: { color: "#8A94A8" },
  fieldHint: { marginTop: 2, color: "#8A94A8", fontSize: 10, lineHeight: 13, fontWeight: "600" },
  chevron: { color: "#7357EF", fontSize: 24, fontWeight: "700" },
  returnRow: { minHeight: 61, flexDirection: "row", alignItems: "center" },
  returnBadge: { width: 43, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#E9F4FF" },
  returnGlyph: { color: "#5E76CE", fontSize: 18, fontWeight: "900" },
  returnCopy: { marginLeft: 11 },
  returnLabel: { color: "#8A94A8", fontSize: 9, fontWeight: "800" },
  returnValue: { marginTop: 2, color: "#17233E", fontSize: 13, fontWeight: "800" },
  addStopButton: { minHeight: 44, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 15, borderWidth: 1, borderStyle: "dashed", borderColor: "#CFC4F5", backgroundColor: "#FAF8FF" },
  addStopPlus: { color: "#6549DA", fontSize: 16, fontWeight: "900" },
  addStopText: { color: "#6549DA", fontSize: 10, fontWeight: "800" },
  swapButton: { alignSelf: "center", marginTop: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F1EEFF" },
  swapGlyph: { color: "#6549DA", fontSize: 15, fontWeight: "900" },
  swapText: { color: "#6549DA", fontSize: 10, fontWeight: "800" },
  dateInput: { minHeight: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: "#DDE2EE", backgroundColor: "#FBFCFF", color: "#17233E", fontSize: 14, fontWeight: "700" },
  errorBox: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: "#FFF0F4", borderWidth: 1, borderColor: "#FFD4DF" },
  errorText: { color: "#B33A5D", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  progressBox: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 13, backgroundColor: "#F4F1FF" },
  progressText: { color: "#6754B9", fontSize: 10, fontWeight: "800" },
  saveButton: { minHeight: 54, marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 17, backgroundColor: "#7357EF" },
  saveGlyph: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  buttonDisabled: { opacity: 0.58 },
  buttonPressed: { opacity: 0.76 },
  listHeader: { marginTop: 24, marginBottom: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  listTitle: { color: "#17233E", fontSize: 18, fontWeight: "900" },
  listSubtitle: { marginTop: 3, color: "#7A8599", fontSize: 11, fontWeight: "600" },
  routeRow: { minHeight: 73, marginTop: 9, flexDirection: "row", alignItems: "center", borderRadius: 19, borderWidth: 1, borderColor: "#E1E5EF", backgroundColor: "#FFFFFF", overflow: "hidden" },
  routeMain: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center" },
  routeNumber: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EEEAFE" },
  routeNumberText: { color: "#6549DA", fontSize: 11, fontWeight: "900" },
  routeCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  routeTitle: { color: "#17233E", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  routeMeta: { marginTop: 3, color: "#7A8599", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  deleteButton: { width: 52, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#E4E7EF" },
  deleteGlyph: { color: "#D94C72", fontSize: 24, fontWeight: "500" },
  emptyRoutes: { marginTop: 10, alignItems: "center", paddingHorizontal: 24, paddingVertical: 36, borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "#D9DEEA", backgroundColor: "#FFFFFF" },
  emptyIcon: { color: "#7357EF", fontSize: 25 },
  emptyTitle: { marginTop: 9, color: "#17233E", fontSize: 15, fontWeight: "900" },
  emptyCopy: { maxWidth: 340, marginTop: 5, color: "#7A8599", fontSize: 11, lineHeight: 17, textAlign: "center", fontWeight: "600" },
});
