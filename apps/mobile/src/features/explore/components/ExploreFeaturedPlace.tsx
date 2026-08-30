import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import type { Coordinates, DiscoverPlace, MapRoute } from "./DiscoverMap.types";
import { DiscoverMap } from "./DiscoverMap";
import { ExploreRoutePanel } from "./ExploreRoutePanel";
import { categoryIcon, formatDistance } from "../data/explore-categories";

export function ExploreFeaturedPlace({ places, selected, center, userLocation, routeOrigin, routeOriginLabel, route, onRoute, onSelect, onDetails, onSave, saved, loading = false }: {
  places:DiscoverPlace[];selected:DiscoverPlace|null;center:Coordinates;userLocation?:Coordinates|null;routeOrigin:Coordinates;routeOriginLabel:string;route:MapRoute|null;onRoute(route:MapRoute|null):void;onSelect(id:string):void;onDetails():void;onSave():void;saved:boolean;loading?:boolean;
}) {
  const {width}=useWindowDimensions(); const wide=width>=880;
  return <View style={[styles.shell,wide&&styles.wide]}>
    <View style={[styles.info,wide&&styles.infoWide]}>{selected?<>
      <View style={styles.badge}><Ionicons name="compass-outline" size={12} color="#735BD8"/><Text style={styles.badgeText}>SELECTED PLACE</Text></View>
      <View style={styles.featureTop}>{selected.image?.verifiedEntityMatch?<Image source={{uri:selected.image.thumbnailUrl||selected.image.url}} contentFit="cover" style={styles.thumb}/>:<LinearGradient colors={["#F0ECFF","#EDF5FF"]} style={styles.thumbFallback}><Ionicons name={categoryIcon(selected.category)} size={24} color="#8069DD"/></LinearGradient>}<View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={styles.name}>{selected.name}</Text><Text numberOfLines={2} style={styles.address}>{selected.address||selected.subtitle}</Text></View><Pressable onPress={onSave} style={styles.save}><Ionicons name={saved?"heart":"heart-outline"} size={18} color={saved?"#E85F8F":"#586378"}/></Pressable></View>
      <View style={styles.tags}>{formatDistance(selected.distanceMeters)?<View style={styles.tag}><Ionicons name="navigate-outline" size={12} color="#7A8498"/><Text style={styles.tagText}>{formatDistance(selected.distanceMeters)}</Text></View>:null}<View style={styles.tag}><Ionicons name={categoryIcon(selected.category)} size={12} color="#7A8498"/><Text style={styles.tagText}>{selected.category}</Text></View></View>
      <Pressable onPress={onDetails} style={styles.details}><Text style={styles.detailsText}>View details</Text><Ionicons name="chevron-forward" size={14} color="#7259D5"/></Pressable>
      <ExploreRoutePanel origin={routeOrigin} originLabel={routeOriginLabel} destination={selected} onRoute={onRoute}/>
    </>:<View style={styles.empty}>{loading?<ActivityIndicator size="small" color="#8069DD"/>:<Ionicons name="map-outline" size={25} color="#8069DD"/>}<Text style={styles.emptyTitle}>{loading?"Finding places around this area…":"Choose a place to explore"}</Text><Text style={styles.emptyText}>{loading?"The map is ready now. Real nearby results will appear as they arrive.":"Select a nearby result to see details and a route."}</Text></View>}</View>
    <View style={[styles.map,wide&&styles.mapWide]}><DiscoverMap places={places} selectedId={selected?.id??null} center={selected?{latitude:selected.latitude,longitude:selected.longitude}:center} userLocation={userLocation} route={route} onSelect={onSelect}/></View>
  </View>;
}
const styles=StyleSheet.create({shell:{gap:12},wide:{flexDirection:"row",alignItems:"stretch"},info:{gap:11},infoWide:{width:350},map:{flex:1,minWidth:0},mapWide:{minWidth:420},badge:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:9,paddingVertical:6,borderRadius:12,backgroundColor:"#F4F0FF"},badgeText:{color:"#735BD8",fontSize:7.2,fontWeight:"900",letterSpacing:.6},featureTop:{flexDirection:"row",alignItems:"center",gap:10},thumb:{width:58,height:58,borderRadius:18,backgroundColor:"#EDF0F5"},thumbFallback:{width:58,height:58,borderRadius:18,alignItems:"center",justifyContent:"center"},name:{color:"#1F2943",fontSize:15,fontWeight:"900",letterSpacing:-.25},address:{marginTop:3,color:"#818B9E",fontSize:8.5,lineHeight:12,fontWeight:"600"},save:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#F6F6F9"},tags:{flexDirection:"row",gap:7,flexWrap:"wrap"},tag:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:9,paddingVertical:6,borderRadius:12,backgroundColor:"#F7F7F9"},tagText:{color:"#737D91",fontSize:8,fontWeight:"800"},details:{minHeight:38,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderRadius:14,backgroundColor:"#F3EFFF"},detailsText:{color:"#7259D5",fontSize:8.7,fontWeight:"900"},empty:{minHeight:200,alignItems:"center",justifyContent:"center",padding:20,borderRadius:22,backgroundColor:"#fff",borderWidth:1,borderColor:"#E7E9EF"},emptyTitle:{marginTop:8,color:"#30394F",fontSize:12,fontWeight:"900"},emptyText:{marginTop:4,color:"#8D95A5",fontSize:8.5,fontWeight:"600",textAlign:"center"}});
