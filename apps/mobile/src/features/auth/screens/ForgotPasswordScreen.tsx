import type { UserRole } from "@trava/shared";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../utils/auth-errors";
import { getRememberedEmail } from "../utils/auth-storage";

const progressSteps = ["Email", "Reset"] as const;

export function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ portal?: string }>();
  const portal: UserRole = params.portal === "agency" ? "agency" : "traveler";
  const loginRoute = portal === "agency" ? "/agency-login" : "/login";
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void getRememberedEmail(portal).then(setEmail);
  }, [portal]);

  const submit = async () => {
    setError("");
    setMessage("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setMessage("Reset instructions were sent. Check your inbox and spam folder.");
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      caption="Enter the email connected to your account. We will send one secure reset link."
      backHref={loginRoute as Href}
      backLabel="Sign in"
      portalLabel={portal === "agency" ? "Agency portal" : "Traveler portal"}
      progress={{ steps: progressSteps, current: 0 }}
    >
      <FormField label="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton label="Send reset link" onPress={() => void submit()} loading={loading} />
      {message ? (
        <AuthButton label="Return to sign in" onPress={() => router.replace(loginRoute as Href)} variant="secondary" />
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  success: { padding: 12, borderRadius: 14, backgroundColor: "rgba(16,185,129,0.12)", color: "#065F46", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  error: { color: "#DC2626", fontSize: 13, textAlign: "center", fontWeight: "700" },
});
