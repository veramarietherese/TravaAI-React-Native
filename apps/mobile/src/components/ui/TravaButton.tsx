import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type TravaButtonTone = "blue" | "pink";
export type TravaButtonSize = "default" | "compact" | "icon";
export type TravaButtonVisualVariant = "outline" | "ghost";

/**
 * Backward-compatible variant type.
 *
 * Older screens used variant="default|compact|icon" for sizing.
 * The centralized button system originally changed that API to `size`, which
 * made those existing callers fail typecheck. Keep both forms supported.
 */
export type TravaButtonVariant =
  | TravaButtonVisualVariant
  | TravaButtonSize;

type TravaButtonProps = {
  label?: string;
  accessibilityLabel?: string;
  subtitle?: string;

  /** Preferred icon prop. */
  icon?: IconName;
  /** Backward-compatible alias used by already-migrated screens. */
  iconName?: IconName;
  trailingIcon?: IconName | null;

  tone?: TravaButtonTone;
  /** Preferred sizing prop. */
  size?: TravaButtonSize;
  /** Supports both visual variants and the legacy size aliases. */
  variant?: TravaButtonVariant;

  disabled?: boolean;
  loading?: boolean;
  onPress(): void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function TravaButton({
  label,
  accessibilityLabel,
  subtitle,
  icon,
  iconName,
  trailingIcon,
  tone = "blue",
  size,
  variant = "outline",
  disabled = false,
  loading = false,
  onPress,
  style,
  children,
}: TravaButtonProps) {
  const [hovered, setHovered] = useState(false);

  const inactive = disabled || loading;

  // Legacy calls used variant="compact" and variant="icon". Treat those as
  // size aliases while keeping outline/ghost as the actual visual variant.
  const resolvedSize: TravaButtonSize =
    size ?? (variant === "compact" || variant === "icon" || variant === "default"
      ? variant
      : "default");

  const resolvedVisualVariant: TravaButtonVisualVariant =
    variant === "ghost" ? "ghost" : "outline";

  const resolvedIcon = icon ?? iconName;
  const resolvedLabel = label ?? accessibilityLabel ?? "Button";

  const palette = inactive || resolvedVisualVariant === "ghost"
    ? {
        border: tone === "pink" ? "#E7CFD8" : "#D7E1EF",
        text: tone === "pink" ? "#D4B4C0" : "#A7B4C7",
        hover: "#FFFFFF",
        glow: "rgba(0,0,0,0)",
      }
    : tone === "pink"
      ? {
          border: "#FF9FBD",
          text: "#F0447A",
          hover: "#FFF8FB",
          glow: "rgba(240,68,122,.22)",
        }
      : {
          border: "#8FB8FF",
          text: "#2F73D9",
          hover: "#F8FBFF",
          glow: "rgba(47,115,217,.20)",
        };

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ color?: string }>, { color: palette.text })
    : children;

  const hoverStyle = hovered && !inactive && Platform.OS === "web"
    ? ({
        backgroundColor: palette.hover,
        boxShadow: `0 12px 30px ${palette.glow}`,
      } as ViewStyle)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? resolvedLabel}
      disabled={inactive}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.base,
        resolvedSize === "compact" && styles.compact,
        resolvedSize === "icon" && styles.iconOnly,
        {
          borderColor: palette.border,
          backgroundColor: "#FFFFFF",
        },
        hoverStyle,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {child ?? (resolvedIcon ? (
            <Ionicons
              name={resolvedIcon}
              size={resolvedSize === "icon" ? 22 : resolvedSize === "compact" ? 18 : 20}
              color={palette.text}
            />
          ) : null)}

          {resolvedSize !== "icon" ? (
            <View style={styles.copy}>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  resolvedSize === "compact" && styles.compactLabel,
                  { color: palette.text },
                ]}
              >
                {resolvedLabel}
              </Text>
              {subtitle ? (
                <Text
                  numberOfLines={1}
                  style={[styles.subtitle, { color: palette.text }]}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}

          {resolvedSize !== "icon" && trailingIcon ? (
            <Ionicons name={trailingIcon} size={17} color={palette.text} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    shadowColor: "#6C8BC6",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: 20,
  },
  iconOnly: {
    width: 54,
    height: 54,
    minHeight: 54,
    paddingHorizontal: 0,
    borderRadius: 27,
  },
  copy: {
    flexShrink: 1,
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: -0.15,
  },
  compactLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    marginTop: 1,
    opacity: 0.72,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
  inactive: {
    opacity: 0.58,
  },
});
