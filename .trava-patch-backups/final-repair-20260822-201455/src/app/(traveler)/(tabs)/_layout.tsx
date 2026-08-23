import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View, type ColorValue } from "react-native";

type TabName = "home" | "explore" | "trips" | "ai" | "profile";
type IconName = ComponentProps<typeof Ionicons>["name"];
const ICONS: Record<Exclude<TabName, "ai">, { off: IconName; on: IconName }> = {
  home: { off: "home-outline", on: "home" },
  explore: { off: "compass-outline", on: "compass" },
  trips: { off: "airplane-outline", on: "airplane" },
  profile: { off: "person-outline", on: "person" },
};

function TabIcon({ name, color, focused }: { name: TabName; color: ColorValue; focused: boolean }) {
  if (name === "ai") return <LinearGradient colors={["#8FC7F8", "#B4B5F6", "#F1A7CA"]} style={s.ai}><Ionicons name="sparkles" size={21} color="#FFFFFF"/><Text style={s.aiText}>AI</Text></LinearGradient>;
  const icon = ICONS[name];
  return <View style={[s.iWrap, focused && s.iOn]}><Ionicons name={focused ? icon.on : icon.off} size={22} color={String(color)}/></View>;
}

export default function TravelerTabsLayout() {
  return <Tabs initialRouteName="home" screenOptions={{ headerShown: false, animation: "none", tabBarHideOnKeyboard: true, tabBarActiveTintColor: "#6D92CF", tabBarInactiveTintColor: "#34486F", tabBarLabelStyle: s.label, tabBarItemStyle: s.item, tabBarStyle: s.bar, sceneStyle: s.scene }}>
    <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused}/> }}/>
    <Tabs.Screen name="explore" options={{ title: "Discover", tabBarIcon: ({ color, focused }) => <TabIcon name="explore" color={color} focused={focused}/> }}/>
    <Tabs.Screen name="ai" options={{ title: "", tabBarIcon: ({ color, focused }) => <TabIcon name="ai" color={color} focused={focused}/> }}/>
    <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: ({ color, focused }) => <TabIcon name="trips" color={color} focused={focused}/> }}/>
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused}/> }}/>
  </Tabs>;
}

const s = StyleSheet.create({
  scene: { backgroundColor: "#FFF" }, bar: { position: "absolute", left: 18, right: 18, bottom: 14, height: 78, borderRadius: 39, borderTopWidth: 0, backgroundColor: "rgba(255,255,255,.96)", boxShadow: "0 -2px 28px rgba(73,91,121,.10)", paddingTop: 7, paddingBottom: 7 }, item: { paddingVertical: 0 }, label: { fontSize: 10, lineHeight: 12, fontWeight: "700" }, iWrap: { width: 42, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, iOn: { backgroundColor: "#EDF6FF" }, ai: { width: 86, height: 58, borderRadius: 23, marginTop: -15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", boxShadow: "0 12px 26px rgba(117,151,210,.20)" }, aiText: { color: "#FFF", fontSize: 18, fontWeight: "800" },
});
