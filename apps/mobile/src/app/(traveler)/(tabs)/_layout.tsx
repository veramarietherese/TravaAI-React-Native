import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { TravaGlassNav } from "@/components/navigation/TravaGlassNav";

export default function TravelerTabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      tabBar={() => <TravaGlassNav placement="floating" />}
      screenOptions={{
        headerShown: false,
        animation: "none",
        tabBarHideOnKeyboard: true,
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
      <Tabs.Screen name="trips" options={{ title: "Trips" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ scene: { backgroundColor: "#FFFFFF" } });
