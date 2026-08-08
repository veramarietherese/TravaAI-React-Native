import type { UserRole } from "@trava/shared";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { AuthButton } from "../components/AuthButton";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { RoleSelector } from "../components/RoleSelector";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../utils/auth-errors";
import { setLastPortal } from "../utils/auth-storage";

const progressSteps = ["Account", "Workspace", "Ready"] as const;

export function ChooseRoleScreen() {
  const router = useRouter();
  const { session, profile, isInitializing, isProfileLoading, chooseRole, signOut } = useAuth();
  const [role, setRole] = useState<UserRole>("traveler");
  const [fullName, setFullName] = useState(session?.user.user_metadata.full_name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isInitializing || isProfileLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (profile?.role) return <Redirect href="/" />;

  const submit = async () => {
    setError("");
    if (!fullName.trim()) {
      setError(role === "agency" ? "Enter your agency business name." : "Enter your full name.");
      return;
    }
    setLoading(true);
    try {
      await chooseRole(role, fullName);
      await setLastPortal(role);
      router.replace("/");
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Choose your workspace"
      caption="This one-time fallback is only for accounts created before portal selection was added."
      onBack={async () => {
        await signOut();
        router.replace("/login");
      }}
      backLabel="Sign out"
      progress={{ steps: progressSteps, current: 1 }}
    >
      <RoleSelector value={role} onChange={setRole} mode="cards" />
      <FormField label={role === "agency" ? "Agency Business Name" : "Full Name"} value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder={role === "agency" ? "Your agency name" : "Your full name"} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton label={role === "agency" ? "Open agency workspace" : "Open traveler workspace"} onPress={() => void submit()} loading={loading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({ error: { color: "#DC2626", fontSize: 13, textAlign: "center", fontWeight: "700" } });
