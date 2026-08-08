import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";

import { listActivities } from "@/features/itinerary/api/itinerary.api";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { TripMapSurface } from "../components/TripMapSurface";

export function TripMapScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const activitiesQuery = useQuery({ queryKey: ["trip-activities", tripId], queryFn: () => listActivities(tripId), enabled: Boolean(tripId) });
  const trip = tripQuery.data;
  const activities = activitiesQuery.data ?? [];
  if (!trip) return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" size="large" /> : <Text>Trip unavailable.</Text>}</SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}><StatusBar style="dark" /><TripWorkspaceHeader tripId={tripId} title={trip.name} subtitle="Full itinerary map" /><ScrollView contentContainerStyle={styles.content}><View style={styles.maxWidth}><Text style={styles.heading}>Every stop, one route</Text><Text style={styles.subtitle}>Drag, zoom, enable your location, or tap a marker callout to open external navigation.</Text><TripMapSurface activities={activities} selectedActivityId={selected} onSelectActivity={setSelected} height={520} /><View style={styles.stops}>{activities.filter((item) => item.latitude !== null && item.longitude !== null).map((item, index) => <Pressable key={item.id} onPress={() => setSelected(item.id)} style={[styles.stop, selected === item.id && styles.stopActive]}><View style={styles.index}><Text style={styles.indexText}>{index + 1}</Text></View><View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.place}>{item.locationName} · Day {item.dayNumber} at {item.startTime}</Text></View></Pressable>)}</View>{activitiesQuery.isLoading ? <ActivityIndicator color="#7257EC" style={{ marginTop: 24 }} /> : null}</View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F8F9FF" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 60 }, maxWidth: { width: "100%", maxWidth: 920, alignSelf: "center" }, heading: { color: "#17223C", fontSize: 27, fontWeight: "900" }, subtitle: { marginTop: 5, marginBottom: 16, color: "#7B869A", fontSize: 11, lineHeight: 17, fontWeight: "600" }, stops: { marginTop: 14, gap: 8 }, stop: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8EAF2" }, stopActive: { borderColor: "#7257EC", backgroundColor: "#F8F5FF" }, index: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#7257EC" }, indexText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" }, copy: { flex: 1 }, title: { color: "#17223C", fontSize: 11, fontWeight: "900" }, place: { marginTop: 3, color: "#7B869A", fontSize: 9, fontWeight: "600" } });
