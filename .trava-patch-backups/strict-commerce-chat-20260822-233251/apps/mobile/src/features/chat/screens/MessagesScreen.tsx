import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listMyChatRooms } from "../api/chat.api";

export function MessagesScreen() {
  const router = useRouter();
  const rooms = useQuery({ queryKey: ["chat-rooms"], queryFn: listMyChatRooms, staleTime: 20_000 });
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.title}>Messages</Text><Text style={styles.subtitle}>Trip conversations, synced live.</Text></View>
      <ScrollView contentContainerStyle={styles.content}>
        {rooms.isLoading ? <ActivityIndicator color="#7358EE" style={{ marginTop: 40 }} /> : null}
        {(rooms.data ?? []).map((room) => (
          <Pressable key={room.id} onPress={() => router.push(`/chat/${room.id}` as Href)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{room.title.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{room.title}</Text><Text numberOfLines={1} style={styles.last}>{room.lastMessage || "No messages yet"}</Text></View>
            <Text style={styles.time}>{new Date(room.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
        {!rooms.isLoading && !rooms.data?.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No conversations yet</Text><Text style={styles.emptyText}>Open a trip and tap the chat icon to create its shared conversation.</Text></View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FAFAFD"},header:{padding:18,paddingBottom:8},title:{color:"#151D31",fontSize:29,fontWeight:"900"},subtitle:{marginTop:3,color:"#868E9E",fontSize:10,fontWeight:"600"},
  content:{padding:16,paddingBottom:110,gap:8},row:{minHeight:70,flexDirection:"row",alignItems:"center",padding:10,borderRadius:18,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},
  avatar:{width:46,height:46,borderRadius:23,alignItems:"center",justifyContent:"center",backgroundColor:"#EEE9FF"},avatarText:{color:"#7358EE",fontSize:16,fontWeight:"900"},copy:{flex:1,minWidth:0,paddingHorizontal:10},
  name:{color:"#1D273D",fontSize:11,fontWeight:"900"},last:{marginTop:4,color:"#8C94A4",fontSize:9,fontWeight:"600"},time:{color:"#A1A7B4",fontSize:7,fontWeight:"700"},arrow:{marginLeft:8,color:"#677086",fontSize:20},
  empty:{marginTop:60,alignItems:"center",padding:30},emptyTitle:{color:"#1D273D",fontSize:15,fontWeight:"900"},emptyText:{marginTop:5,maxWidth:300,textAlign:"center",color:"#8C94A4",fontSize:10,lineHeight:16,fontWeight:"600"},pressed:{opacity:.7}
});
