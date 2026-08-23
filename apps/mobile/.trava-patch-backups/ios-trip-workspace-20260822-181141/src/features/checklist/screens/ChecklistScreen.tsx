import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LocalChecklistItem } from "@trava/shared";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { addChecklistItem, deleteChecklistItem, loadChecklist, renameChecklistItem, toggleChecklistItem } from "../utils/checklist-storage";

const CATEGORIES: LocalChecklistItem["category"][] = ["packing", "booking", "documents", "health", "other"];

export function ChecklistScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LocalChecklistItem["category"]>("packing");

  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId), staleTime: 30_000 });
  const checklistQuery = useQuery({ queryKey: ["local-checklist", tripId, userId], queryFn: () => loadChecklist(tripId, userId), enabled: Boolean(tripId && userId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["local-checklist", tripId, userId] });
  const add = useMutation({ mutationFn: () => addChecklistItem(tripId, userId, title.trim(), category), onSuccess: async () => { setTitle(""); await refresh(); }, onError: (error) => Alert.alert("Checklist", message(error)) });
  const toggle = useMutation({ mutationFn: (id: string) => toggleChecklistItem(tripId, userId, id), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => deleteChecklistItem(tripId, userId, id), onSuccess: refresh });
  const rename = useMutation({ mutationFn: ({ id, next }: { id: string; next: string }) => renameChecklistItem(tripId, userId, id, next), onSuccess: refresh });

  const trip = tripQuery.data;
  if (!trip) return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" /> : <Text>{message(tripQuery.error)}</Text>}</SafeAreaView>;
  const items = checklistQuery.data ?? [];
  const done = items.filter((item) => item.completed).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  function edit(item: LocalChecklistItem) {
    if (typeof Alert.prompt === "function") {
      Alert.prompt("Edit checklist item", undefined, (next) => { if (next?.trim().length >= 2) rename.mutate({ id: item.id, next: next.trim() }); }, "plain-text", item.title);
      return;
    }
    Alert.alert("Edit checklist item", "Editing text is available from iOS prompt. Delete and re-add the item on this platform if you need to rename it.");
  }

  return <SafeAreaView style={styles.safe} edges={["top"]}><StatusBar style="dark"/><TripWorkspaceHeader tripId={tripId} title={trip.name}/><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.maxWidth}>
    <LinearGradient colors={["#FFF1F5", "#F5F1FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
      <View style={styles.bag}><View style={styles.handle}/><Text style={styles.bagFace}>•‿•</Text></View>
      <View style={styles.heroCopy}><Text style={styles.eyebrow}>GREAT PROGRESS!</Text><Text style={styles.heroTitle}>{percent >= 100 ? "You're trip-ready" : percent >= 50 ? "You're halfway ready" : "You're getting ready"}</Text><Text style={styles.heroText}>{done} of {items.length} tasks are complete. Keep going—you’ve already handled the hard part.</Text><View style={styles.privatePill}><Text style={styles.privateText}>⌁ Private on this device</Text></View></View>
      <View style={styles.ring}><Text style={styles.ringValue}>{percent}%</Text></View>
    </LinearGradient>
    <View style={styles.progress}><LinearGradient colors={["#FF6E8E", "#7B5EF0"]} start={{x:0,y:0}} end={{x:1,y:0}} style={[styles.progressFill,{width:`${percent}%`}]} /></View>

    <View style={styles.addRow}><TextInput value={title} onChangeText={setTitle} onSubmitEditing={() => title.trim().length >= 2 && add.mutate()} placeholder="Add a checklist item" placeholderTextColor="#9AA1AE" style={styles.input}/><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryTrack}>{CATEGORIES.map((item)=><Pressable key={item} onPress={()=>setCategory(item)} style={[styles.category,category===item&&styles.categoryActive]}><Text style={[styles.categoryText,category===item&&styles.categoryTextActive]}>{item}</Text></Pressable>)}</ScrollView><Pressable disabled={title.trim().length<2||add.isPending} onPress={()=>add.mutate()} style={[styles.addButton,(title.trim().length<2||add.isPending)&&styles.disabled]}>{add.isPending?<ActivityIndicator size="small" color="#FFF"/>:<Text style={styles.addText}>＋ Add</Text>}</Pressable></View>

    {checklistQuery.isLoading ? <ActivityIndicator color="#7257EC" style={{marginTop:30}}/> : null}
    <View style={styles.list}>{items.map((item)=><View key={item.id} style={styles.item}><Pressable onPress={()=>toggle.mutate(item.id)} style={[styles.check,item.completed&&styles.checkDone]}><Text style={styles.checkText}>{item.completed?"✓":""}</Text></Pressable><Pressable onPress={()=>edit(item)} style={styles.itemCopy}><Text numberOfLines={1} style={[styles.itemTitle,item.completed&&styles.itemTitleDone]}>{item.title}</Text><Text style={styles.itemMeta}>{label(item.category)}</Text></Pressable><Pressable onPress={()=>edit(item)} style={styles.iconButton}><Text style={styles.edit}>⌕</Text></Pressable><Pressable onPress={()=>Alert.alert("Delete item?",item.title,[{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:()=>remove.mutate(item.id)}])} style={styles.iconButton}><Text style={styles.delete}>♲</Text></Pressable></View>)}</View>
    {!checklistQuery.isLoading&&!items.length?<View style={styles.empty}><Text style={styles.emptyIcon}>✓</Text><Text style={styles.emptyTitle}>Your checklist is ready for the first task</Text><Text style={styles.emptyText}>Add packing, booking, health, or document reminders above.</Text></View>:null}
  </View></ScrollView></SafeAreaView>;
}

function label(category: LocalChecklistItem["category"]) { return category.slice(0,1).toUpperCase()+category.slice(1); }
function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#FAFAFD"},center:{flex:1,alignItems:"center",justifyContent:"center"},content:{padding:14,paddingBottom:110},maxWidth:{width:"100%",maxWidth:760,alignSelf:"center"},hero:{minHeight:116,flexDirection:"row",alignItems:"center",gap:12,padding:14,borderRadius:21,borderWidth:1,borderColor:"rgba(255,255,255,.96)"},bag:{width:72,height:83,borderRadius:23,alignItems:"center",justifyContent:"center",backgroundColor:"#FF7D91"},handle:{position:"absolute",top:-6,width:33,height:18,borderRadius:12,borderWidth:5,borderColor:"#EA6479",borderBottomWidth:0},bagFace:{color:"#FFF",fontSize:16,fontWeight:"900"},heroCopy:{flex:1,minWidth:0},eyebrow:{color:"#D75D73",fontSize:6,letterSpacing:.9,fontWeight:"900"},heroTitle:{marginTop:3,color:"#22283C",fontSize:14,fontWeight:"900"},heroText:{marginTop:4,maxWidth:470,color:"#7C8191",fontSize:7,lineHeight:11,fontWeight:"700"},privatePill:{marginTop:7,alignSelf:"flex-start",paddingHorizontal:8,paddingVertical:5,borderRadius:10,backgroundColor:"#2D2D37"},privateText:{color:"#FFF",fontSize:5.5,fontWeight:"800"},ring:{width:60,height:60,borderRadius:30,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.82)",borderWidth:7,borderColor:"#FFB5C3"},ringValue:{color:"#252B3E",fontSize:10,fontWeight:"900"},progress:{height:6,marginTop:9,overflow:"hidden",borderRadius:4,backgroundColor:"#E9E6F0"},progressFill:{height:"100%",borderRadius:4},addRow:{marginTop:13,minHeight:48,flexDirection:"row",alignItems:"center",gap:6},input:{flex:1,minWidth:120,height:46,paddingHorizontal:12,borderRadius:13,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E4E6ED",color:"#273147",fontSize:9,fontWeight:"700"},categoryScroll:{maxWidth:170},categoryTrack:{alignItems:"center",gap:4},category:{paddingHorizontal:9,paddingVertical:8,borderRadius:11,backgroundColor:"#F2F3F7"},categoryActive:{backgroundColor:"#EEE9FF"},categoryText:{color:"#80899A",fontSize:6.5,fontWeight:"800",textTransform:"capitalize"},categoryTextActive:{color:"#6E57DF"},addButton:{height:46,minWidth:64,alignItems:"center",justifyContent:"center",paddingHorizontal:10,borderRadius:12,backgroundColor:"#745DEB"},disabled:{opacity:.48},addText:{color:"#FFF",fontSize:8,fontWeight:"900"},list:{marginTop:6,gap:7},item:{minHeight:50,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:10,paddingVertical:8,borderRadius:14,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E7E9EF"},check:{width:21,height:21,borderRadius:11,alignItems:"center",justifyContent:"center",borderWidth:1.5,borderColor:"#C7CDD8"},checkDone:{borderColor:"#64CDA4",backgroundColor:"#E7FAF2"},checkText:{color:"#48AF87",fontSize:10,fontWeight:"900"},itemCopy:{flex:1,minWidth:0},itemTitle:{color:"#2B3348",fontSize:8.5,fontWeight:"900"},itemTitleDone:{color:"#969DAC",textDecorationLine:"line-through"},itemMeta:{marginTop:2,color:"#A0A5B2",fontSize:5.5,fontWeight:"700"},iconButton:{width:27,height:27,borderRadius:9,alignItems:"center",justifyContent:"center",backgroundColor:"#F4F5F8"},edit:{color:"#8790A2",fontSize:10},delete:{color:"#9BA2AF",fontSize:11},empty:{marginTop:24,alignItems:"center",padding:30,borderRadius:21,backgroundColor:"#FFF"},emptyIcon:{color:"#7257EC",fontSize:26,fontWeight:"900"},emptyTitle:{marginTop:6,color:"#273047",fontSize:12,fontWeight:"900"},emptyText:{marginTop:4,maxWidth:280,textAlign:"center",color:"#8992A2",fontSize:8,lineHeight:13,fontWeight:"600"}});
