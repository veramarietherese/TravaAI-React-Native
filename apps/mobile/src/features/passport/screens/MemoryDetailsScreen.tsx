import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { deletePassportMemory, fetchPassportMemory, setMemoryFavorite, type PassportMemory } from "../api/passport.api";

export function MemoryDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ memoryId?: string }>();
  const memoryId = typeof params.memoryId === "string" ? params.memoryId : "";
  const [memory, setMemory] = useState<PassportMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!memoryId) { setError("Memory not found."); setLoading(false); return; }
      try {
        const result = await fetchPassportMemory(memoryId);
        if (live) setMemory(result);
      } catch (loadError) {
        if (live) setError(loadError instanceof Error ? loadError.message : "Memory could not load.");
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [memoryId]);

  async function favorite() {
    if (!memory) return;
    const next = !memory.isFavorite;
    setMemory({ ...memory, isFavorite: next });
    try { await setMemoryFavorite(memory.id, next); }
    catch (updateError) { setMemory({ ...memory, isFavorite: !next }); Alert.alert("Could not update favorite", updateError instanceof Error ? updateError.message : "Please try again."); }
  }

  function remove() {
    if (!memory) return;
    Alert.alert("Remove memory?", "This removes the photo from its trip passport album.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void (async () => {
        try { await deletePassportMemory(memory); router.back(); }
        catch (deleteError) { Alert.alert("Could not remove memory", deleteError instanceof Error ? deleteError.message : "Please try again."); }
      })() },
    ]);
  }

  return <SafeAreaView style={styles.safe} edges={["top"]}><StatusBar style="dark" /><LinearGradient colors={["#FFF8FC", "#F6FAFF"]} style={StyleSheet.absoluteFillObject} />
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.circle}><Ionicons name="arrow-back" size={20} color="#263149" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>MEMORY PASSPORT</Text><Text style={styles.title}>Memory details</Text></View>{memory ? <Pressable onPress={() => void favorite()} style={styles.circle}><Ionicons name={memory.isFavorite ? "heart" : "heart-outline"} size={20} color={memory.isFavorite ? "#EE6892" : "#7660CE"} /></Pressable> : <View style={styles.circle} />}</View>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#846BDC" /><Text style={styles.loadingText}>Loading memory…</Text></View> : error ? <View style={styles.loading}><Ionicons name="alert-circle-outline" size={30} color="#B36C63" /><Text style={styles.error}>{error}</Text></View> : memory ? <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.max}><View style={styles.hero}>{memory.imageUrl ? <Image source={{ uri: memory.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={styles.fallback}><Ionicons name="image-outline" size={42} color="#8A74D8" /></View>}</View><View style={styles.card}><Text style={styles.caption}>{memory.caption || "Travel memory"}</Text><Info icon="location-outline" label="Location" value={memory.locationName || "Location not added"} /><Info icon="calendar-outline" label="Date" value={memory.takenAt ? new Date(memory.takenAt).toLocaleString() : new Date(memory.createdAt).toLocaleString()} /><Info icon="person-outline" label="Added by" value={memory.uploaderName || "Traveler"} /><Pressable onPress={remove} style={styles.delete}><Ionicons name="trash-outline" size={17} color="#B8656D" /><Text style={styles.deleteText}>Remove this memory</Text></Pressable></View></View></ScrollView> : null}
  </SafeAreaView>;
}

function Info({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) { return <View style={styles.info}><View style={styles.infoIcon}><Ionicons name={icon} size={17} color="#7864CC" /></View><View><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>; }

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:"#FBFAFF"},header:{minHeight:64,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:16},circle:{width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.94)",borderWidth:1,borderColor:"#E7E8EF"},headerCopy:{flex:1,minWidth:0},eyebrow:{color:"#D1779E",fontSize:7.6,fontWeight:"900",letterSpacing:.7},title:{marginTop:2,color:"#202A43",fontSize:17,fontWeight:"900"},loading:{flex:1,alignItems:"center",justifyContent:"center",gap:9,padding:24},loadingText:{color:"#7C8698",fontSize:9,fontWeight:"700"},error:{maxWidth:380,color:"#8D645D",fontSize:9.5,lineHeight:14,textAlign:"center",fontWeight:"600"},content:{paddingHorizontal:18,paddingBottom:70},max:{width:"100%",maxWidth:780,alignSelf:"center"},hero:{width:"100%",aspectRatio:1.28,overflow:"hidden",borderRadius:26,backgroundColor:"#EAEFF6",boxShadow:"0 14px 32px rgba(55,62,83,.10)"},fallback:{flex:1,alignItems:"center",justifyContent:"center"},card:{marginTop:14,padding:18,borderRadius:24,backgroundColor:"rgba(255,255,255,.92)",borderWidth:1,borderColor:"#E9E7EF"},caption:{color:"#263048",fontSize:17,lineHeight:23,fontWeight:"900"},info:{marginTop:15,flexDirection:"row",alignItems:"center",gap:10},infoIcon:{width:36,height:36,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#F2EEFF"},infoLabel:{color:"#939BAD",fontSize:7.2,fontWeight:"900",letterSpacing:.5},infoValue:{marginTop:2,color:"#4F596E",fontSize:9.5,fontWeight:"700"},delete:{marginTop:20,minHeight:43,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,borderRadius:15,backgroundColor:"#FFF2F4"},deleteText:{color:"#B8656D",fontSize:8.6,fontWeight:"900"}});
