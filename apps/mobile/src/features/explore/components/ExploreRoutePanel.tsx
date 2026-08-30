import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { fetchMapRoute } from "@/features/maps/utils/world-place-search";
import type { Coordinates, DiscoverPlace, MapRoute, TravelMode } from "./DiscoverMap.types";

const MODES: Array<{ id:TravelMode;label:string;icon:React.ComponentProps<typeof Ionicons>["name"] }> = [
  {id:"driving",label:"Drive",icon:"car-outline"},{id:"walking",label:"Walk",icon:"walk-outline"},{id:"cycling",label:"Cycle",icon:"bicycle-outline"},
];

export function ExploreRoutePanel({ origin, originLabel, destination, onRoute }: { origin:Coordinates;originLabel:string;destination:DiscoverPlace;onRoute(route:MapRoute|null):void }) {
  const [mode,setMode]=useState<TravelMode>("driving");
  const [route,setRoute]=useState<MapRoute|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(false);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{
    request.current?.abort(); const controller=new AbortController(); request.current=controller; setLoading(true);setError(false);setRoute(null);onRoute(null);
    void fetchMapRoute(origin,{latitude:destination.latitude,longitude:destination.longitude},mode,controller.signal).then((value)=>{if(!controller.signal.aborted){setRoute(value);onRoute(value);}}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[origin.latitude,origin.longitude,destination.id,mode,onRoute]);
  const arrival=useMemo(()=>route?new Date(Date.now()+route.durationSeconds*1000).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):null,[route]);
  const openMaps=async(kind:"apple"|"google")=>{
    const d=`${destination.latitude},${destination.longitude}`;
    const googleMode=mode==="walking"?"walking":mode==="cycling"?"bicycling":"driving";
    const url=kind==="apple"?`http://maps.apple.com/?daddr=${encodeURIComponent(d)}&q=${encodeURIComponent(destination.name)}&dirflg=${mode==="walking"?"w":"d"}`:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}&travelmode=${googleMode}`;
    await Linking.openURL(url);
  };
  return <View style={styles.panel}><Text style={styles.eyebrow}>DIRECTIONS</Text><Text style={styles.title}>How do you want to get there?</Text><Text numberOfLines={1} style={styles.origin}>From {originLabel}</Text>
    <View style={styles.modes}>{MODES.map((item)=><Pressable key={item.id} onPress={()=>setMode(item.id)} style={[styles.mode,item.id===mode&&styles.modeOn]}><Ionicons name={item.icon} size={18} color={item.id===mode?"#6E54D7":"#657086"}/><Text style={[styles.modeLabel,item.id===mode&&styles.modeLabelOn]}>{item.label}</Text></Pressable>)}</View>
    {loading?<View style={styles.status}><ActivityIndicator size="small" color="#765DDF"/><Text style={styles.statusText}>Calculating real route…</Text></View>:route?<View style={styles.summary}><View><Text style={styles.big}>{formatDuration(route.durationSeconds)}</Text><Text style={styles.small}>{formatDistance(route.distanceMeters)}</Text></View><View style={styles.divider}/><View><Text style={styles.big}>{arrival}</Text><Text style={styles.small}>if leaving now · no live traffic</Text></View></View>:error?<View style={styles.status}><Ionicons name="alert-circle-outline" size={17} color="#9A7181"/><Text style={styles.statusText}>Route preview is unavailable right now.</Text></View>:null}
    <View style={styles.external}>{Platform.OS==="ios"?<Pressable onPress={()=>void openMaps("apple")} style={styles.externalButton}><Ionicons name="map-outline" size={15} color="#7058D0"/><Text style={styles.externalText}>Apple Maps</Text></Pressable>:null}<Pressable onPress={()=>void openMaps("google")} style={styles.externalButton}><Ionicons name="navigate-outline" size={15} color="#7058D0"/><Text style={styles.externalText}>Google Maps</Text></Pressable></View>
  </View>;
}
function formatDuration(seconds:number){const minutes=Math.max(1,Math.round(seconds/60));return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} hr ${minutes%60?`${minutes%60} min`:""}`.trim();}
function formatDistance(meters:number){return meters<1000?`${Math.round(meters)} m route`:`${(meters/1000).toFixed(meters<10000?1:0)} km route`;}
const styles=StyleSheet.create({panel:{padding:15,borderRadius:22,backgroundColor:"rgba(255,255,255,.98)",borderWidth:1,borderColor:"#E8E5F0",boxShadow:"0 12px 28px rgba(47,54,76,.10)"},eyebrow:{color:"#8063E2",fontSize:7.5,fontWeight:"900",letterSpacing:.8},title:{marginTop:3,color:"#212A43",fontSize:14,fontWeight:"900"},origin:{marginTop:3,color:"#8A93A4",fontSize:8.5,fontWeight:"600"},modes:{marginTop:11,flexDirection:"row",gap:7},mode:{flex:1,minHeight:58,alignItems:"center",justifyContent:"center",gap:4,borderRadius:15,backgroundColor:"#F8F8FA",borderWidth:1,borderColor:"#E8E9ED"},modeOn:{backgroundColor:"#F2EEFF",borderColor:"#CFC2FA"},modeLabel:{color:"#657086",fontSize:8.5,fontWeight:"900"},modeLabelOn:{color:"#6E54D7"},status:{minHeight:54,flexDirection:"row",alignItems:"center",gap:8},statusText:{flex:1,color:"#7D8698",fontSize:9,fontWeight:"700"},summary:{minHeight:64,flexDirection:"row",alignItems:"center",justifyContent:"space-around",marginTop:7,paddingHorizontal:8,borderRadius:16,backgroundColor:"#FAF9FD"},big:{color:"#29324A",fontSize:13,fontWeight:"900"},small:{marginTop:2,color:"#929AAB",fontSize:7.8,fontWeight:"700"},divider:{width:1,height:30,backgroundColor:"#E5E5EA"},external:{marginTop:9,flexDirection:"row",gap:7},externalButton:{flex:1,minHeight:36,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderRadius:13,backgroundColor:"#F3EFFF"},externalText:{color:"#7058D0",fontSize:8.5,fontWeight:"900"}});
