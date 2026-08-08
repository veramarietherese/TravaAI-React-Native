import { Pressable, StyleSheet, Text, View } from "react-native";

interface GoogleButtonProps {
  onPress(): void;
  disabled?: boolean;
  label?: string;
}

export function GoogleButton({
  onPress,
  disabled = false,
  label = "Continue with Google",
}: GoogleButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.mark}><Text style={styles.markText}>G</Text></View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.34)",
    backgroundColor: "rgba(255,255,255,0.90)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    paddingHorizontal: 18,
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  disabled: { opacity: 0.55 },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  markText: { color: "#4285F4", fontSize: 17, fontWeight: "900" },
  label: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
});
