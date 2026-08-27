import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

interface AuthButtonProps {
  label: string;
  onPress(): void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
}

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
}: AuthButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#0F172A"} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary"
              ? styles.primaryLabel
              : variant === "secondary"
                ? styles.secondaryLabel
                : styles.ghostLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: "#0F172A",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.34)",
  },
  ghost: { backgroundColor: "transparent" },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  disabled: { opacity: 0.55 },
  label: { fontSize: 15, fontWeight: "800" },
  primaryLabel: { color: "#FFFFFF" },
  secondaryLabel: { color: "#0F172A" },
  ghostLabel: { color: "#334155" },
});
