import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { createTrip } from "../api/trips.api";
import { TripForm, type PickedCover, type TripFormValue } from "../components/TripForm";
import { removeTripImage, uploadTripImage } from "../utils/media-upload";

export function CreateTripScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async ({ value, cover }: { value: TripFormValue; cover: PickedCover | null }) => {
      if (!user?.id) throw new Error("Your session has expired. Please sign in again.");
      let uploadedPath: string | null = null;
      try {
        if (cover) {
          const draftMediaId = `draft-${Date.now()}`;
          uploadedPath = await uploadTripImage({ userId: user.id, tripId: draftMediaId, kind: "cover", asset: cover.asset });
        }
        return await createTrip({
          name: value.name,
          destination: value.destination,
          description: value.description || null,
          startDate: value.startDate || null,
          endDate: value.endDate || null,
          totalBudget: Number(value.totalBudget || 0),
          currencyCode: value.currencyCode || "PHP",
          travelStyle: value.travelStyle || null,
          travelGroup: value.travelGroup || null,
          coverStoragePath: uploadedPath,
          status: value.startDate ? "upcoming" : "draft",
          flightNumber: value.flightNumber || null,
          flightDate: value.flightDate || null,
        });
      } catch (error) {
        if (uploadedPath) await removeTripImage(uploadedPath).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: async (trip) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
      router.replace(`/trip/${trip.id}` as Href);
    },
    onError: (error) => Alert.alert("Create trip", error instanceof Error ? error.message : "Unable to create this trip."),
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.eyebrow}>NEW TRAVEL WORKSPACE</Text><Text style={styles.title}>Create a trip</Text><Text style={styles.subtitle}>Start simple. You can add itinerary, travelers, expenses, and local documents after saving.</Text></View>
      <TripForm submitting={mutation.isPending} submitLabel="Create trip" onCancel={() => router.back()} onSubmit={(value, cover) => mutation.mutate({ value, cover })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4, maxWidth: 680, width: "100%", alignSelf: "center" },
  eyebrow: { color: "#7055EC", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 4, color: "#15213A", fontSize: 29, lineHeight: 34, fontWeight: "900" },
  subtitle: { marginTop: 5, color: "#7B869B", fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
