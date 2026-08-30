import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DiscoverPlace } from "./DiscoverMap.types";
import { categoryIcon, formatDistance } from "../data/explore-categories";

export function ExplorePlaceCard({ place, width=218, saved, onSelect, onSave, onRoute, onAdd }: { place:DiscoverPlace;width?:number;saved:boolean;onSelect():void;onSave():void;onRoute():void;onAdd():void }) {
  const image=place.image?.verifiedEntityMatch ? place.image.thumbnailUrl||place.image.url : null;
  return <View style={[styles.card,{width}]}>
    <Pressable onPress={onSelect} style={styles.media}>{image?<Image source={{uri:image}} contentFit="cover" transition={180} style={StyleSheet.absoluteFill}/>:<LinearGradient colors={["#F2EEFF","#EDF5FF"]} style={styles.fallback}><Ionicons name={categoryIcon(place.category)} size={28} color="#846EE0"/><Text numberOfLines={1} style={styles.fallbackName}>{place.name}</Text><Text style={styles.fallbackSub}>No verified place photo</Text></LinearGradient>}</Pressable>
    <Pressable accessibilityLabel={saved?"Remove saved place":"Save place"} onPress={onSave} style={styles.save}><Ionicons name={saved?"heart":"heart-outline"} size={17} color={saved?"#E85F8F":"#4B566A"}/></Pressable>
    <Pressable onPress={onSelect} style={styles.copy}><Text numberOfLines={1} style={styles.name}>{place.name}</Text><Text numberOfLines={1} style={styles.subtitle}>{place.address||place.subtitle}</Text><View style={styles.metaRow}>{formatDistance(place.distanceMeters)?<View style={styles.meta}><Ionicons name="navigate-outline" size={12} color="#8993A6"/><Text style={styles.metaText}>{formatDistance(place.distanceMeters)}</Text></View>:null}<View style={styles.meta}><Ionicons name={categoryIcon(place.category)} size={12} color="#8993A6"/><Text style={styles.metaText}>{place.category}</Text></View></View></Pressable>
    <View style={styles.actions}><Pressable onPress={onRoute} style={styles.secondary}><Ionicons name="navigate-outline" size={13} color="#7057D2"/><Text style={styles.secondaryText}>Route</Text></Pressable><Pressable onPress={onAdd} style={styles.primary}><Ionicons name="add" size={13} color="#7057D2"/><Text style={styles.primaryText}>Itinerary</Text></Pressable></View>
  </View>;
}

const styles=StyleSheet.create({card:{overflow:"hidden",borderRadius:20,backgroundColor:"#fff",borderWidth:1,borderColor:"#E6E8EE",boxShadow:"0 10px 26px rgba(45,52,74,.08)"},media:{height:126,backgroundColor:"#F1F3F8"},fallback:{flex:1,alignItems:"center",justifyContent:"center",padding:14},fallbackName:{marginTop:7,maxWidth:"90%",color:"#5A4E83",fontSize:10,fontWeight:"900"},fallbackSub:{marginTop:2,color:"#9188A8",fontSize:7.5,fontWeight:"700"},save:{position:"absolute",right:9,top:9,width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.94)"},copy:{paddingHorizontal:12,paddingTop:11},name:{color:"#222C46",fontSize:11,fontWeight:"900"},subtitle:{marginTop:3,color:"#858FA2",fontSize:8.2,fontWeight:"600"},metaRow:{marginTop:8,gap:5},meta:{flexDirection:"row",alignItems:"center",gap:4},metaText:{color:"#7F899C",fontSize:8,fontWeight:"700"},actions:{flexDirection:"row",gap:7,padding:10},secondary:{flex:1,minHeight:34,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4,borderRadius:13,backgroundColor:"#F7F4FF"},secondaryText:{color:"#7057D2",fontSize:8.2,fontWeight:"900"},primary:{flex:1.15,minHeight:34,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4,borderRadius:13,backgroundColor:"#EFE9FF"},primaryText:{color:"#7057D2",fontSize:8.2,fontWeight:"900"}});
