import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useTravelRoutes } from "../hooks/useTravelRoutes";
import type { HomeTravelRoute } from "../types/home.types";
import { TravelGlobeSurface } from "./TravelGlobeSurface";
import type { TravelGlobeCommand } from "./TravelGlobeSurface.types";
import { TravelRouteEditorModal } from "./TravelRouteEditorModal";

interface TravelFootprintCardProps {
  userId?: string;
}

type GlobeCommandType = "zoom-in" | "zoom-out" | "reset";
const STAT_ITEMS: Array<{ key: "distance" | "flights" | "countries" | "days"; glyph: string; label: string }> = [
  { key: "distance", glyph: "◎", label: "Total Distance" },
  { key: "flights", glyph: "✈︎", label: "Flights Taken" },
  { key: "countries", glyph: "⌖", label: "Countries" },
  { key: "days", glyph: "◫", label: "Travel Days" },
];

function formatDistance(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} km`;
}

function buildLatestJourney(routes: HomeTravelRoute[]) {
  if (!routes.length) return null;

  const ordered = routes.slice().sort((a, b) => {
    const aCreated = Date.parse(a.createdAt || a.traveledAt);
    const bCreated = Date.parse(b.createdAt || b.traveledAt);
    return aCreated - bCreated;
  });

  const latest = ordered[ordered.length - 1];
  const chain = [latest.originName, latest.destinationName];
  let currentOriginCode = latest.originCode;
  let legs = 1;

  for (let index = ordered.length - 2; index >= 0; index -= 1) {
    const candidate = ordered[index];
    if (candidate.traveledAt !== latest.traveledAt) break;
    if (candidate.destinationCode !== currentOriginCode) break;
    chain.unshift(candidate.originName);
    currentOriginCode = candidate.originCode;
    legs += 1;
  }

  return {
    label: chain.join(" → "),
    legs,
  };
}

function OutlineGlyph({ glyph, inverted = false, size = 20 }: { glyph: string; inverted?: boolean; size?: number }) {
  return (
    <Text
      allowFontScaling={false}
      style={[styles.outlineGlyph, { fontSize: size, lineHeight: size + 3 }, inverted && styles.outlineGlyphInverted]}
    >
      {glyph}
    </Text>
  );
}

function GlobeControl({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.controlButton, pressed && styles.controlPressed]}
    >
      <OutlineGlyph glyph={glyph} />
    </Pressable>
  );
}

export function TravelFootprintCard({ userId }: TravelFootprintCardProps) {
  const { width } = useWindowDimensions();
  const compact = width < 430;
  const travelRoutes = useTravelRoutes(userId);
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [command, setCommand] = useState<TravelGlobeCommand | null>(null);
  const commandIdRef = useRef(0);

  const latestJourney = useMemo(() => buildLatestJourney(travelRoutes.routes), [travelRoutes.routes]);

  function sendCommand(type: GlobeCommandType) {
    commandIdRef.current += 1;
    setCommand({ id: commandIdRef.current, type });
  }

  function focusCountry(countryCode: string) {
    commandIdRef.current += 1;
    setCommand({ id: commandIdRef.current, type: "focus", countryCode });
  }

  const values = {
    distance: formatDistance(travelRoutes.stats.totalDistanceKm),
    flights: String(travelRoutes.stats.flights),
    countries: String(travelRoutes.stats.countries),
    days: String(travelRoutes.stats.travelDays),
  };

  return (
    <>
      <LinearGradient
        colors={["#EAF4FF", "#F0EDFF", "#FDECF5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.root}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>YOUR WORLD MAP</Text>
            <Text style={styles.title}>Travel Footprint</Text>
            <Text style={styles.subtitle}>Drag to rotate • pinch or scroll to zoom</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full-screen globe"
            onPress={() => setFullScreenOpen(true)}
            style={({ pressed }) => [styles.fullScreenButton, pressed && styles.controlPressed]}
          >
            <OutlineGlyph glyph="⛶" size={21} />
          </Pressable>
        </View>

        <View style={styles.globePanel}>
          <TravelGlobeSurface
            routes={travelRoutes.routes}
            command={command}
            onError={setSurfaceError}
          />

          <View style={styles.globeControls}>
            <GlobeControl label="Zoom in" glyph="+" onPress={() => sendCommand("zoom-in")} />
            <GlobeControl label="Zoom out" glyph="−" onPress={() => sendCommand("zoom-out")} />
            <GlobeControl label="Reset globe" glyph="↻" onPress={() => sendCommand("reset")} />
          </View>

          {travelRoutes.isLoading ? (
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#6248D8" />
              <Text style={styles.loadingText}>Loading routes</Text>
            </View>
          ) : null}

          {surfaceError ? (
            <View style={styles.surfaceError}>
              <Text style={styles.surfaceErrorText}>{surfaceError}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.routeSummaryRow}>
          <View style={styles.routeSummaryCopy}>
            <Text style={styles.routeSummaryTitle}>
              {latestJourney ? "Your latest journey" : "Map your first journey"}
            </Text>
            <Text numberOfLines={1} style={styles.routeSummarySubtitle}>
              {latestJourney
                ? `${latestJourney.label} • ${latestJourney.legs} ${latestJourney.legs === 1 ? "leg" : "legs"}`
                : "Choose one-way, multi-stop, or round trip and map it in seconds."}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRouteEditorOpen(true)}
            style={({ pressed }) => [styles.manageButton, pressed && styles.managePressed]}
          >
            <OutlineGlyph glyph="⌁" size={17} inverted />
            <Text style={styles.manageText}>{travelRoutes.routes.length ? "Edit journey" : "Plan journey"}</Text>
          </Pressable>
        </View>

        {travelRoutes.error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading travel routes"
            onPress={() => void travelRoutes.refresh()}
            style={styles.dataError}
          >
            <Text style={styles.dataErrorText}>{travelRoutes.error}</Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        ) : null}

        <View style={[styles.stats, compact && styles.statsCompact]}>
          {STAT_ITEMS.map((item) => (
            <View key={item.key} style={[styles.stat, compact && styles.statCompact]}>
              <OutlineGlyph glyph={item.glyph} size={18} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
                {values[item.key]}
              </Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <Modal
        visible={fullScreenOpen}
        animationType="fade"
        onRequestClose={() => setFullScreenOpen(false)}
      >
        <SafeAreaView style={styles.fullScreenSafe}>
          <LinearGradient
            colors={["#EDF6FF", "#F2EEFF", "#FDECF5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.fullScreenHeader}>
            <View style={styles.fullScreenHeaderCopy}>
              <Text style={styles.fullScreenEyebrow}>INTERACTIVE MAP</Text>
              <Text style={styles.fullScreenTitle}>Your travel globe</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close full-screen globe"
              onPress={() => setFullScreenOpen(false)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.controlPressed]}
            >
              <OutlineGlyph glyph="×" size={25} />
            </Pressable>
          </View>

          <View style={styles.fullScreenGlobe}>
            <TravelGlobeSurface routes={travelRoutes.routes} command={command} onError={setSurfaceError} />
            <View style={styles.fullScreenControls}>
              <GlobeControl label="Zoom in" glyph="+" onPress={() => sendCommand("zoom-in")} />
              <GlobeControl label="Zoom out" glyph="−" onPress={() => sendCommand("zoom-out")} />
              <GlobeControl label="Reset globe" glyph="↻" onPress={() => sendCommand("reset")} />
            </View>
          </View>

          <View style={styles.fullScreenFooter}>
            <View style={styles.fullScreenStats}>
              <Text style={styles.fullScreenStatValue}>{values.distance}</Text>
              <Text style={styles.fullScreenStatLabel}>
                {travelRoutes.stats.flights} flights • {travelRoutes.stats.countries} countries
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFullScreenOpen(false);
                setRouteEditorOpen(true);
              }}
              style={({ pressed }) => [styles.fullScreenManage, pressed && styles.managePressed]}
            >
              <OutlineGlyph glyph="⌁" size={17} inverted />
              <Text style={styles.fullScreenManageText}>Plan journey</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <TravelRouteEditorModal
        visible={routeEditorOpen}
        routes={travelRoutes.routes}
        saving={travelRoutes.isSaving}
        error={travelRoutes.error}
        onClose={() => setRouteEditorOpen(false)}
        onAdd={travelRoutes.addRoute}
        onDelete={travelRoutes.removeRoute}
        onFocus={focusCountry}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 24,
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  headingRow: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  headingCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  eyebrow: { color: "#7357EF", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  title: { marginTop: 3, color: "#111D3A", fontSize: 19, lineHeight: 24, fontWeight: "900" },
  subtitle: { marginTop: 2, color: "#68748D", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  fullScreenButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(125,102,222,0.12)",
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  globePanel: {
    height: 300,
    marginHorizontal: 12,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(240,244,255,0.58)",
  },
  globeControls: { position: "absolute", top: 11, right: 11, gap: 7 },
  controlButton: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(103,78,205,0.16)",
    backgroundColor: "rgba(255,255,255,0.84)",
  },
  outlineGlyph: { color: "#6248D8", fontWeight: "500", textAlign: "center" },
  outlineGlyphInverted: { color: "#FFFFFF" },
  controlPressed: { opacity: 0.64 },
  loadingBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    minHeight: 34,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(116,92,220,0.10)",
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  loadingText: { color: "#5F50A9", fontSize: 10, fontWeight: "700" },
  surfaceError: {
    position: "absolute",
    left: 12,
    right: 58,
    bottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD2DF",
    backgroundColor: "rgba(255,244,248,0.94)",
  },
  surfaceErrorText: { color: "#A94B69", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  routeSummaryRow: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeSummaryCopy: { flex: 1, minWidth: 0 },
  routeSummaryTitle: { color: "#17233E", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  routeSummarySubtitle: { marginTop: 2, color: "#6F7B91", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  manageButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    backgroundColor: "#7357EF",
  },
  managePressed: { opacity: 0.78 },
  manageText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  dataError: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#FFD0DD",
    backgroundColor: "#FFF1F5",
  },
  dataErrorText: { flex: 1, color: "#A93C5C", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  retryText: { color: "#7357EF", fontSize: 10, fontWeight: "900" },
  stats: {
    minHeight: 91,
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.94)",
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  statsCompact: { minHeight: 114, flexWrap: "wrap" },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#E4E7EF",
  },
  statCompact: {
    flexBasis: "50%",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E4E7EF",
  },
  statValue: { color: "#111D3A", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  statLabel: { color: "#5F6D86", fontSize: 10, lineHeight: 13, fontWeight: "600" },
  fullScreenSafe: { flex: 1, backgroundColor: "#F4F5FF" },
  fullScreenHeader: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(103,82,194,0.12)",
  },
  fullScreenHeaderCopy: { flex: 1, minWidth: 0 },
  fullScreenEyebrow: { color: "#8069DE", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  fullScreenTitle: { marginTop: 3, color: "#17233E", fontSize: 20, lineHeight: 25, fontWeight: "900" },
  closeButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(103,82,194,0.14)",
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  fullScreenGlobe: { flex: 1, minHeight: 0, backgroundColor: "transparent" },
  fullScreenControls: { position: "absolute", right: 16, top: 16, gap: 8 },
  fullScreenFooter: {
    minHeight: 92,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(103,82,194,0.12)",
    backgroundColor: "rgba(255,255,255,0.54)",
  },
  fullScreenStats: { flex: 1, minWidth: 0 },
  fullScreenStatValue: { color: "#17233E", fontSize: 18, fontWeight: "900" },
  fullScreenStatLabel: { marginTop: 3, color: "#6F7B91", fontSize: 11, fontWeight: "600" },
  fullScreenManage: {
    minHeight: 46,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 15,
    backgroundColor: "#7357EF",
  },
  fullScreenManageText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
