import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { PremiumBlueButton } from "@/components/ui/PremiumBlueButton";
import { useTravaPreferences } from "@/lib/trava-preferences";

export function ProfileSettingsModal({
  visible,
  onClose,
  onSignOut,
}: {
  visible: boolean;
  onClose(): void;
  onSignOut(): Promise<void> | void;
}) {
  const { preferences, ready, update } = useTravaPreferences();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.header}>
            <View>
              <Text style={s.eyebrow}>TRAVA PREFERENCES</Text>
              <Text style={s.title}>Settings</Text>
            </View>
            <Pressable accessibilityLabel="Close settings" onPress={onClose} style={s.close}>
              <Ionicons name="close" size={20} color="#52617A" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <SettingRow
              icon="notifications-outline"
              title="Live notifications"
              description="Refresh trip and account notifications in real time, with a network-safe polling fallback."
              value={preferences.realtimeNotifications}
              disabled={!ready}
              onChange={(value) => update("realtimeNotifications", value)}
            />
            <SettingRow
              icon="location-outline"
              title="Use device location in Discover"
              description="Use your approximate location to center nearby places. You can still search anywhere when this is off."
              value={preferences.discoverLocation}
              disabled={!ready}
              onChange={(value) => update("discoverLocation", value)}
            />
            <SettingRow
              icon="images-outline"
              title="Venue photos"
              description="Load no-key Wikimedia Commons place photos when available, with free travel-photo fallback imagery."
              value={preferences.placePhotos}
              disabled={!ready}
              onChange={(value) => update("placePhotos", value)}
            />

            <View style={s.privacy}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#4E76BE" />
              <Text style={s.privacyText}>Your settings are stored on this device. TRAVA never exposes partial account matches when inviting collaborators.</Text>
            </View>

            <PremiumBlueButton label="Done" icon="checkmark" onPress={onClose} />
            <Pressable
              accessibilityRole="button"
              onPress={() => void Promise.resolve(onSignOut()).then(onClose)}
              style={({ pressed }) => [s.signOut, pressed && s.pressed]}
            >
              <Ionicons name="log-out-outline" size={17} color="#B94F67" />
              <Text style={s.signOutText}>Sign out</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SettingRow({
  icon,
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      <View style={s.icon}><Ionicons name={icon} size={19} color="#4F76BE" /></View>
      <View style={s.copy}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#DDE3EB", true: "#79CFFF" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(11,18,36,.38)" },
  card: { width: "100%", maxWidth: 510, maxHeight: "88%", padding: 20, borderRadius: 30, backgroundColor: "#FBFCFF", borderWidth: 1, borderColor: "rgba(255,255,255,.95)", boxShadow: "0 22px 52px rgba(21,37,70,.18)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#6680B8", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 3, color: "#17233D", fontSize: 24, fontWeight: "900" },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F4F9" },
  content: { paddingTop: 15, paddingBottom: 2, gap: 10 },
  row: { minHeight: 88, padding: 13, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8ECF3" },
  icon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF4FF" },
  copy: { flex: 1, minWidth: 0 },
  rowTitle: { color: "#1C2943", fontSize: 11.5, fontWeight: "900" },
  rowDescription: { marginTop: 4, color: "#718098", fontSize: 8.5, lineHeight: 13, fontWeight: "600" },
  privacy: { padding: 13, borderRadius: 19, flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#F2F7FF" },
  privacyText: { flex: 1, color: "#61718D", fontSize: 8.5, lineHeight: 13, fontWeight: "600" },
  signOut: { minHeight: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFF2F5", borderWidth: 1, borderColor: "#F7DEE5" },
  signOutText: { color: "#B94F67", fontSize: 10, fontWeight: "900" },
  pressed: { opacity: .7 },
});
