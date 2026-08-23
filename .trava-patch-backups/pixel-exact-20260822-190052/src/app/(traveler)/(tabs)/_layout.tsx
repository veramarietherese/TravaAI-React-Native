import { Tabs } from "expo-router";

import { TravaTabBar } from "@/components/navigation/TravaTabBar";

export default function TravelerTabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <TravaTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, sceneStyle: { backgroundColor: "#F8F9FF" } }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="trips" options={{ title: "Trips" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", href: null }} />
    </Tabs>
  );
}
