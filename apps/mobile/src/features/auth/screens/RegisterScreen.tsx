import type { UserRole } from "@trava/shared";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { GoogleButton } from "../components/GoogleButton";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../utils/auth-errors";
import {
  clearAuthDraft,
  getAuthDraft,
  setAuthDraft,
  setLastPortal,
  setPendingVerification,
} from "../utils/auth-storage";

interface RegisterScreenProps {
  portal: UserRole;
}

function getPortalCopy(portal: UserRole) {
  return portal === "agency"
    ? {
        title: "Create agency access",
        caption: "Set up a secured agency account for packages, inquiries, and traveler communication.",
        badge: "Agency signup",
        nameLabel: "Agency Business Name",
        namePlaceholder: "Your registered agency name",
        loginRoute: "/agency-login" as Href,
        alternateRoute: "/register" as Href,
        alternateLabel: "Create a traveler account",
      }
    : {
        title: "Create your account",
        caption: "Start planning trips, collaborating with companions, and using your AI travel workspace.",
        badge: "Traveler signup",
        nameLabel: "Full Name",
        namePlaceholder: "Your full name",
        loginRoute: "/login" as Href,
        alternateRoute: "/agency-register" as Href,
        alternateLabel: "Register a travel agency",
      };
}

const progressSteps = ["Account", "Verify", "Ready"] as const;

export function RegisterScreen({ portal }: RegisterScreenProps) {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const copy = getPortalCopy(portal);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void Promise.all([getAuthDraft(portal), setLastPortal(portal)]).then(([draft]) => {
      if (!mounted) return;
      setFullName(draft.fullName);
      setEmail(draft.email);
      setAcceptedTerms(draft.acceptedTerms);
      setDraftReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [portal]);

  useEffect(() => {
    if (!draftReady) return;
    const timeout = setTimeout(() => {
      void setAuthDraft(portal, { fullName, email, acceptedTerms });
    }, 120);
    return () => clearTimeout(timeout);
  }, [acceptedTerms, draftReady, email, fullName, portal]);

  const validate = () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) return "Complete every required field.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Password must contain at least eight characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    if (!acceptedTerms) return "Accept the Terms and Privacy Policy to continue.";
    return "";
  };

  const handleEmailSignup = async () => {
    setError("");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading("email");
    try {
      const result = await signUpWithEmail({ fullName, email, password, role: portal });
      await Promise.all([
        setLastPortal(portal),
        setPendingVerification({ email: result.email, role: portal }),
      ]);
      if (result.needsEmailVerification) {
        router.replace(
          `/verify-email?email=${encodeURIComponent(result.email)}&portal=${portal}` as Href,
        );
      } else {
        await clearAuthDraft(portal);
        router.replace("/");
      }
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
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
        await Promise.all([clearAuthDraft(portal), setLastPortal(portal)]);
        router.replace("/");
      }
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(null);
    }
  };

  return (
    <AuthShell
      title={copy.title}
      caption={copy.caption}
      backHref={copy.loginRoute}
      backLabel="Sign in"
      portalLabel={copy.badge}
      progress={{ steps: progressSteps, current: 0 }}
    >
      <FormField
        label={copy.nameLabel}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        autoComplete="name"
        placeholder={copy.namePlaceholder}
      />
      <FormField
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <FormField label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="new-password" placeholder="At least 8 characters" />
      <FormField label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secure autoCapitalize="none" autoComplete="new-password" placeholder="Repeat your password" onSubmitEditing={() => void handleEmailSignup()} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
        onPress={() => setAcceptedTerms((current) => !current)}
        style={styles.termsRow}
      >
        <View style={[styles.checkbox, acceptedTerms && styles.checkboxSelected]}>
          {acceptedTerms ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.termsCopy}>I agree to the Terms of Service and Privacy Policy.</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton label="Create account" onPress={() => void handleEmailSignup()} loading={loading === "email"} disabled={loading !== null} />
      <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
      <GoogleButton
        label={`Continue with Google as ${portal === "agency" ? "an agency" : "a traveler"}`}
        onPress={() => void handleGoogle()}
        disabled={loading !== null}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchCopy}>Already registered?</Text>
        <Pressable onPress={() => router.replace(copy.loginRoute)}>
          <Text style={styles.switchLink}>Sign in</Text>
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
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: "#94A3B8", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  checkboxSelected: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  check: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  termsCopy: { flex: 1, color: "#64748B", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  error: { color: "#DC2626", fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(100,116,139,0.34)" },
  or: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  switchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6 },
  switchCopy: { color: "#64748B", fontSize: 13 },
  switchLink: { color: "#0F172A", fontSize: 13, fontWeight: "900" },
  portalSwitch: { alignItems: "center", paddingVertical: 7 },
  portalSwitchText: { color: "#475569", fontSize: 12, fontWeight: "800" },
});
