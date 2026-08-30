import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { StyleProp, ViewStyle } from "react-native";
import { TravaButton } from "./TravaButton";

type IconName = ComponentProps<typeof Ionicons>["name"];
export function PremiumPinkButton({ label, icon, onPress, disabled = false, loading = false, style, compact = false }: {
  label: string; icon?: IconName; onPress(): void; disabled?: boolean; loading?: boolean;
  style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  return <TravaButton label={label} iconName={icon} tone="pink" variant={compact ? "compact" : "default"} onPress={onPress} disabled={disabled} loading={loading} style={style}/>;
}
