import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile, type LatLng } from "react-native-maps";
import type { TripMapSurfaceProps } from "./TripMapSurface.types";

export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, height = 360 }: TripMapSurfaceProps) {
  const mapRef = useRef<MapView | null>(null);
  const points = useMemo(() => activities.filter((a) => a.latitude != null && a.longitude != null), [activities]);
  const coordinates = useMemo<LatLng[]>(() => points.map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) })), [points]);

  useEffect(() => {
    if (!coordinates.length) return;
    const timer = setTimeout(() => {
      if (coordinates.length === 1) {
        mapRef.current?.animateToRegion({ ...coordinates[0], latitudeDelta: 0.08, longitudeDelta: 0.08 }, 350);
      } else {
        mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 60, right: 45, bottom: 60, left: 45 }, animated: true });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [coordinates]);

  return (
    <View style={[styles.wrap, { height }]}> 
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 35.6812, longitude: 139.7671, latitudeDelta: 0.18, longitudeDelta: 0.18 }}
        mapType={Platform.OS === "android" ? "none" : "mutedStandard"}
        showsCompass
        showsScale
        toolbarEnabled={false}
        loadingEnabled
      >
        {Platform.OS === "android" ? <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} /> : null}
        {coordinates.length > 1 ? <Polyline coordinates={coordinates} strokeColor="#75AFE9" strokeWidth={4} lineCap="round" lineJoin="round" /> : null}
        {points.map((activity, index) => (
          <Marker
            key={activity.id}
            coordinate={{ latitude: Number(activity.latitude), longitude: Number(activity.longitude) }}
            title={activity.title}
            description={activity.locationName}
            onPress={() => onSelectActivity?.(activity.id)}
          >
            <View style={[styles.pin, selectedActivityId === activity.id && styles.pinSelected]}><Text style={styles.pinText}>{index + 1}</Text></View>
          </Marker>
        ))}
      </MapView>
      <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}><Text style={styles.badgeStrong}>Interactive map</Text> · drag · zoom · tap stops</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 27, borderWidth: 1, borderColor: "#E6EEF8", backgroundColor: "#EEF7FF" },
  pin: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#9FC8F5", borderWidth: 3, borderColor: "#FFFFFF", shadowColor: "#55759B", shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pinSelected: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#B3AFF5", shadowOpacity: 0.3 },
  pinText: { color: "#15213A", fontSize: 11, fontWeight: "900" },
  badge: { position: "absolute", left: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, backgroundColor: "rgba(255,255,255,.93)", borderWidth: 1, borderColor: "rgba(255,255,255,.98)" },
  badgeText: { color: "#596983", fontSize: 9, fontWeight: "700" }, badgeStrong: { color: "#15213A", fontWeight: "900" },
});
