import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";

import type { TripActivity } from "@trava/shared";
import type { TripMapSurfaceProps } from "./TripMapSurface.types";

const DEFAULT_REGION: Region = { latitude: 12.8797, longitude: 121.774, latitudeDelta: 12, longitudeDelta: 12 };

function coordinates(activities: TripActivity[]) {
  return activities
    .filter((item) => item.latitude !== null && item.longitude !== null)
    .map((item) => ({ latitude: item.latitude as number, longitude: item.longitude as number }));
}

function initialRegion(activities: TripActivity[]): Region {
  const points = coordinates(activities);
  if (!points.length) return DEFAULT_REGION;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.7),
    longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.7),
  };
}

export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, showUserLocation = true, height = 320 }: TripMapSurfaceProps) {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const plotted = activities.filter((item) => item.latitude !== null && item.longitude !== null);

  async function enableLocation() {
    setPermissionBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Location permission", "Location access is optional. You can still view all saved itinerary markers.");
        return;
      }
      setLocationEnabled(true);
    } finally {
      setPermissionBusy(false);
    }
  }

  async function navigate(activity: TripActivity) {
    if (activity.latitude === null || activity.longitude === null) return;
    const label = encodeURIComponent(activity.locationName);
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${activity.latitude},${activity.longitude}&q=${label}`,
      android: `google.navigation:q=${activity.latitude},${activity.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${activity.latitude},${activity.longitude}`,
    });
    if (url && await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion(activities)}
        showsUserLocation={showUserLocation && locationEnabled}
        showsMyLocationButton={false}
        mapType="standard"
      >
        {plotted.length > 1 ? <Polyline coordinates={coordinates(plotted)} strokeColor="#7257EC" strokeWidth={4} /> : null}
        {plotted.map((activity, index) => (
          <Marker
            key={activity.id}
            coordinate={{ latitude: activity.latitude as number, longitude: activity.longitude as number }}
            title={`${index + 1}. ${activity.title}`}
            description={activity.locationName}
            pinColor={activity.id === selectedActivityId ? "#FF6F91" : "#7257EC"}
            onPress={() => onSelectActivity?.(activity.id)}
            onCalloutPress={() => void navigate(activity)}
          />
        ))}
      </MapView>
      {!plotted.length ? <View pointerEvents="none" style={styles.empty}><Text style={styles.emptyTitle}>No mapped activities yet</Text><Text style={styles.emptyText}>Add a location to an itinerary activity to place it on this map.</Text></View> : null}
      {showUserLocation ? <Pressable disabled={permissionBusy} onPress={() => void enableLocation()} style={styles.locationButton}><Text style={styles.locationText}>{locationEnabled ? "Location on" : permissionBusy ? "Checking…" : "Use my location"}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", borderRadius: 24, backgroundColor: "#E9ECF7", borderWidth: 1, borderColor: "#E4E6F1" },
  empty: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "rgba(248,249,255,0.88)" },
  emptyTitle: { color: "#17223C", fontSize: 16, fontWeight: "900" },
  emptyText: { marginTop: 7, maxWidth: 250, textAlign: "center", color: "#758097", fontSize: 11, lineHeight: 17, fontWeight: "600" },
  locationButton: { position: "absolute", right: 12, bottom: 12, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(20,29,52,0.9)" },
  locationText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
});
