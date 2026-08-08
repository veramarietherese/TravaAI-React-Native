import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { AuthButton } from "../components/AuthButton";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../utils/auth-errors";
import { getLastPortal } from "../utils/auth-storage";

export function AuthCallbackScreen() {
  const router = useRouter();
  const { completeAuthCallback } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void Linking.getInitialURL()
      .then(async (url) => {
        if (!url) throw new Error("No authentication callback URL was received.");
        const { intent } = await completeAuthCallback(url);
        if (intent === "recovery") router.replace("/reset-password" as Href);
        else router.replace("/");
      })
      .catch((nextError) => setError(getAuthErrorMessage(nextError)));
  }, [completeAuthCallback, router]);

  if (!error) return <LoadingScreen message="Securing your TRAVA AI session…" />;

  const returnToPortal = async () => {
    const portal = await getLastPortal();
    router.replace((portal === "agency" ? "/agency-login" : "/login") as Href);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to finish authentication</Text>
      <Text style={styles.error}>{error}</Text>
      <AuthButton label="Return to the correct sign-in portal" onPress={() => void returnToPortal()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 18, padding: 28, backgroundColor: "#F7F8FB" },
  title: { color: "#0F172A", fontSize: 26, fontWeight: "900", textAlign: "center" },
  error: { color: "#DC2626", fontSize: 14, lineHeight: 21, textAlign: "center" },
});
