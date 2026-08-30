import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

export function AiComposer({
  value,
  onChange,
  sending,
  onSend,
}: {
  value: string;
  onChange(value: string): void;
  sending: boolean;
  onSend(): void;
}) {
  const canSend = Boolean(value.trim()) && !sending;

  return (
    <View style={styles.composer}>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!sending}
        multiline
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (canSend) onSend();
        }}
        placeholder="Ask about a destination, itinerary, hotel, food, transport, budget, visa, or travel concern…"
        placeholderTextColor="#9AA2B1"
        style={styles.input}
      />
      <Pressable
        accessibilityLabel="Send"
        disabled={!canSend}
        onPress={onSend}
        style={[styles.send, !canSend && styles.sendOff]}
      >
        <Ionicons name="arrow-up" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 8,
    paddingLeft: 13,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6E8EE",
    boxShadow: "0 14px 34px rgba(47,55,77,.10)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 5,
    paddingVertical: 10,
    color: "#2B344C",
    fontSize: 9.5,
    lineHeight: 14,
    fontWeight: "600",
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8064E3",
  },
  sendOff: {
    backgroundColor: "#C9C2DF",
  },
});
