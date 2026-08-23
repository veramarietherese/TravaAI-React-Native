import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { createTrip } from "../api/trips.api";
import { TripForm, type PickedCover, type TripFormValue } from "../components/TripForm";
import { removeTripImage, uploadTripImage } from "../utils/media-upload";

export function CreateTripScreen() {
  const router = useRouter(); const queryClient = useQueryClient(); const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async ({ value, cover }: { value: TripFormValue; cover: PickedCover | null }) => {
      if (!user?.id) throw new Error("Your session has expired. Please sign in again.");
      let uploadedPath: string | null = null;
      try {
        if (cover) uploadedPath = await uploadTripImage({ userId: user.id, tripId: `draft-${Date.now()}`, kind: "cover", asset: cover.asset });
        return await createTrip({ name: value.name, destination: value.destination, description: value.description || null, startDate: value.startDate || null, endDate: value.endDate || null, totalBudget: Number(value.totalBudget || 0), currencyCode: value.currencyCode || "PHP", travelStyle: value.travelStyle || null, travelGroup: value.travelGroup || null, coverStoragePath: uploadedPath, status: value.startDate ? "upcoming" : "draft", flightNumber: value.flightNumber || null, flightDate: value.flightDate || null });
      } catch (error) { if (uploadedPath) await removeTripImage(uploadedPath).catch(() => undefined); throw error; }
    },
    onSuccess: async (trip) => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["trips"] }), queryClient.invalidateQueries({ queryKey: ["home-dashboard"] })]); router.replace(`/trip/${trip.id}` as Href); },
    onError: (error) => Alert.alert("Create trip", error instanceof Error ? error.message : "Unable to create this trip."),
  });
  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><View style={s.top}><Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color="#17223C"/></Pressable><Text style={s.title}>Create a trip</Text><View style={s.spacer}/></View><TripForm submitting={mutation.isPending} submitLabel="Create trip" onCancel={() => router.back()} onSubmit={(value, cover) => mutation.mutate({ value, cover })}/></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#FFF"},top:{height:62,maxWidth:620,width:"100%",alignSelf:"center",paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F9FC",borderWidth:1,borderColor:"#E9EDF3"},title:{color:"#101A35",fontSize:20,fontWeight:"900"},spacer:{width:42}});
