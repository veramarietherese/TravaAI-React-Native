import * as Linking from "expo-linking";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TripMapSurfaceProps } from "./TripMapSurface.types";

export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, height = 320 }: TripMapSurfaceProps) {
  const plotted = activities.filter((item) => item.latitude !== null && item.longitude !== null);
  return (
    <View style={[styles.wrap, { minHeight: height }]}>
      <View style={styles.grid} />
      <View style={styles.header}><Text style={styles.title}>Native itinerary map</Text><Text style={styles.subtitle}>Open a saved stop in your system maps for turn-by-turn directions.</Text></View>
      <View style={styles.list}>
        {plotted.map((activity, index) => (
          <View key={activity.id} style={[styles.stop, selectedActivityId === activity.id && styles.stopActive]}>
            <Pressable accessibilityRole="button" onPress={() => onSelectActivity?.(activity.id)} style={styles.stopMain}>
              <View style={styles.marker}><Text style={styles.markerText}>{index + 1}</Text></View>
              <View style={styles.copy}><Text style={styles.stopTitle}>{activity.title}</Text><Text style={styles.stopPlace}>{activity.locationName}</Text></View>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${activity.latitude},${activity.longitude}`)} style={styles.navigate}><Text style={styles.navigateText}>Navigate</Text></Pressable>
          </View>
        ))}
        {!plotted.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No mapped activities yet</Text><Text style={styles.emptyText}>Add a searched location to an itinerary activity.</Text></View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", borderRadius: 24, backgroundColor: "#EEF1FF", borderWidth: 1, borderColor: "#E0E4F4", padding: 18 },
  grid: { ...StyleSheet.absoluteFill, opacity: 0.18, backgroundColor: "#DCE3FF" },
  header: { zIndex: 1 },
  title: { color: "#17223C", fontSize: 17, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "#748097", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  list: { zIndex: 1, marginTop: 16, gap: 8 },
  stop: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.93)", borderWidth: 1, borderColor: "#E7E9F3" },
  stopMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  stopActive: { borderColor: "#7257EC", backgroundColor: "#F6F3FF" },
  marker: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#7257EC" },
  markerText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0 },
  stopTitle: { color: "#17223C", fontSize: 12, fontWeight: "900" },
  stopPlace: { marginTop: 3, color: "#78849A", fontSize: 10, fontWeight: "600" },
  navigate: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, backgroundColor: "#17223C" },
  navigateText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyTitle: { color: "#17223C", fontSize: 15, fontWeight: "900" },
  emptyText: { marginTop: 6, color: "#78849A", fontSize: 10, fontWeight: "600" },
});
