import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripStatus, TripSummary } from "@trava/shared";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { listTripInvitations, listTrips, respondToTripInvitation } from "../api/trips.api";
import { TripCard } from "../components/TripCard";

const FILTERS: Array<{ key: "all" | TripStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ongoing", label: "Ongoing" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Drafts" },
];

export function TripsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const [search, setSearch] = useState("");

  const tripsQuery = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  const invitationsQuery = useQuery({ queryKey: ["trip-invitations"], queryFn: listTripInvitations });
  const invitationMutation = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: "accept" | "reject" }) => respondToTripInvitation(membershipId, action),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["trip-invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
    },
    onError: (error) => Alert.alert("Invitation", error instanceof Error ? error.message : "Unable to update the invitation."),
  });

  const trips = tripsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((trip) => {
      if (filter !== "all" && trip.status !== filter) return false;
      if (!q) return true;
      return [trip.name, trip.destination, trip.travelStyle, trip.travelGroup]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [filter, search, trips]);

  const grouped = useMemo(() => {
    const sections: Array<{ title: string; status: TripStatus; trips: TripSummary[] }> = [];
    for (const status of ["ongoing", "upcoming", "draft", "completed"] as TripStatus[]) {
      const items = filtered.filter((trip) => trip.status === status);
      if (items.length) sections.push({ title: status === "draft" ? "Draft trips" : `${status[0]?.toUpperCase()}${status.slice(1)} trips`, status, trips: items });
    }
    return sections;
  }, [filtered]);

  const refresh = async () => {
    await Promise.all([tripsQuery.refetch(), invitationsQuery.refetch()]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={tripsQuery.isRefetching || invitationsQuery.isRefetching} onRefresh={() => void refresh()} tintColor="#7055EC" />}
        contentContainerStyle={[styles.content, { paddingHorizontal: width < 390 ? 14 : 18 }]}
      >
        <View style={styles.maxWidth}>
          <View style={styles.header}>
            <View>
              <Text style={styles.hello}>YOUR TRAVEL WORKSPACE</Text>
              <Text style={styles.title}>My Trips</Text>
              <Text style={styles.subtitle}>Plan, collaborate, track spending, and keep every detail in one place.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/trip/create" as Href)} style={({ pressed }) => [styles.newTripButton, pressed && styles.pressed]}>
              <Text style={styles.newTripPlus}>＋</Text>
              <Text style={styles.newTripText}>New Trip</Text>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search trips or destinations" placeholderTextColor="#9AA3B5" style={styles.searchInput} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((item) => (
              <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && styles.filterActive]}>
                <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {(invitationsQuery.data?.length ?? 0) > 0 ? (
            <View style={styles.invitationSection}>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Trip invitations</Text><Text style={styles.sectionCount}>{invitationsQuery.data?.length}</Text></View>
              {invitationsQuery.data?.map((invitation) => (
                <View key={invitation.membershipId} style={styles.invitationCard}>
                  <View style={styles.invitationIcon}><Text style={styles.invitationGlyph}>✦</Text></View>
                  <View style={styles.invitationCopy}>
                    <Text style={styles.invitationTitle}>{invitation.tripName}</Text>
                    <Text style={styles.invitationMeta}>{invitation.destination} · invited by {invitation.invitedByName}</Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <Pressable disabled={invitationMutation.isPending} onPress={() => invitationMutation.mutate({ membershipId: invitation.membershipId, action: "accept" })} style={styles.acceptButton}><Text style={styles.acceptText}>Accept</Text></Pressable>
                    <Pressable disabled={invitationMutation.isPending} onPress={() => invitationMutation.mutate({ membershipId: invitation.membershipId, action: "reject" })} style={styles.rejectButton}><Text style={styles.rejectText}>Decline</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {tripsQuery.isLoading ? (
            <View style={styles.state}><ActivityIndicator color="#7055EC" size="large" /><Text style={styles.stateTitle}>Loading your trips</Text></View>
          ) : tripsQuery.isError ? (
            <View style={styles.state}><Text style={styles.stateIcon}>!</Text><Text style={styles.stateTitle}>Trips could not load</Text><Text style={styles.stateCopy}>{tripsQuery.error instanceof Error ? tripsQuery.error.message : "Check your connection and try again."}</Text><Pressable onPress={() => void tripsQuery.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>
          ) : filtered.length === 0 ? (
            <View style={styles.state}><Text style={styles.stateIcon}>✈</Text><Text style={styles.stateTitle}>{trips.length ? "No trips match this view" : "Your next trip starts here"}</Text><Text style={styles.stateCopy}>{trips.length ? "Try a different filter or search." : "Create a trip to unlock itinerary, maps, budgets, expenses, invitations, and local documents."}</Text><Pressable onPress={() => router.push("/trip/create" as Href)} style={styles.retry}><Text style={styles.retryText}>Create a trip</Text></Pressable></View>
          ) : filter === "all" ? (
            grouped.map((section) => (
              <View key={section.status} style={styles.section}>
                <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionCount}>{section.trips.length}</Text></View>
                <View style={styles.tripList}>{section.trips.map((trip) => <TripCard key={trip.id} trip={trip} onPress={() => router.push(`/trip/${trip.id}` as Href)} />)}</View>
              </View>
            ))
          ) : (
            <View style={styles.section}><View style={styles.tripList}>{filtered.map((trip) => <TripCard key={trip.id} trip={trip} onPress={() => router.push(`/trip/${trip.id}` as Href)} />)}</View></View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  content: { paddingTop: 14, paddingBottom: 120 },
  maxWidth: { width: "100%", maxWidth: 780, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 },
  hello: { color: "#7055EC", fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 4, color: "#15213A", fontSize: 34, lineHeight: 39, fontWeight: "900" },
  subtitle: { marginTop: 5, maxWidth: 420, color: "#7B869B", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  newTripButton: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "#FF6385", boxShadow: "0px 5px 10px rgba(255,99,133,0.20)", elevation: 4 },
  pressed: { opacity: 0.75 },
  newTripPlus: { color: "#FFFFFF", fontSize: 20, lineHeight: 22 },
  newTripText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  searchBox: { marginTop: 19, height: 50, flexDirection: "row", alignItems: "center", borderRadius: 17, paddingHorizontal: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EBF2" },
  searchIcon: { color: "#8A95A9", fontSize: 20 },
  searchInput: { flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 10, color: "#1D2942", fontSize: 12, fontWeight: "700" },
  filters: { paddingTop: 13, paddingBottom: 5, gap: 7 },
  filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 13, backgroundColor: "#EFF1F6" },
  filterActive: { backgroundColor: "#7157EC" },
  filterText: { color: "#6C778D", fontSize: 10, fontWeight: "800" },
  filterTextActive: { color: "#FFFFFF" },
  invitationSection: { marginTop: 18 },
  invitationCard: { marginTop: 9, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 20, padding: 12, backgroundColor: "#FFF7FA", borderWidth: 1, borderColor: "#FFDDE7" },
  invitationIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFDCE6" },
  invitationGlyph: { color: "#E64B75", fontSize: 20 },
  invitationCopy: { flex: 1, minWidth: 0 },
  invitationTitle: { color: "#1C2841", fontSize: 12, fontWeight: "900" },
  invitationMeta: { marginTop: 3, color: "#7F899B", fontSize: 9, lineHeight: 13, fontWeight: "600" },
  invitationActions: { gap: 5 },
  acceptButton: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#6F55E8" },
  acceptText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  rejectButton: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#FFFFFF" },
  rejectText: { color: "#8A6170", fontSize: 9, fontWeight: "900" },
  section: { marginTop: 23 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: "#1A263E", fontSize: 17, fontWeight: "900" },
  sectionCount: { minWidth: 22, height: 22, borderRadius: 11, textAlign: "center", textAlignVertical: "center", color: "#7055EC", backgroundColor: "#ECE8FF", fontSize: 10, lineHeight: 22, fontWeight: "900" },
  tripList: { marginTop: 10, gap: 12 },
  state: { marginTop: 48, alignItems: "center", paddingHorizontal: 24, paddingVertical: 32, borderRadius: 25, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5" },
  stateIcon: { width: 52, height: 52, borderRadius: 26, textAlign: "center", textAlignVertical: "center", color: "#7055EC", backgroundColor: "#EEE9FF", fontSize: 25, lineHeight: 52, fontWeight: "900" },
  stateTitle: { marginTop: 12, color: "#1B2740", fontSize: 17, fontWeight: "900" },
  stateCopy: { marginTop: 6, maxWidth: 420, textAlign: "center", color: "#7C879B", fontSize: 11, lineHeight: 17, fontWeight: "600" },
  retry: { marginTop: 14, minHeight: 42, justifyContent: "center", paddingHorizontal: 18, borderRadius: 14, backgroundColor: "#7055EC" },
  retryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
