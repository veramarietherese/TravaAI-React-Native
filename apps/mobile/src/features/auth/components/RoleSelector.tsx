import type { UserRole } from "@trava/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface RoleSelectorProps {
  value: UserRole;
  onChange(role: UserRole): void;
  mode?: "tabs" | "cards";
}

const options = [
  { role: "traveler" as const, label: "Traveler", description: "Plan and manage personal trips", icon: "✈" },
  { role: "agency" as const, label: "Travel Agency", description: "Manage packages and inquiries", icon: "▦" },
];

export function RoleSelector({ value, onChange, mode = "tabs" }: RoleSelectorProps) {
  if (mode === "cards") {
    return (
      <View style={styles.cardList} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = value === option.role;
          return (
            <Pressable
              key={option.role}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.role)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.selectedCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.icon, selected && styles.selectedIcon]}>
                <Text style={[styles.iconText, selected && styles.selectedIconText]}>{option.icon}</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.cardLabel, selected && styles.selectedText]}>{option.label}</Text>
                <Text style={styles.description}>{option.description}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.tabs} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = value === option.role;
        return (
          <Pressable
            key={option.role}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.role)}
            style={({ pressed }) => [styles.tab, selected && styles.selectedTab, pressed && styles.pressed]}
          >
            <Text style={[styles.tabLabel, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 7, padding: 5, borderRadius: 18, backgroundColor: "#E9EEF5" },
  tab: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  selectedTab: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
  },
  tabLabel: { color: "#64748B", fontSize: 13, fontWeight: "800" },
  selectedText: { color: "#0F172A" },
  cardList: { gap: 10 },
  card: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.30)",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  selectedCard: { borderColor: "#4EE4EE", backgroundColor: "rgba(236,254,255,0.90)" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2F7" },
  selectedIcon: { backgroundColor: "#0F172A" },
  iconText: { color: "#475569", fontSize: 19, fontWeight: "900" },
  selectedIconText: { color: "#FFFFFF" },
  cardCopy: { flex: 1 },
  cardLabel: { color: "#475569", fontSize: 14, fontWeight: "900" },
  description: { marginTop: 3, color: "#64748B", fontSize: 11, lineHeight: 16 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#94A3B8", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: "#0F172A" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0F172A" },
});
