import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function LocationPermissionCard({ visible, busy, onAllow, onNotNow }: { visible: boolean; busy: boolean; onAllow(): void; onNotNow(): void }) {
  if (!visible) return null;
  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name="location-outline" size={21} color="#775DE0" /></View>
    <View style={styles.copy}>
      <Text style={styles.title}>Allow location access?</Text>
      <Text style={styles.text}>Trava can use your location for nearby places and routes. You can keep exploring manually without it.</Text>
      <View style={styles.actions}>
        <Pressable disabled={busy} onPress={onAllow} style={styles.primary}><Text style={styles.primaryText}>{busy ? "Requesting…" : "Allow while using"}</Text></Pressable>
        <Pressable disabled={busy} onPress={onNotNow} style={styles.secondary}><Text style={styles.secondaryText}>Not now</Text></Pressable>
      </View>
    </View>
    <Pressable accessibilityLabel="Close location prompt" onPress={onNotNow} style={styles.close}><Ionicons name="close" size={17} color="#7D879A" /></Pressable>
  </View>;
}

const styles=StyleSheet.create({card:{position:"absolute",left:14,right:14,top:92,zIndex:150,alignSelf:"center",maxWidth:520,flexDirection:"row",gap:11,padding:14,borderRadius:22,backgroundColor:"rgba(255,255,255,.98)",borderWidth:1,borderColor:"#E7E2F3",boxShadow:"0 18px 42px rgba(49,42,78,.16)"},icon:{width:40,height:40,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#F2EEFF"},copy:{flex:1,minWidth:0},title:{color:"#202943",fontSize:13,fontWeight:"900"},text:{marginTop:4,color:"#778196",fontSize:10,lineHeight:15,fontWeight:"600"},actions:{marginTop:11,flexDirection:"row",gap:8,flexWrap:"wrap"},primary:{minHeight:36,paddingHorizontal:14,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#8064E5"},primaryText:{color:"#fff",fontSize:9.5,fontWeight:"900"},secondary:{minHeight:36,paddingHorizontal:14,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F3FA"},secondaryText:{color:"#5F687B",fontSize:9.5,fontWeight:"900"},close:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center"}});
