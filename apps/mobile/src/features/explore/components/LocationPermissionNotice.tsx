import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
export function LocationPermissionNotice({onOpenSettings,onSearchInstead}:{onOpenSettings():void;onSearchInstead():void}) {
  return <View style={s.card}><View style={s.icon}><Ionicons name="location-outline" size={21} color="#3978CF"/></View><View style={s.copy}>
    <Text style={s.title}>Use your location for nearby picks</Text>
    <Text style={s.body}>TRAVA can center nearby places from your device, or you can search any city, landmark or venue manually.</Text>
    <View style={s.actions}><Pressable onPress={onSearchInstead} style={s.secondary}><Text style={s.secondaryText}>Search instead</Text></Pressable><Pressable onPress={onOpenSettings} style={s.primary}><Text style={s.primaryText}>Location settings</Text></Pressable></View>
  </View></View>;
}
const s=StyleSheet.create({
  card:{marginTop:12,padding:14,borderRadius:22,flexDirection:"row",gap:12,backgroundColor:"#F7FAFF",borderWidth:1,borderColor:"#E3EAF7"},
  icon:{width:42,height:42,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#EAF4FF"},copy:{flex:1,minWidth:0},
  title:{color:"#17233E",fontSize:12,fontWeight:"900"},body:{marginTop:4,color:"#6B7890",fontSize:10,lineHeight:15,fontWeight:"600"},
  actions:{marginTop:10,flexDirection:"row",flexWrap:"wrap",gap:8},secondary:{minHeight:34,paddingHorizontal:11,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E6F0"},
  secondaryText:{color:"#52617A",fontSize:9,fontWeight:"900"},primary:{minHeight:34,paddingHorizontal:11,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"#75C6EE"},
  primaryText:{color:"#FFF",fontSize:9,fontWeight:"900"},
});
