import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listTrips } from "@/features/trips/api/trips.api";

export function PassportMemoriesScreen() {
  const router = useRouter();
  const trips = useQuery({ queryKey: ["trips"], queryFn: listTrips, staleTime: 60_000 });
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <Text style={styles.title}>Passport Memories</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {trips.isLoading ? <ActivityIndicator color="#7358EE" style={{ marginTop: 50 }} /> : null}
        {(trips.data ?? []).map((trip, index) => (
          <LinearGradient key={trip.id} colors={index % 2 ? ["#F4F1FF", "#FFF2F7"] : ["#EDF5FF", "#F6F1FF"]} style={styles.memory}>
            <Text style={styles.stamp}>TRAVA ✈</Text>
            <Text style={styles.trip}>{trip.name}</Text>
            <Text style={styles.destination}>{trip.destination}</Text>
            <View style={styles.rule} />
            <Text style={styles.date}>{trip.startDate || "Date not set"} · {trip.numberOfDays} days · {trip.status}</Text>
          </LinearGradient>
        ))}
        {!trips.isLoading && !trips.data?.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Your passport is ready</Text><Text style={styles.emptyText}>Completed and upcoming trips will become travel memories here.</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FAFAFD"},header:{height:62,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:"#ECEEF4",backgroundColor:"#FFFFFF"},back:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F7FA"},backText:{marginTop:-3,color:"#1D273D",fontSize:28},title:{color:"#1D273D",fontSize:15,fontWeight:"900"},
  content:{padding:16,paddingBottom:80,gap:10},memory:{minHeight:150,padding:17,borderRadius:22,borderWidth:1,borderColor:"rgba(255,255,255,.95)"},stamp:{alignSelf:"flex-start",paddingHorizontal:8,paddingVertical:4,borderRadius:8,overflow:"hidden",color:"#7257EC",backgroundColor:"rgba(255,255,255,.7)",fontSize:7,fontWeight:"900"},trip:{marginTop:14,color:"#17213A",fontSize:21,fontWeight:"900"},destination:{marginTop:3,color:"#69758B",fontSize:9,fontWeight:"700"},rule:{marginVertical:12,borderTopWidth:1,borderStyle:"dashed",borderColor:"#C9C4E5"},date:{color:"#7F899D",fontSize:7,fontWeight:"800"},empty:{marginTop:60,alignItems:"center",padding:30},emptyTitle:{color:"#1D273D",fontSize:15,fontWeight:"900"},emptyText:{marginTop:5,maxWidth:300,textAlign:"center",color:"#8D95A5",fontSize:9,lineHeight:15,fontWeight:"600"}
});
