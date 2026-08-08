import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function LoadingScreen({ message = "Preparing your journey…" }: { message?: string }) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color="#0F172A" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
    backgroundColor: "#F7F8FB",
  },
  message: { color: "#64748B", fontSize: 15, fontWeight: "600" },
});
