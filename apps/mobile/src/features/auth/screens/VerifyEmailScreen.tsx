import type { UserRole } from "@trava/shared";
import * as Linking from "expo-linking";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../utils/auth-errors";
import { getPendingVerification, setPendingVerification } from "../utils/auth-storage";

const progressSteps = ["Account", "Verify", "Ready"] as const;

function parsePortal(value: string | undefined): UserRole {
  return value === "agency" ? "agency" : "traveler";
}

export function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; portal?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [portal, setPortal] = useState<UserRole>(parsePortal(params.portal));
  const { resendVerification } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (email) return;
    void getPendingVerification().then((pending) => {
      if (!pending) return;
      setEmail(pending.email);
      setPortal(pending.role);
    });
  }, [email]);

  const loginRoute = portal === "agency" ? "/agency-login" : "/login";
  const registerRoute = portal === "agency" ? "/agency-register" : "/register";

  const resend = async () => {
    setError("");
    setMessage("");
    if (!email) {
      setError("Return to registration and enter your email again.");
      return;
    }
    setLoading(true);
    try {
      await resendVerification(email);
      setMessage("A fresh verification email was sent.");
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const verifyLater = async () => {
    await setPendingVerification(email ? { email, role: portal } : null);
    router.replace(`${loginRoute}?email=${encodeURIComponent(email)}&verificationDeferred=1` as Href);
  };

  return (
    <AuthShell
      title="Verify your email"
      caption={email ? `We sent a secure verification link to ${email}.` : "Open the verification link sent to your inbox."}
      backHref={registerRoute as Href}
      backLabel="Edit details"
      portalLabel={portal === "agency" ? "Agency signup" : "Traveler signup"}
      progress={{ steps: progressSteps, current: 1 }}
    >
      <Text style={styles.copy}>One verification protects your account. After confirming, your selected portal opens directly without another setup step.</Text>
      <AuthButton label="Open email app" onPress={() => void Linking.openURL("mailto:")} />
      <AuthButton
        label="I verified — continue to sign in"
        onPress={() => router.replace(`${loginRoute}?email=${encodeURIComponent(email)}` as Href)}
        variant="secondary"
      />
      <Pressable onPress={() => void resend()} disabled={loading} style={styles.textAction}>
        <Text style={styles.textActionLabel}>{loading ? "Sending…" : "Resend verification email"}</Text>
      </Pressable>
      <Pressable onPress={() => void verifyLater()} style={styles.textAction}>
        <Text style={styles.later}>Verify later</Text>
      </Pressable>
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>Verify later never bypasses security. You can return, edit your details, refresh, or resend whenever you are ready.</Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  copy: { color: "#475569", fontSize: 14, lineHeight: 21, textAlign: "center" },
  textAction: { alignItems: "center", paddingVertical: 8 },
  textActionLabel: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  later: { color: "#64748B", fontSize: 13, fontWeight: "800" },
  success: { color: "#047857", fontSize: 13, textAlign: "center", fontWeight: "700" },
  error: { color: "#DC2626", fontSize: 13, textAlign: "center", fontWeight: "700" },
  note: { color: "#64748B", fontSize: 11, lineHeight: 17, textAlign: "center" },
});
