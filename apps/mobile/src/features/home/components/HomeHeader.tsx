import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface HomeHeaderProps {
  name: string;
  notificationCount: number;
  onNotificationsPress(): void;
  onMessagesPress?: () => void;
  onProfilePress(): void;
}

export function HomeHeader({ name, notificationCount, onNotificationsPress, onMessagesPress, onProfilePress }: HomeHeaderProps) {
  const firstName = name.trim().split(/\s+/)[0] || "Explorer";
  return <View style={styles.root}><View style={styles.copy}><Text style={styles.greeting}>Hi, {firstName}! 👋</Text><Text style={styles.title}>Where will TRAVA AI{"\n"}take <Text style={styles.emphasis}>you</Text> next?</Text></View><View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open notifications${notificationCount ? `, ${notificationCount} unread` : ""}`} onPress={onNotificationsPress} style={({pressed})=>[styles.iconButton,pressed&&styles.pressed]}><Ionicons name="notifications-outline" size={21} color="#34383E"/>{notificationCount>0?<View style={styles.badge}/>:null}</Pressable>
    {onMessagesPress ? <Pressable accessibilityRole="button" accessibilityLabel="Open messages" onPress={onMessagesPress} style={({pressed})=>[styles.iconButton,pressed&&styles.pressed]}><Ionicons name="chatbubble-ellipses-outline" size={21} color="#34383E"/></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={onProfilePress} style={({pressed})=>[styles.iconButton,pressed&&styles.pressed]}><Ionicons name="person-outline" size={21} color="#34383E"/></Pressable>
  </View></View>;
}
const styles=StyleSheet.create({root:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:16},copy:{flex:1,minWidth:0},greeting:{color:"#555A61",fontSize:15,lineHeight:20,fontWeight:"800",marginBottom:7},title:{color:"#121519",fontSize:31,lineHeight:34,letterSpacing:-1.2,fontWeight:"900"},emphasis:{color:"#121519",fontStyle:"italic"},actions:{flexDirection:"row",gap:8},iconButton:{width:46,height:46,borderRadius:23,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.90)",borderWidth:1,borderColor:"rgba(202,204,208,.72)",boxShadow:"0 9px 22px rgba(25,28,33,.07)"},badge:{position:"absolute",top:7,right:7,width:9,height:9,borderRadius:5,borderWidth:2,borderColor:"#FFF",backgroundColor:"#555A61"},pressed:{opacity:.7,transform:[{scale:.97}]}});
