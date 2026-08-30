import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { DiscoverPlace } from "./DiscoverMap.types";
import { categoryIcon, formatDistance } from "../data/explore-categories";

export function PlaceDetailsSheet({ place, visible, onClose, onAdd }: { place:DiscoverPlace|null;visible:boolean;onClose():void;onAdd():void }) {
  if(!place)return null; const image=place.image?.verifiedEntityMatch?place.image.url:null;
  const open=(url?:string|null)=>{if(url)void Linking.openURL(url);};
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}><ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>{image?<Image source={{uri:image}} contentFit="cover" style={StyleSheet.absoluteFill}/>:<LinearGradient colors={["#EFEAFF","#ECF5FF"]} style={StyleSheet.absoluteFill}/>} {!image?<View style={styles.heroFallback}><Ionicons name={categoryIcon(place.category)} size={42} color="#8067DE"/><Text style={styles.noPhoto}>No verified place photo</Text></View>:null}<Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={19} color="#3F4960"/></Pressable></View>
    <View style={styles.body}><Text style={styles.category}>{place.category.toUpperCase()}</Text><Text style={styles.title}>{place.name}</Text><Text style={styles.address}>{place.address||place.subtitle}</Text>
      <View style={styles.grid}>{formatDistance(place.distanceMeters)?<Info icon="navigate-outline" label="Proximity" value={formatDistance(place.distanceMeters)!}/>:null}{place.openingHours?<Info icon="time-outline" label="Opening hours" value={place.openingHours}/>:null}{place.phone?<Info icon="call-outline" label="Phone" value={place.phone}/>:null}</View>
      {place.website?<Pressable onPress={()=>open(place.website)} style={styles.link}><Ionicons name="globe-outline" size={16} color="#7057D2"/><Text style={styles.linkText}>Visit website</Text></Pressable>:null}
      {place.sourceUrl?<Pressable onPress={()=>open(place.sourceUrl)} style={styles.link}><Ionicons name="information-circle-outline" size={16} color="#7057D2"/><Text style={styles.linkText}>OpenStreetMap source</Text></Pressable>:null}
      {place.image?.attributionText?<Pressable disabled={!place.image.sourceUrl} onPress={()=>open(place.image?.sourceUrl)}><Text style={styles.attribution}>Photo: {place.image.attributionText}</Text></Pressable>:null}
      <Pressable onPress={onAdd} style={styles.add}><Ionicons name="add" size={16} color="#fff"/><Text style={styles.addText}>Add to itinerary</Text></Pressable>
    </View>
  </ScrollView></View></View></Modal>;
}
function Info({icon,label,value}:{icon:React.ComponentProps<typeof Ionicons>["name"];label:string;value:string}){return <View style={styles.info}><Ionicons name={icon} size={16} color="#7861D8"/><View style={{flex:1}}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;}
const styles=StyleSheet.create({backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(22,28,44,.30)",padding:12},sheet:{width:"100%",maxWidth:660,maxHeight:"86%",alignSelf:"center",overflow:"hidden",borderRadius:28,backgroundColor:"#fff"},hero:{height:220,backgroundColor:"#EFF2F7"},heroFallback:{flex:1,alignItems:"center",justifyContent:"center"},noPhoto:{marginTop:8,color:"#81789B",fontSize:9,fontWeight:"800"},close:{position:"absolute",right:12,top:12,width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.94)"},body:{padding:17},category:{color:"#8065E2",fontSize:7.5,fontWeight:"900",letterSpacing:.8},title:{marginTop:5,color:"#202943",fontSize:22,fontWeight:"900",letterSpacing:-.4},address:{marginTop:6,color:"#7F899C",fontSize:9.5,lineHeight:14,fontWeight:"600"},grid:{marginTop:13,gap:7},info:{minHeight:50,flexDirection:"row",alignItems:"center",gap:10,padding:10,borderRadius:15,backgroundColor:"#F8F8FA"},infoLabel:{color:"#9199A8",fontSize:7.5,fontWeight:"800"},infoValue:{marginTop:2,color:"#353E55",fontSize:9,fontWeight:"800"},link:{marginTop:8,minHeight:40,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:11,borderRadius:14,backgroundColor:"#F4F0FF"},linkText:{color:"#7057D2",fontSize:8.7,fontWeight:"900"},attribution:{marginTop:10,color:"#9A9FAC",fontSize:7.3,lineHeight:11,fontWeight:"600"},add:{marginTop:16,minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,borderRadius:15,backgroundColor:"#8064E3"},addText:{color:"#fff",fontSize:9.5,fontWeight:"900"}});
