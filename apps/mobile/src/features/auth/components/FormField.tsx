import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";

interface FormFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
}

export function FormField({ label, error, secure = false, ...props }: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, error && styles.inputError]}>
        <TextInput
          {...props}
          style={styles.input}
          secureTextEntry={secure && !visible}
          placeholderTextColor="#94A3B8"
          selectionColor="#0F172A"
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            hitSlop={10}
            onPress={() => setVisible((current) => !current)}
            style={styles.showButton}
          >
            <Text style={styles.showText}>{visible ? "Hide" : "Show"}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  label: { color: "#475569", fontSize: 13, fontWeight: "700" },
  inputShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.34)",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  inputError: { borderColor: "#DC2626" },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  showButton: { minHeight: 52, justifyContent: "center", paddingHorizontal: 14 },
  showText: { color: "#334155", fontSize: 12, fontWeight: "800" },
  error: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
});
