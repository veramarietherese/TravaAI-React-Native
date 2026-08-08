import { StyleSheet, Text, View } from "react-native";

import type { TravelGlobeSurfaceProps } from "./TravelGlobeSurface.types";

export function TravelGlobeSurface({ accessibilityLabel = "Interactive travel globe" }: TravelGlobeSurfaceProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.root}>
      <Text style={styles.copy}>Interactive globe unavailable on this platform.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  copy: { color: "#667085", fontSize: 12, textAlign: "center" },
});
