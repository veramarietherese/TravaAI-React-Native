import { Redirect, type Href } from "expo-router";
import { useEffect, useState } from "react";
import type { UserRole } from "@trava/shared";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { getLastPortal } from "../utils/auth-storage";

export function EntryGateScreen() {
  const onboarding = useOnboarding();
  const { session, profile, isInitializing, isProfileLoading } = useAuth();
  const [portal, setPortal] = useState<UserRole | null>(null);

  useEffect(() => {
    let mounted = true;
    void getLastPortal().then((value) => {
      if (mounted) setPortal(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (onboarding.isLoading || isInitializing || isProfileLoading || !portal) {
    return <LoadingScreen />;
  }

  if (!onboarding.isComplete) return <Redirect href={"/onboarding" as Href} />;
  if (!session) return <Redirect href={(portal === "agency" ? "/agency-login" : "/login") as Href} />;
  if (!profile?.role) return <Redirect href="/choose-role" />;
  if (profile.role === "agency") return <Redirect href="/(agency)/(tabs)/dashboard" />;
  return <Redirect href="/(traveler)/(tabs)/home" />;
}
