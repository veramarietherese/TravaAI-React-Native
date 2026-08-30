import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  arrivalTime,
  fetchTravaRoute,
  formatRouteDistance,
  formatRouteDuration,
  openAppleMapsDirections,
  type MapCoordinate,
  type TravaRoute,
  type TravaTravelMode,
} from "../utils/trava-route";
import type { TripMapSurfaceProps } from "./TripMapSurface.types";

const FALLBACK = { latitude: 35.6812, longitude: 139.7671 };

export function TripMapSurface(props: TripMapSurfaceProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [origin, setOrigin] = useState<MapCoordinate | null>(null);
  const [mode, setMode] = useState<TravaTravelMode>("drive");
  const [route, setRoute] = useState<TravaRoute | null>(null);
  const [loading, setLoading] = useState(false);

  const points = useMemo(
    () => props.activities.flatMap((activity) =>
      activity.latitude == null || activity.longitude == null
        ? []
        : [{ ...activity, latitude: activity.latitude, longitude: activity.longitude }],
    ),
    [props.activities],
  );
  const selected = points.find((activity) => activity.id === props.selectedActivityId) ?? null;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted) setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!origin || !selected || mode === "transit") {
      setRoute(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void fetchTravaRoute(origin, selected, mode).then((next) => {
      if (!active) return;
      setRoute(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [mode, origin, selected]);

  const content = (
    <TripMapCanvas
      {...props}
      points={points}
      selected={selected}
      origin={origin}
      mode={mode}
      onMode={setMode}
      route={route}
      routeLoading={loading}
      fullscreen={fullscreen}
      onExpand={() => setFullscreen(true)}
      onCollapse={() => setFullscreen(false)}
    />
  );

  return (
    <>
      {!fullscreen ? content : null}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={styles.fullSafe} edges={["top", "bottom"]}>{content}</SafeAreaView>
      </Modal>
    </>
  );
}

type ValidPoint = TripMapSurfaceProps["activities"][number] & { latitude: number; longitude: number };

type TripMapCanvasProps = TripMapSurfaceProps & {
  points: ValidPoint[];
  selected: ValidPoint | null;
  origin: MapCoordinate | null;
  mode: TravaTravelMode;
  onMode(value: TravaTravelMode): void;
  route: TravaRoute | null;
  routeLoading: boolean;
  fullscreen: boolean;
  onExpand(): void;
  onCollapse(): void;
};

function TripMapCanvas({
  selectedActivityId,
  onSelectActivity,
  height = 360,
  points,
  selected,
  origin,
  mode,
  onMode,
  route,
  routeLoading,
  fullscreen,
  onExpand,
  onCollapse,
}: TripMapCanvasProps) {
  const mapRef = useRef<MapView>(null);
  const initial = selected ?? points[0] ?? FALLBACK;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (route?.coordinates.length) {
      map.fitToCoordinates(route.coordinates, {
        animated: true,
        edgePadding: fullscreen ? { top: 90, right: 60, bottom: 245, left: 60 } : { top: 60, right: 44, bottom: 160, left: 44 },
      });
      return;
    }
    const coordinates = points.map(({ latitude, longitude }) => ({ latitude, longitude }));
    if (coordinates.length > 1) {
      map.fitToCoordinates(coordinates, { animated: true, edgePadding: { top: 56, right: 48, bottom: 56, left: 48 } });
    } else if (coordinates.length === 1) {
      map.animateCamera({ center: coordinates[0], zoom: 14 }, { duration: 280 });
    }
  }, [fullscreen, points, route]);

  async function zoom(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    const camera = await map.getCamera();
    map.animateCamera({ ...camera, zoom: Math.max(2, Math.min(20, (camera.zoom ?? 13) + delta)) }, { duration: 180 });
  }

  async function navigate() {
    if (!selected) return;
    await openAppleMapsDirections(selected, mode, origin, selected.title).catch(() => undefined);
  }

  return (
    <View style={[styles.wrap, !fullscreen && { height }, fullscreen && styles.wrapFull]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
        mapType="standard"
        showsUserLocation
        showsCompass
      >
        {route?.coordinates.length ? (
          <>
            <Polyline coordinates={route.coordinates} strokeWidth={8} strokeColor="rgba(255,255,255,.94)" />
            <Polyline coordinates={route.coordinates} strokeWidth={5} strokeColor="#7868F2" />
          </>
        ) : points.length > 1 ? (
          <Polyline coordinates={points.map(({ latitude, longitude }) => ({ latitude, longitude }))} strokeWidth={3} strokeColor="#7189D8" lineDashPattern={[7, 7]} />
        ) : null}

        {points.map((activity) => {
          const active = activity.id === selectedActivityId;
          return (
            <Marker
              key={activity.id}
              coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
              title={activity.title}
              description={activity.locationName}
              onPress={() => onSelectActivity?.(activity.id)}
            >
              <View style={[styles.marker, active && styles.markerActive]}><Text style={styles.emoji}>{emojiFor(activity.category)}</Text></View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.mapTools}>
        <Pressable onPress={fullscreen ? onCollapse : onExpand} style={styles.toolButton}><Ionicons name={fullscreen ? "contract-outline" : "expand-outline"} size={18} color="#606775" /></Pressable>
        <Pressable onPress={() => void zoom(1)} style={styles.toolButton}><Ionicons name="add" size={21} color="#606775" /></Pressable>
        <Pressable onPress={() => void zoom(-1)} style={styles.toolButton}><Ionicons name="remove" size={21} color="#606775" /></Pressable>
      </View>

      {selected ? (
        <View style={[styles.navCard, fullscreen && styles.navCardFull]}>
          <View style={styles.navHead}>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.navTitle}>{selected.title}</Text><Text numberOfLines={1} style={styles.navSub}>{selected.locationName}</Text></View>
            {routeLoading ? <ActivityIndicator size="small" color="#7868F2" /> : null}
          </View>
          <View style={styles.modeRow}>
            {(["drive", "walk", "transit"] as TravaTravelMode[]).map((item) => (
              <Pressable key={item} onPress={() => onMode(item)} style={[styles.modeChip, mode === item && styles.modeChipOn]}>
                <Ionicons name={item === "drive" ? "car-outline" : item === "walk" ? "walk-outline" : "bus-outline"} size={15} color={mode === item ? "#735EE8" : "#626A79"} />
                <Text style={[styles.modeText, mode === item && styles.modeTextOn]}>{item === "drive" ? "Drive" : item === "walk" ? "Walk" : "Transit"}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.routeLine}>
            {mode === "transit" ? "Live transit route in Apple Maps" : route ? `${formatRouteDuration(route.durationSeconds)} · ${formatRouteDistance(route.distanceMeters)} · arrive ${arrivalTime(route.durationSeconds)}` : origin ? "Calculating route…" : "Enable location for ETA"}
          </Text>
          <Pressable onPress={() => void navigate()} style={styles.goButton}><Ionicons name="navigate" size={16} color="#FFFFFF" /><Text style={styles.goText}>Start directions</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function emojiFor(category: string) {
  const key = String(category || "").toLowerCase();
  if (key.includes("food")) return "🍜";
  if (key.includes("stay") || key.includes("hotel")) return "🛏️";
  if (key.includes("flight") || key.includes("airport")) return "✈️";
  if (key.includes("transport")) return "🚕";
  if (key.includes("shop")) return "🛍️";
  if (key.includes("meeting") || key.includes("work")) return "💼";
  if (key.includes("sight")) return "📸";
  return "📍";
}

const styles = StyleSheet.create({
  fullSafe: { flex: 1, backgroundColor: "#F8F8FB" },
  wrap: { overflow: "hidden", borderRadius: 27, borderWidth: 1, borderColor: "#E2E5EA", backgroundColor: "#EEF2F5" },
  wrapFull: { flex: 1, borderRadius: 0, borderWidth: 0 },
  marker: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#24303E", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  markerActive: { borderColor: "#7868F2", transform: [{ scale: 1.08 }] },
  emoji: { fontSize: 22 },
  mapTools: { position: "absolute", right: 12, top: 12, gap: 7 },
  toolButton: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.96)", shadowColor: "#24303E", shadowOpacity: 0.11, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  navCard: { position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,.97)", shadowColor: "#24303E", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  navCardFull: { left: 16, right: 16, bottom: 18, borderRadius: 23, padding: 15 },
  navHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  navTitle: { fontSize: 13, fontWeight: "800", color: "#252C3A" },
  navSub: { marginTop: 2, fontSize: 10, color: "#808897" },
  modeRow: { flexDirection: "row", gap: 7, marginTop: 9 },
  modeChip: { flex: 1, height: 34, borderRadius: 11, borderWidth: 1, borderColor: "#E2E5EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#FAFBFD" },
  modeChipOn: { borderColor: "#CABDFF", backgroundColor: "#F6F2FF" },
  modeText: { fontSize: 10, fontWeight: "700", color: "#626A79" },
  modeTextOn: { color: "#735EE8" },
  routeLine: { marginTop: 8, fontSize: 10.5, color: "#727B8C" },
  goButton: { marginTop: 9, height: 38, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#826BF2" },
  goText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
