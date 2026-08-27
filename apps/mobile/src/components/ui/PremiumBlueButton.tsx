import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const TRAVA_BUTTON_GRADIENT = ["#74CEF3", "#8EABF7", "#F1A7C9"] as const;

export function PremiumBlueButton({
  label,
  subtitle,
  icon,
  onPress,
  disabled = false,
  loading = false,
  style,
  trailing,
}: {
  label: string;
  subtitle?: string;
  icon?: IconName;
  onPress(): void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.press, style, pressed && s.pressed, (disabled || loading) && s.disabled]}
    >
      <LinearGradient
        colors={TRAVA_BUTTON_GRADIENT}
        start={{ x: 0.06, y: 0.08 }}
        end={{ x: 0.94, y: 0.92 }}
        style={s.button}
      >
        <View style={[s.highlight, { pointerEvents: "none" }]} />
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={20} color="#FFFFFF" /> : null}
            <View style={s.copy}>
              <Text style={s.label}>{label}</Text>
              {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            </View>
            {trailing ?? <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  press: { minHeight: 56, borderRadius: 28, boxShadow: "0 12px 28px rgba(102,145,220,.20)" },
  button: { minHeight: 56, paddingHorizontal: 18, borderRadius: 28, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  highlight: { position: "absolute", left: 12, right: 12, top: 5, height: 17, borderRadius: 12, backgroundColor: "rgba(255,255,255,.25)" },
  copy: { flexShrink: 1 },
  label: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  subtitle: { marginTop: 1, color: "rgba(255,255,255,.86)", fontSize: 9, fontWeight: "700" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.988 }] },
  disabled: { opacity: 0.45 },
});
