import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useAuth } from "@/features/auth/hooks/useAuth";

export default function AgencyLayout() {
  const { session, profile, isInitializing, isProfileLoading } = useAuth();
  if (isInitializing || isProfileLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (!profile?.role) return <Redirect href="/choose-role" />;
  if (profile.role !== "agency") return <Redirect href="/(traveler)/(tabs)/home" />;
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
