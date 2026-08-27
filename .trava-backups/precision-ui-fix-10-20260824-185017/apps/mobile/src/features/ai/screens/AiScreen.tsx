import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { sendAiMessage, type AiHistoryTurn } from "../api/ai.api";

type UiMessage = AiHistoryTurn & { id: string; createdAt: string };

const QUICK = ["Plan a solo trip to Japan", "Best beaches in Asia", "Budget trip to Switzerland", "What should I pack?"];

export function AiScreen() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState(QUICK);
  const scrollRef = useRef<ScrollView>(null);
  const storageKey = useMemo(() => `trava-ai-native:${user?.id || "guest"}`, [user?.id]);
  const name = profile?.full_name || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) || user?.email?.split("@")[0] || "Explorer";

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = JSON.parse(raw) as UiMessage[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-40));
      } catch { /* Ignore stale local chat data. */ }
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    void AsyncStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages, storageKey, sending]);

  async function submit(raw = input) {
    const text = raw.trim();
    if (!text || sending) return;
    const userMessage: UiMessage = { id: makeId(), role: "user", text, createdAt: new Date().toISOString() };
    const history = messages.map(({ role, text: value }) => ({ role, text: value }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);
    try {
      const result = await sendAiMessage(text, history);
      setMessages((current) => [...current, { id: makeId(), role: "assistant", text: result.reply, createdAt: new Date().toISOString() }]);
      if (result.quickReplies?.length) setQuickReplies(result.quickReplies.slice(0, 4));
    } catch (error) {
      setMessages((current) => [...current, { id: makeId(), role: "assistant", text: error instanceof Error ? error.message : "TRAVA AI could not answer right now.", createdAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  const visible = messages.length ? messages : [{ id: "welcome", role: "assistant" as const, text: `Hello, ${name}! 👋\nWhere shall we wander today?`, createdAt: new Date().toISOString() }];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={72}>
        <LinearGradient colors={["#EEF4FF", "#FFF4F8", "#FAFAFF"]} locations={[0, 0.38, 1]} style={styles.flex}>
          <View style={styles.header}>
            <View style={styles.brand}><LinearGradient colors={["#816AFF", "#F27DCF"]} style={styles.bot}><Text style={styles.botText}>✦</Text></LinearGradient><View><Text style={styles.title}>TRAVA AI</Text><Text style={styles.subtitle}>Your travel copilot</Text></View></View>
            <Pressable onPress={() => { setMessages([]); setQuickReplies(QUICK); }} style={styles.clear}><Text style={styles.clearText}>New chat</Text></Pressable>
          </View>

          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages}>
            {visible.map((message) => (
              <View key={message.id} style={[styles.row, message.role === "user" && styles.rowUser]}>
                {message.role === "assistant" ? <LinearGradient colors={["#826BFB", "#EA80D5"]} style={styles.smallBot}><Text style={styles.smallBotText}>✦</Text></LinearGradient> : null}
                <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.aiBubble]}>
                  <Text style={[styles.messageText, message.role === "user" && styles.userText]}>{message.text}</Text>
                </View>
              </View>
            ))}
            {sending ? <View style={styles.row}><LinearGradient colors={["#826BFB", "#EA80D5"]} style={styles.smallBot}><Text style={styles.smallBotText}>✦</Text></LinearGradient><View style={styles.typing}><ActivityIndicator size="small" color="#765DEB" /><Text style={styles.typingText}>Planning…</Text></View></View> : null}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quickTrack}>
            {quickReplies.map((prompt) => <Pressable key={prompt} disabled={sending} onPress={() => void submit(prompt)} style={styles.quick}><Text numberOfLines={1} style={styles.quickText}>{prompt}</Text></Pressable>)}
          </ScrollView>

          <View style={styles.composerWrap}>
            <View style={styles.composer}>
              <TextInput value={input} onChangeText={setInput} multiline maxLength={4000} placeholder="Ask TRAVA anything about your trip…" placeholderTextColor="#9AA2B3" style={styles.input} onSubmitEditing={() => void submit()} blurOnSubmit={false} />
              <Pressable disabled={!input.trim() || sending} onPress={() => void submit()} style={[styles.send, (!input.trim() || sending) && styles.sendDisabled]}><Text style={styles.sendText}>↑</Text></Pressable>
            </View>
            <Text style={styles.disclaimer}>TRAVA can make mistakes. Verify live prices, rules, and availability before booking.</Text>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

const styles = StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:"#F9FAFF"},header:{height:66,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:17,borderBottomWidth:1,borderBottomColor:"rgba(229,232,243,0.8)",backgroundColor:"rgba(255,255,255,0.86)"},brand:{flexDirection:"row",alignItems:"center",gap:10},bot:{width:38,height:38,borderRadius:14,alignItems:"center",justifyContent:"center"},botText:{color:"#FFF",fontSize:18,fontWeight:"900"},title:{color:"#17213A",fontSize:14,fontWeight:"900",letterSpacing:.2},subtitle:{marginTop:1,color:"#7D879B",fontSize:8,fontWeight:"700"},clear:{paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:"#F1EEFF"},clearText:{color:"#7159E7",fontSize:9,fontWeight:"900"},messages:{paddingHorizontal:15,paddingTop:18,paddingBottom:14,gap:11},row:{maxWidth:760,width:"100%",alignSelf:"center",flexDirection:"row",alignItems:"flex-end",gap:8},rowUser:{justifyContent:"flex-end"},smallBot:{width:29,height:29,borderRadius:11,alignItems:"center",justifyContent:"center"},smallBotText:{color:"#FFF",fontSize:11,fontWeight:"900"},bubble:{maxWidth:"82%",paddingHorizontal:14,paddingVertical:11,borderRadius:19},aiBubble:{backgroundColor:"rgba(255,255,255,0.95)",borderWidth:1,borderColor:"#ECECF4",borderBottomLeftRadius:7},userBubble:{backgroundColor:"#7160E9",borderBottomRightRadius:7},messageText:{color:"#28334B",fontSize:13,lineHeight:19,fontWeight:"600"},userText:{color:"#FFF"},typing:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:14,paddingVertical:10,borderRadius:18,backgroundColor:"#FFF"},typingText:{color:"#7E879A",fontSize:10,fontWeight:"700"},quickTrack:{maxWidth:760,alignSelf:"center",gap:7,paddingHorizontal:15,paddingBottom:9},quick:{height:34,justifyContent:"center",paddingHorizontal:12,borderRadius:14,backgroundColor:"rgba(255,255,255,0.94)",borderWidth:1,borderColor:"#E7E5F4"},quickText:{color:"#6657C8",fontSize:9,fontWeight:"800"},composerWrap:{paddingHorizontal:13,paddingTop:7,paddingBottom:8,backgroundColor:"rgba(255,255,255,0.94)",borderTopWidth:1,borderTopColor:"#EBEDF4"},composer:{maxWidth:760,width:"100%",alignSelf:"center",minHeight:50,flexDirection:"row",alignItems:"flex-end",gap:8,paddingLeft:14,paddingRight:6,paddingVertical:5,borderRadius:22,backgroundColor:"#F4F4F7"},input:{flex:1,maxHeight:105,minHeight:38,paddingVertical:9,color:"#242E43",fontSize:13,lineHeight:18},send:{width:39,height:39,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:"#7962ED"},sendDisabled:{backgroundColor:"#D4D4DA"},sendText:{color:"#FFF",fontSize:22,lineHeight:24,fontWeight:"800"},disclaimer:{marginTop:5,textAlign:"center",color:"#9AA2B1",fontSize:6.5,fontWeight:"600"}
});
