import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { AuthShell } from "../components/AuthShell";
import { FormField } from "../components/FormField";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../utils/auth-errors";

const progressSteps = ["Email", "Reset"] as const;

export function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (password.length < 8) {
      setError("Password must contain at least eight characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      await signOut();
      router.replace({ pathname: "/login", params: { passwordReset: "1" } });
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      caption="Use a strong password that you have not used for this account before."
      backHref="/login"
      backLabel="Cancel"
      progress={{ steps: progressSteps, current: 1 }}
    >
      <FormField label="New Password" value={password} onChangeText={setPassword} secure autoComplete="new-password" placeholder="At least 8 characters" />
      <FormField label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secure autoComplete="new-password" placeholder="Repeat your new password" onSubmitEditing={() => void submit()} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton label="Update password" onPress={() => void submit()} loading={loading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({ error: { color: "#DC2626", fontSize: 13, textAlign: "center", fontWeight: "700" } });
