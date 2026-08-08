import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { fetchTrip, updateTrip } from "../api/trips.api";
import { TripForm, type PickedCover, type TripFormValue } from "../components/TripForm";
import { removeTripImage, uploadTripImage } from "../utils/media-upload";

export function EditTripScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const mutation = useMutation({
    mutationFn: async ({ value, cover }: { value: TripFormValue; cover: PickedCover | null }) => {
      let coverStoragePath: string | undefined;
      if (cover && !user?.id) throw new Error("Your session has expired. Please sign in again.");
      if (cover && user) coverStoragePath = await uploadTripImage({ userId: user.id, tripId, kind: "cover", asset: cover.asset });
      try {
        return await updateTrip(tripId, {
        name: value.name,
        destination: value.destination,
        description: value.description || null,
        startDate: value.startDate || null,
        endDate: value.endDate || null,
        totalBudget: Number(value.totalBudget || 0),
        currencyCode: value.currencyCode || "PHP",
        travelStyle: value.travelStyle || null,
        travelGroup: value.travelGroup || null,
        status: value.status,
        flightNumber: value.flightNumber || null,
        flightDate: value.flightDate || null,
          ...(coverStoragePath ? { coverStoragePath } : {}),
        });
      } catch (error) {
        if (coverStoragePath) await removeTripImage(coverStoragePath).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
      router.back();
    },
    onError: (error) => Alert.alert("Edit trip", error instanceof Error ? error.message : "Unable to update this trip."),
  });

  if (!tripQuery.data) {
    return <SafeAreaView style={styles.center}><Text style={styles.loading}>{tripQuery.isError ? (tripQuery.error instanceof Error ? tripQuery.error.message : "Trip unavailable") : "Loading trip…"}</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.eyebrow}>TRIP SETTINGS</Text><Text style={styles.title}>Edit trip</Text><Text style={styles.subtitle}>Changes are shared with accepted trip members immediately.</Text></View>
      <TripForm initialTrip={tripQuery.data} submitting={mutation.isPending} submitLabel="Save changes" onCancel={() => router.back()} onSubmit={(value, cover) => mutation.mutate({ value, cover })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FF" },
  loading: { color: "#6E7890", fontSize: 12, fontWeight: "700" },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4, maxWidth: 680, width: "100%", alignSelf: "center" },
  eyebrow: { color: "#7055EC", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 4, color: "#15213A", fontSize: 29, lineHeight: 34, fontWeight: "900" },
  subtitle: { marginTop: 5, color: "#7B869B", fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
