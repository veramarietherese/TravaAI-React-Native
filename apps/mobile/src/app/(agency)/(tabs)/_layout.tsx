import { Tabs } from "expo-router";

export default function AgencyTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="inquiries" options={{ title: "Inquiries" }} />
      <Tabs.Screen name="packages" options={{ title: "Packages" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
