import { StyleSheet, Text, View } from "react-native";

interface PlaceholderScreenProps {
  title: string;
  description?: string;
}

export function PlaceholderScreen({ title, description = "This native feature is ready for migration." }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F8FA"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#17203A",
    textAlign: "center"
  },
  description: {
    marginTop: 10,
    fontSize: 16,
    color: "#667085",
    textAlign: "center"
  }
});
