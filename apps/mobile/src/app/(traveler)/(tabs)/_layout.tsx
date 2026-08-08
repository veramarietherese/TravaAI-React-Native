import { Tabs } from "expo-router";
import { StyleSheet, Text, type ColorValue } from "react-native";

const TAB_ICONS = {
  home: "⌂",
  explore: "⌖",
  trips: "✈",
  ai: "✦",
  profile: "☺",
} as const;

type TabIconName = keyof typeof TAB_ICONS;

function TabIcon({ name, color, focused }: { name: TabIconName; color: ColorValue; focused: boolean }) {
  return (
    <Text accessibilityElementsHidden style={[styles.icon, { color }, focused && styles.iconFocused]}>
      {TAB_ICONS[name]}
    </Text>
  );
}

export default function TravelerTabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#7055ED",
        tabBarInactiveTintColor: "#8B95A9",
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: styles.bar,
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color, focused }) => <TabIcon name="explore" color={color} focused={focused} /> }} />
      <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: ({ color, focused }) => <TabIcon name="trips" color={color} focused={focused} /> }} />
      <Tabs.Screen name="ai" options={{ title: "AI", tabBarIcon: ({ color, focused }) => <TabIcon name="ai" color={color} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: { backgroundColor: "#F8F9FF" },
  bar: {
    minHeight: 70,
    paddingTop: 7,
    paddingBottom: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8EAF2",
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#2C3454",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -7 },
    elevation: 12,
  },
  item: { paddingVertical: 3 },
  label: { fontSize: 10, lineHeight: 13, fontWeight: "700" },
  icon: { fontSize: 23, lineHeight: 26, fontWeight: "700" },
  iconFocused: { transform: [{ scale: 1.08 }] },
});
