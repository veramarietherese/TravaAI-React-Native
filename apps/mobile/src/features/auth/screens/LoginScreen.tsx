import type { UserRole } from "@trava/shared";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { GoogleButton } from "../components/GoogleButton";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage, isEmailNotConfirmedError } from "../utils/auth-errors";
import {
  getRememberedEmail,
  setLastPortal,
  setPendingVerification,
  setRememberedEmail,
} from "../utils/auth-storage";

interface LoginScreenProps {
  portal: UserRole;
}

function getPortalCopy(portal: UserRole) {
  return portal === "agency"
    ? {
        title: "Agency partner access",
        caption: "Manage packages, traveler inquiries, and agency operations from your secured workspace.",
        badge: "Agency portal",
        alternateLabel: "Traveler sign in",
        alternateRoute: "/login" as Href,
        registerRoute: "/agency-register" as Href,
      }
    : {
        title: "Welcome back",
        caption: "Continue planning trips with your personal AI travel workspace.",
        badge: "Traveler portal",
        alternateLabel: "Travel agency access",
        alternateRoute: "/agency-login" as Href,
        registerRoute: "/register" as Href,
      };
}

export function LoginScreen({ portal }: LoginScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; verificationDeferred?: string; passwordReset?: string }>();
  const { signInWithEmail, signInWithGoogle, session } = useAuth();
  const copy = getPortalCopy(portal);
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmailState] = useState(true);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void setLastPortal(portal);
  }, [portal]);

  useEffect(() => {
    if (email) return;
    void getRememberedEmail(portal).then((remembered) => {
      if (remembered) setEmail(remembered);
    });
  }, [email, portal]);

  useEffect(() => {
    if (session) router.replace("/");
  }, [router, session]);

  const handleEmailLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading("email");
    try {
      await signInWithEmail({ email, password, role: portal });
      await Promise.all([
        setRememberedEmail(portal, rememberEmail ? email : null),
        setPendingVerification(null),
        setLastPortal(portal),
      ]);
      router.replace("/");
    } catch (nextError) {
      if (isEmailNotConfirmedError(nextError)) {
        await setPendingVerification({ email, role: portal });
        router.push(
          `/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&portal=${portal}` as Href,
        );
      } else {
        setError(getAuthErrorMessage(nextError));
      }
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading("google");
    try {
      const result = await signInWithGoogle(portal);
      if (!result.cancelled) {
        await setLastPortal(portal);
        router.replace("/");
      }
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(null);
    }
  };

  const notice = params.verificationDeferred === "1"
    ? "Verification was postponed. You can resend the email whenever you are ready."
    : params.passwordReset === "1"
      ? "Your password was updated. Sign in with your new password."
      : "";

  return (
    <AuthShell
      title={copy.title}
      caption={copy.caption}
      backHref="/onboarding"
      backLabel="Intro"
      portalLabel={copy.badge}
    >
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <FormField
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        placeholder="Enter your password"
        onSubmitEditing={() => void handleEmailLogin()}
      />
      <View style={styles.options}>
        <Pressable
          onPress={() => setRememberEmailState((current) => !current)}
          style={styles.remember}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberEmail }}
        >
          <View style={[styles.checkbox, rememberEmail && styles.checkboxSelected]}>
            {rememberEmail ? <Text style={styles.check}>✓</Text> : null}
          </View>
          <Text style={styles.optionText}>Remember email</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/forgot-password?portal=${portal}` as Href)}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton label="Sign in" onPress={() => void handleEmailLogin()} loading={loading === "email"} disabled={loading !== null} />
      <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
      <GoogleButton
        label={`Continue with Google as ${portal === "agency" ? "an agency" : "a traveler"}`}
        onPress={() => void handleGoogle()}
        disabled={loading !== null}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchCopy}>New to TRAVA AI?</Text>
        <Pressable onPress={() => router.push(copy.registerRoute)}>
          <Text style={styles.switchLink}>Create account</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={async () => {
          const nextPortal: UserRole = portal === "agency" ? "traveler" : "agency";
          await setLastPortal(nextPortal);
          router.replace(copy.alternateRoute);
        }}
        style={styles.portalSwitch}
      >
        <Text style={styles.portalSwitchText}>{copy.alternateLabel} →</Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  notice: { padding: 12, borderRadius: 14, backgroundColor: "rgba(78,228,238,0.16)", color: "#164E63", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  options: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  remember: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1, borderColor: "#94A3B8", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  checkboxSelected: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  check: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  optionText: { color: "#64748B", fontSize: 13, fontWeight: "600" },
  link: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  error: { color: "#DC2626", fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(100,116,139,0.34)" },
  or: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  switchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  switchCopy: { color: "#64748B", fontSize: 13 },
  switchLink: { color: "#0F172A", fontSize: 13, fontWeight: "900" },
  portalSwitch: { alignItems: "center", paddingVertical: 7 },
  portalSwitchText: { color: "#475569", fontSize: 12, fontWeight: "800" },
});
