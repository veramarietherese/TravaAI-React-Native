import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
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
import { TravelGlobeSurface } from "./TravelGlobeSurface";
import type { TravelGlobeCommand } from "./TravelGlobeSurface.types";
import { TravelRouteEditorModal } from "./TravelRouteEditorModal";

interface TravelFootprintCardProps {
  userId?: string;
}

type GlobeCommandType = "zoom-in" | "zoom-out" | "reset";

const STAT_ITEMS = [
  { key: "distance", icon: "◎", label: "Total Distance" },
  { key: "flights", icon: "✈", label: "Flights Taken" },
  { key: "countries", icon: "⌖", label: "Countries" },
  { key: "days", icon: "◫", label: "Travel Days" },
] as const;

function formatDistance(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} km`;
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
      <Text style={styles.controlGlyph}>{glyph}</Text>
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
        colors={["#EDF4FF", "#E7E9FF", "#FCE8F4"]}
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
            <Text style={styles.fullScreenGlyph}>⛶</Text>
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
            <GlobeControl label="Reset globe" glyph="↺" onPress={() => sendCommand("reset")} />
          </View>

          {travelRoutes.isLoading ? (
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#FFFFFF" />
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
              {travelRoutes.routes.length
                ? `${travelRoutes.routes.length} ${travelRoutes.routes.length === 1 ? "route" : "routes"} mapped`
                : "Map your first flight"}
            </Text>
            <Text numberOfLines={1} style={styles.routeSummarySubtitle}>
              {travelRoutes.routes.length
                ? `${travelRoutes.routes[0]?.originName ?? ""} → ${travelRoutes.routes[travelRoutes.routes.length - 1]?.destinationName ?? ""}`
                : "Choose country A and country B to draw a visible route."}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRouteEditorOpen(true)}
            style={({ pressed }) => [styles.manageButton, pressed && styles.managePressed]}
          >
            <Text style={styles.manageGlyph}>＋</Text>
            <Text style={styles.manageText}>Manage routes</Text>
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
              <Text style={styles.statIcon}>{item.icon}</Text>
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
          <View style={styles.fullScreenHeader}>
            <View style={styles.fullScreenHeaderCopy}>
              <Text style={styles.fullScreenEyebrow}>INTERACTIVE MAP</Text>
              <Text style={styles.fullScreenTitle}>Your travel globe</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close full-screen globe"
              onPress={() => setFullScreenOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          <View style={styles.fullScreenGlobe}>
            <TravelGlobeSurface routes={travelRoutes.routes} command={command} onError={setSurfaceError} />
            <View style={styles.fullScreenControls}>
              <GlobeControl label="Zoom in" glyph="+" onPress={() => sendCommand("zoom-in")} />
              <GlobeControl label="Zoom out" glyph="−" onPress={() => sendCommand("zoom-out")} />
              <GlobeControl label="Reset globe" glyph="↺" onPress={() => sendCommand("reset")} />
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
              <Text style={styles.fullScreenManageText}>Add or search routes</Text>
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
    borderColor: "rgba(255,255,255,0.92)",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  fullScreenGlyph: { color: "#5C45CC", fontSize: 21, fontWeight: "900" },
  globePanel: {
    height: 292,
    marginHorizontal: 12,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#111339",
  },
  globeControls: { position: "absolute", top: 11, right: 11, gap: 7 },
  controlButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    backgroundColor: "rgba(17,19,57,0.72)",
  },
  controlPressed: { opacity: 0.68 },
  controlGlyph: { color: "#FFFFFF", fontSize: 20, lineHeight: 23, fontWeight: "800" },
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
    backgroundColor: "rgba(17,19,57,0.76)",
  },
  loadingText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  surfaceError: {
    position: "absolute",
    left: 12,
    right: 58,
    bottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(110,31,58,0.88)",
  },
  surfaceErrorText: { color: "#FFFFFF", fontSize: 10, lineHeight: 14, fontWeight: "700" },
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
    gap: 5,
    borderRadius: 14,
    backgroundColor: "#7357EF",
  },
  managePressed: { opacity: 0.78 },
  manageGlyph: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
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
    borderColor: "rgba(255,255,255,0.92)",
    backgroundColor: "rgba(255,255,255,0.88)",
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
  statIcon: { color: "#7357EF", fontSize: 18, lineHeight: 21, fontWeight: "800" },
  statValue: { color: "#111D3A", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  statLabel: { color: "#5F6D86", fontSize: 10, lineHeight: 13, fontWeight: "600" },
  fullScreenSafe: { flex: 1, backgroundColor: "#0E1033" },
  fullScreenHeader: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  fullScreenHeaderCopy: { flex: 1, minWidth: 0 },
  fullScreenEyebrow: { color: "#A89CFF", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  fullScreenTitle: { marginTop: 3, color: "#FFFFFF", fontSize: 20, lineHeight: 25, fontWeight: "900" },
  closeButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeGlyph: { color: "#FFFFFF", fontSize: 27, lineHeight: 29, fontWeight: "500" },
  fullScreenGlobe: { flex: 1, minHeight: 0, backgroundColor: "#111339" },
  fullScreenControls: { position: "absolute", right: 16, top: 16, gap: 8 },
  fullScreenFooter: {
    minHeight: 92,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  fullScreenStats: { flex: 1, minWidth: 0 },
  fullScreenStatValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  fullScreenStatLabel: { marginTop: 3, color: "#B7BED7", fontSize: 11, fontWeight: "600" },
  fullScreenManage: {
    minHeight: 46,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#7357EF",
  },
  fullScreenManageText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
