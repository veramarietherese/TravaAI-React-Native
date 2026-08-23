import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile, type LatLng } from "react-native-maps";
import type { TripMapSurfaceProps } from "./TripMapSurface.types";

export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, height = 360 }: TripMapSurfaceProps) {
  const mapRef = useRef<MapView | null>(null);
  const points = useMemo(() => activities.filter((a) => a.latitude != null && a.longitude != null), [activities]);
  const localPoints = useMemo(() => points.filter((p) => p.category !== "flight"), [points]);
  const focusPoints = localPoints.length ? localPoints : points;
  const localCoordinates = useMemo<LatLng[]>(() => localPoints.map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) })), [localPoints]);

  const fitLocal = useCallback(() => {
    const coordinates = focusPoints.map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }));
    if (!coordinates.length) return;
    if (coordinates.length === 1) mapRef.current?.animateToRegion({ ...coordinates[0], latitudeDelta: 0.08, longitudeDelta: 0.08 }, 300);
    else mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 70, right: 50, bottom: 75, left: 50 }, animated: true });
  }, [focusPoints]);

  useEffect(() => { const timer = setTimeout(fitLocal, 160); return () => clearTimeout(timer); }, [fitLocal]);
  useEffect(() => {
    const selected = points.find((p) => p.id === selectedActivityId && p.category !== "flight");
    if (!selected) return;
    mapRef.current?.animateToRegion({ latitude: Number(selected.latitude), longitude: Number(selected.longitude), latitudeDelta: 0.04, longitudeDelta: 0.04 }, 280);
  }, [selectedActivityId, points]);

  return <View style={[styles.wrap, { height }]}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={{ latitude: 35.6812, longitude: 139.7671, latitudeDelta: 0.22, longitudeDelta: 0.22 }} mapType={Platform.OS === "android" ? "none" : "standard"} showsCompass showsScale toolbarEnabled={false} loadingEnabled>
      {Platform.OS === "android" ? <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} /> : null}
      {localCoordinates.length > 1 ? <Polyline coordinates={localCoordinates} strokeColor="#6EA7DE" strokeWidth={4} lineDashPattern={[10, 6]} lineCap="round" lineJoin="round" /> : null}
      {points.map((activity, index) => <Marker key={activity.id} coordinate={{ latitude: Number(activity.latitude), longitude: Number(activity.longitude) }} title={activity.title} description={activity.locationName} onPress={() => onSelectActivity?.(activity.id)}><View style={[styles.pin, selectedActivityId === activity.id && styles.pinSelected]}><Text style={styles.pinText}>{index + 1}</Text></View></Marker>)}
    </MapView>
    <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}><Text style={styles.badgeStrong}>Live map</Text> · drag · zoom · tap stops</Text></View>
    <Pressable onPress={fitLocal} style={styles.reset}><Text style={styles.resetText}>Fit local stops</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 27, borderWidth: 1, borderColor: "#DDEAF6", backgroundColor: "#EEF7FF" },
  pin: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#70A9E4", borderWidth: 3, borderColor: "#FFFFFF", elevation: 5 },
  pinSelected: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#A18FE5" },
  pinText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  badge: { position: "absolute", left: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, backgroundColor: "rgba(255,255,255,.94)", borderWidth: 1, borderColor: "rgba(255,255,255,.98)" },
  badgeText: { color: "#596983", fontSize: 9, fontWeight: "700" }, badgeStrong: { color: "#15213A", fontWeight: "900" },
  reset: { position: "absolute", right: 12, top: 12, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 13, backgroundColor: "rgba(255,255,255,.95)" }, resetText: { color: "#496D98", fontSize: 9, fontWeight: "900" },
});
