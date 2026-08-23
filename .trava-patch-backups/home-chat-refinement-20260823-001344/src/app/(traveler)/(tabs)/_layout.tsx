import { Tabs } from "expo-router";

import { TravaGlassNav } from "@/components/navigation/TravaGlassNav";

export default function TravelerTabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      tabBar={() => <TravaGlassNav placement="tabbar" />}
      screenOptions={{
        headerShown: false,
        animation: "none",
        sceneStyle: { backgroundColor: "#FFFFFF" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="trips" options={{ title: "Trips" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
