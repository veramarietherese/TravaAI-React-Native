import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { searchWorldPlaces, type WorldPlaceResult } from "@/features/maps/utils/world-place-search";
import type { ExplorationContext } from "../utils/discover-storage";
import type { DeviceLocationStatus } from "../hooks/useExploreContext";

export function ExploreLocationSheet({ visible, current, recent, locationStatus, onClose, onSelect, onUseCurrent }: {
  visible: boolean;
  current: ExplorationContext;
  recent: ExplorationContext[];
  locationStatus: DeviceLocationStatus;
  onClose(): void;
  onSelect(context: ExplorationContext): void;
  onUseCurrent(): void;
}) {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<WorldPlaceResult[]>([]);
  const [loading,setLoading]=useState(false);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{ if(!visible){setQuery("");setResults([]);} },[visible]);
  useEffect(()=>{
    request.current?.abort();
    if(query.trim().length<2){setResults([]);setLoading(false);return;}
    const controller=new AbortController(); request.current=controller;
    const timer=setTimeout(()=>{setLoading(true);void searchWorldPlaces(query,null,10,controller.signal).then(setResults).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},220);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query]);

  const choose=(item:WorldPlaceResult)=>{onSelect({label:[item.name,item.city,item.country].filter(Boolean).filter(unique).join(", "),latitude:item.latitude,longitude:item.longitude,city:item.city??null,country:item.country??null,source:"manual"});onClose();};
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}>
    <View style={styles.head}><View><Text style={styles.eyebrow}>EXPLORATION AREA</Text><Text style={styles.title}>Where do you want to explore?</Text></View><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={20} color="#586278" /></Pressable></View>
    <View style={styles.search}><Ionicons name="search-outline" size={18} color="#7F899C"/><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search city or destination…" placeholderTextColor="#9BA3B2" style={styles.input}/>{loading?<ActivityIndicator size="small" color="#8064E5"/>:query?<Pressable onPress={()=>setQuery("")}><Ionicons name="close-circle" size={18} color="#A6ADBA"/></Pressable>:null}</View>
    <Pressable onPress={onUseCurrent} style={styles.current}><View style={styles.currentIcon}><Ionicons name="navigate-outline" size={18} color="#765DDF"/></View><View style={{flex:1}}><Text style={styles.currentTitle}>Use current location</Text><Text style={styles.currentSub}>{locationStatus==="requesting"?"Requesting location…":"Optional · browser/device permission may be requested"}</Text></View><Ionicons name="chevron-forward" size={18} color="#A2AABB"/></Pressable>
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
      {query.trim().length>=2 ? <><Text style={styles.label}>SEARCH RESULTS</Text>{!loading&&!results.length?<Text style={styles.empty}>No matching destinations found.</Text>:results.map((item)=><Pressable key={item.id} onPress={()=>choose(item)} style={styles.row}><Ionicons name="location-outline" size={17} color="#7D67D8"/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.rowTitle}>{item.name}</Text><Text numberOfLines={1} style={styles.rowSub}>{item.displayName}</Text></View></Pressable>)}</> : <><Text style={styles.label}>CURRENT</Text><View style={styles.row}><Ionicons name="compass-outline" size={17} color="#7D67D8"/><View style={{flex:1}}><Text style={styles.rowTitle}>{current.label}</Text><Text style={styles.rowSub}>Current exploration context</Text></View></View>{recent.length?<><Text style={styles.label}>RECENT</Text>{recent.map((item)=><Pressable key={`${item.label}-${item.latitude}`} onPress={()=>{onSelect({...item,source:"manual"});onClose();}} style={styles.row}><Ionicons name="time-outline" size={17} color="#7F899C"/><View style={{flex:1}}><Text style={styles.rowTitle}>{item.label}</Text><Text style={styles.rowSub}>Explore again</Text></View></Pressable>)}</>:null}</>}
    </ScrollView>
  </View></View></Modal>;
}
function unique(value:unknown,index:number,values:unknown[]){return values.indexOf(value)===index;}
const styles=StyleSheet.create({backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(22,28,44,.28)",padding:12},sheet:{width:"100%",maxWidth:620,maxHeight:"78%",alignSelf:"center",padding:16,borderRadius:28,backgroundColor:"#fff",borderWidth:1,borderColor:"#E8E5F0"},head:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12},eyebrow:{color:"#8267E2",fontSize:8,fontWeight:"900",letterSpacing:.8},title:{marginTop:4,color:"#1C2540",fontSize:20,fontWeight:"900",letterSpacing:-.4},close:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F6F9"},search:{marginTop:15,minHeight:50,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:13,borderRadius:17,backgroundColor:"#FAFAFC",borderWidth:1,borderColor:"#E6E8EF"},input:{flex:1,color:"#273049",fontSize:11,fontWeight:"600"},current:{marginTop:10,minHeight:60,flexDirection:"row",alignItems:"center",gap:10,padding:10,borderRadius:17,backgroundColor:"#F6F3FF"},currentIcon:{width:40,height:40,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#ECE6FF"},currentTitle:{color:"#303A55",fontSize:10.5,fontWeight:"900"},currentSub:{marginTop:2,color:"#858EA1",fontSize:8.2,fontWeight:"600"},list:{marginTop:8},label:{marginTop:12,marginBottom:6,color:"#8A74DA",fontSize:7.5,fontWeight:"900",letterSpacing:.7},row:{minHeight:58,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:8,borderBottomWidth:1,borderBottomColor:"#F0F1F4"},rowTitle:{color:"#283149",fontSize:10.5,fontWeight:"900"},rowSub:{marginTop:2,color:"#8992A4",fontSize:8.2,fontWeight:"600"},empty:{paddingVertical:22,textAlign:"center",color:"#8992A4",fontSize:9.5,fontWeight:"600"}});
