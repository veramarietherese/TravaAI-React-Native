import { Pressable, StyleSheet, Text, View } from "react-native";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?(): void;
}

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }: { pressed: boolean }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 26,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    color: "#111D3A",
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.45,
    fontWeight: "900",
  },
  action: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 5 },
  actionText: { color: "#7695E8", fontSize: 13, fontWeight: "800" },
  chevron: { color: "#7695E8", fontSize: 22, lineHeight: 22, fontWeight: "700" },
  pressed: { opacity: 0.65 },
});
