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

type PickerTarget = "origin" | "destination" | null;

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDistance(distanceKm: number): string {
  return `${Math.round(distanceKm).toLocaleString("en-US")} km`;
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
  const [originCode, setOriginCode] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [traveledAt, setTraveledAt] = useState(today);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const origin = useMemo(
    () => GLOBE_COUNTRY_BY_CODE.get(originCode) ?? null,
    [originCode],
  );
  const destination = useMemo(
    () => GLOBE_COUNTRY_BY_CODE.get(destinationCode) ?? null,
    [destinationCode],
  );

  function close() {
    setLocalError(null);
    setPickerTarget(null);
    onClose();
  }

  function selectCountry(country: GlobeCountry) {
    if (pickerTarget === "origin") setOriginCode(country.code);
    if (pickerTarget === "destination") setDestinationCode(country.code);
    setPickerTarget(null);
    setLocalError(null);
  }

  async function saveRoute() {
    if (!origin || !destination) {
      setLocalError("Choose an origin and destination country.");
      return;
    }
    if (origin.code === destination.code) {
      setLocalError("Origin and destination must be different countries.");
      return;
    }
    if (traveledAt && !/^\d{4}-\d{2}-\d{2}$/.test(traveledAt)) {
      setLocalError("Use the date format YYYY-MM-DD.");
      return;
    }

    setLocalError(null);
    try {
      const route = await onAdd({
        originCode: origin.code,
        destinationCode: destination.code,
        traveledAt: traveledAt || today(),
      });
      setOriginCode(destination.code);
      setDestinationCode("");
      setTraveledAt(today());
      onFocus(route.destinationCode);
    } catch (saveError) {
      setLocalError(saveError instanceof Error ? saveError.message : "Unable to save this route.");
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

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>TRAVEL FOOTPRINT</Text>
              <Text style={styles.title}>Build your route map</Text>
              <Text style={styles.subtitle}>Each saved route updates your globe and travel statistics.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close route manager"
              onPress={close}
              style={styles.closeButton}
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
              <Text style={styles.builderTitle}>Add a country-to-country flight</Text>
              <Text style={styles.builderCopy}>Search or choose from the complete country directory. Distance uses the countries’ geographic centers.</Text>

              <Text style={styles.fieldLabel}>From country</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerTarget("origin")}
                style={styles.countryField}
              >
                <View style={styles.countryBadge}>
                  <Text style={styles.countryBadgeText}>{origin?.code || "A"}</Text>
                </View>
                <View style={styles.fieldCopy}>
                  <Text style={[styles.fieldValue, !origin && styles.fieldPlaceholder]}>
                    {origin?.name || "Choose origin country"}
                  </Text>
                  <Text style={styles.fieldHint}>Tap to search or browse</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Swap origin and destination"
                onPress={() => {
                  setOriginCode(destinationCode);
                  setDestinationCode(originCode);
                  setLocalError(null);
                }}
                style={styles.swapButton}
              >
                <Text style={styles.swapGlyph}>⇅</Text>
                <Text style={styles.swapText}>Swap</Text>
              </Pressable>

              <Text style={styles.fieldLabel}>To country</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPickerTarget("destination")}
                style={styles.countryField}
              >
                <View style={styles.countryBadge}>
                  <Text style={styles.countryBadgeText}>{destination?.code || "B"}</Text>
                </View>
                <View style={styles.fieldCopy}>
                  <Text style={[styles.fieldValue, !destination && styles.fieldPlaceholder]}>
                    {destination?.name || "Choose destination country"}
                  </Text>
                  <Text style={styles.fieldHint}>Tap to search or browse</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

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

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void saveRoute()}
                style={({ pressed }) => [
                  styles.saveButton,
                  saving && styles.buttonDisabled,
                  pressed && !saving && styles.buttonPressed,
                ]}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveGlyph}>✈</Text>}
                <Text style={styles.saveText}>{saving ? "Saving route…" : "Add route to globe"}</Text>
              </Pressable>
            </View>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.listTitle}>Saved routes</Text>
                <Text style={styles.listSubtitle}>{routes.length} {routes.length === 1 ? "flight" : "flights"} mapped</Text>
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
                      style={styles.deleteButton}
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
                <Text style={styles.emptyIcon}>✈</Text>
                <Text style={styles.emptyTitle}>No routes yet</Text>
                <Text style={styles.emptyCopy}>Choose your first origin and destination to start your travel footprint.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <CountryPickerModal
        visible={pickerTarget !== null}
        title={pickerTarget === "origin" ? "Choose origin" : "Choose destination"}
        selectedCode={pickerTarget === "origin" ? originCode : destinationCode}
        disabledCode={pickerTarget === "origin" ? destinationCode : originCode}
        onClose={() => setPickerTarget(null)}
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
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E4ED",
    backgroundColor: "#FFFFFF",
  },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 14 },
  eyebrow: { color: "#7357EF", fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  title: { marginTop: 4, color: "#111D3A", fontSize: 23, lineHeight: 29, fontWeight: "900" },
  subtitle: { marginTop: 4, maxWidth: 430, color: "#6F7B91", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: "#E4E7EF", backgroundColor: "#FFFFFF" },
  closeGlyph: { color: "#26324B", fontSize: 25, lineHeight: 27, fontWeight: "600" },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 50 },
  routeBuilder: { padding: 18, borderRadius: 24, borderWidth: 1, borderColor: "#E0E3F2", backgroundColor: "#FFFFFF" },
  builderTitle: { color: "#17233E", fontSize: 17, lineHeight: 22, fontWeight: "900" },
  builderCopy: { marginTop: 4, marginBottom: 12, color: "#7A8599", fontSize: 11, lineHeight: 17, fontWeight: "600" },
  fieldLabel: { marginTop: 12, marginBottom: 7, color: "#4B5870", fontSize: 11, fontWeight: "800" },
  countryField: { minHeight: 68, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", borderRadius: 18, borderWidth: 1, borderColor: "#DDE2EE", backgroundColor: "#FBFCFF" },
  countryBadge: { width: 43, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#EEEAFE" },
  countryBadgeText: { color: "#6549DA", fontSize: 12, fontWeight: "900" },
  fieldCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  fieldValue: { color: "#17233E", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  fieldPlaceholder: { color: "#8A94A8" },
  fieldHint: { marginTop: 2, color: "#8A94A8", fontSize: 10, lineHeight: 13, fontWeight: "600" },
  chevron: { color: "#7357EF", fontSize: 24, fontWeight: "700" },
  swapButton: { alignSelf: "center", marginTop: 10, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F1EEFF" },
  swapGlyph: { color: "#6549DA", fontSize: 15, fontWeight: "900" },
  swapText: { color: "#6549DA", fontSize: 10, fontWeight: "800" },
  dateInput: { minHeight: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: "#DDE2EE", backgroundColor: "#FBFCFF", color: "#17233E", fontSize: 14, fontWeight: "700" },
  errorBox: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: "#FFF0F4", borderWidth: 1, borderColor: "#FFD4DF" },
  errorText: { color: "#B33A5D", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  saveButton: { minHeight: 54, marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 17, backgroundColor: "#7357EF" },
  saveGlyph: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  buttonDisabled: { opacity: 0.58 },
  buttonPressed: { opacity: 0.82 },
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
  deleteGlyph: { color: "#D94C72", fontSize: 24, fontWeight: "600" },
  emptyRoutes: { marginTop: 10, alignItems: "center", paddingHorizontal: 24, paddingVertical: 36, borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "#D9DEEA", backgroundColor: "#FFFFFF" },
  emptyIcon: { color: "#7357EF", fontSize: 25 },
  emptyTitle: { marginTop: 9, color: "#17233E", fontSize: 15, fontWeight: "900" },
  emptyCopy: { maxWidth: 340, marginTop: 5, color: "#7A8599", fontSize: 11, lineHeight: 17, textAlign: "center", fontWeight: "600" },
});
