import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

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
        colors={["#63D8FF", "#50B9FF", "#5D8BF2"]}
        start={{ x: .08, y: .05 }}
        end={{ x: .92, y: .95 }}
        style={s.button}
      >
        <View pointerEvents="none" style={s.highlight} />
        {loading ? <ActivityIndicator color="#FFFFFF" /> : (
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
  press: { minHeight: 54, borderRadius: 27, overflow: "visible", boxShadow: "0 12px 28px rgba(70,153,245,.26)" },
  button: { minHeight: 54, paddingHorizontal: 18, borderRadius: 27, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderColor: "rgba(255,255,255,.90)" },
  highlight: { position: "absolute", left: 10, right: 10, top: 5, height: 18, borderRadius: 14, backgroundColor: "rgba(255,255,255,.27)" },
  copy: { flexShrink: 1 },
  label: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: -.1 },
  subtitle: { marginTop: 1, color: "rgba(255,255,255,.85)", fontSize: 8.5, fontWeight: "600" },
  pressed: { opacity: .80, transform: [{ scale: .985 }] },
  disabled: { opacity: .45 },
});
