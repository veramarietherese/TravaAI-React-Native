import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export type LocationChoice = {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

const POPULAR: LocationChoice[] = [
  { id: "tokyo", name: "Tokyo", displayName: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
  { id: "narita", name: "Narita International Airport", displayName: "Narita International Airport, Chiba, Japan", latitude: 35.7720, longitude: 140.3929 },
  { id: "shinjuku", name: "Shinjuku", displayName: "Shinjuku, Tokyo, Japan", latitude: 35.6938, longitude: 139.7034 },
  { id: "osaka", name: "Osaka", displayName: "Osaka, Japan", latitude: 34.6937, longitude: 135.5023 },
  { id: "kyoto", name: "Kyoto", displayName: "Kyoto, Japan", latitude: 35.0116, longitude: 135.7681 },
  { id: "cebu", name: "Cebu City", displayName: "Cebu City, Philippines", latitude: 10.3157, longitude: 123.8854 },
  { id: "mactan", name: "Mactan-Cebu International Airport", displayName: "Mactan-Cebu International Airport, Lapu-Lapu, Philippines", latitude: 10.3075, longitude: 123.9794 },
  { id: "seoul", name: "Seoul", displayName: "Seoul, South Korea", latitude: 37.5665, longitude: 126.9780 },
  { id: "hochiminh", name: "Ho Chi Minh City", displayName: "Ho Chi Minh City, Vietnam", latitude: 10.8231, longitude: 106.6297 },
  { id: "elnido", name: "El Nido", displayName: "El Nido, Palawan, Philippines", latitude: 11.2027, longitude: 119.4077 },
];

export function SearchableLocationField({
  label,
  value,
  placeholder = "Search city, airport, hotel, restaurant…",
  onChangeText,
  onSelect,
  compact = false,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  onChangeText(value: string): void;
  onSelect?(choice: LocationChoice): void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<LocationChoice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const request = useRef(0);

  const local = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return POPULAR.slice(0, 5);
    return POPULAR.filter((item) => `${item.name} ${item.displayName}`.toLowerCase().includes(q)).slice(0, 5);
  }, [value]);

  useEffect(() => {
    const q = value.trim();
    if (!open || q.length < 3) {
      setRemote([]);
      setLoading(false);
      setMessage(null);
      return;
    }
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=7`);
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const json = await response.json() as {
          features?: Array<{
            geometry?: { coordinates?: [number, number] };
            properties?: Record<string, string | number | null | undefined>;
          }>;
        };
        if (id !== request.current) return;
        const mapped = (json.features ?? []).flatMap((feature, index) => {
          const [longitude, latitude] = feature.geometry?.coordinates ?? [] as unknown as [number, number];
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
          const p = feature.properties ?? {};
          const name = String(p.name ?? p.street ?? p.city ?? p.state ?? p.country ?? "Location");
          const parts = [p.name, p.street, p.city, p.state, p.country]
            .filter((part, i, arr) => part && arr.indexOf(part) === i)
            .map(String);
          return [{
            id: String(p.osm_id ?? `${latitude}-${longitude}-${index}`),
            name,
            displayName: parts.join(", ") || name,
            latitude,
            longitude,
          } satisfies LocationChoice];
        });
        setRemote(mapped);
        if (!mapped.length && !local.length) setMessage("No matching places yet. Try a city, landmark, airport, or hotel name.");
      } catch {
        if (id !== request.current) return;
        setRemote([]);
        setMessage(local.length ? "Showing saved suggestions while live place search is unavailable." : "Live place search is unavailable right now.");
      } finally {
        if (id === request.current) setLoading(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [local.length, open, value]);

  const choices = useMemo(() => {
    const seen = new Set<string>();
    return [...local, ...remote].filter((item) => {
      const key = `${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [local, remote]);

  function choose(choice: LocationChoice) {
    onChangeText(choice.displayName);
    onSelect?.(choice);
    setOpen(false);
    setRemote([]);
    setMessage(null);
  }

  return <View style={[styles.root, compact && styles.compact]}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={[styles.field, open && styles.fieldFocused]}>
      <Ionicons name="location-outline" size={18} color="#7395C7" />
      <TextInput
        value={value}
        onFocus={() => setOpen(true)}
        onChangeText={(text) => { onChangeText(text); setOpen(true); }}
        placeholder={placeholder}
        placeholderTextColor="#9AA6BB"
        autoCorrect={false}
        style={styles.input}
      />
      {loading ? <ActivityIndicator size="small" color="#7EA7E8" /> : value ? <Pressable accessibilityLabel="Clear location" onPress={() => { onChangeText(""); setOpen(true); }} style={styles.clear}><Ionicons name="close-circle" size={18} color="#AAB4C5" /></Pressable> : <Ionicons name="chevron-down" size={16} color="#AAB4C5" />}
    </View>
    {open ? <View style={styles.dropdown}>
      <View style={styles.dropdownHead}><Text style={styles.dropdownTitle}>{value.trim().length < 3 ? "Suggested places" : "Search results"}</Text><Pressable onPress={() => setOpen(false)}><Text style={styles.done}>Done</Text></Pressable></View>
      {choices.map((choice) => <Pressable key={choice.id} onPress={() => choose(choice)} style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}>
        <View style={styles.resultIcon}><Ionicons name="location" size={16} color="#789FE2" /></View>
        <View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultName}>{choice.name}</Text><Text numberOfLines={2} style={styles.resultAddress}>{choice.displayName}</Text></View>
        <Ionicons name="chevron-forward" size={16} color="#B3BDCD" />
      </Pressable>)}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {!loading && !choices.length && !message ? <Text style={styles.message}>Start typing at least 2 characters.</Text> : null}
      <View style={styles.powered}><Ionicons name="map-outline" size={12} color="#96A4BA" /><Text style={styles.poweredText}>OpenStreetMap place search</Text></View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { width: "100%", position: "relative", zIndex: 50 },
  compact: { flex: 1, minWidth: 0 },
  label: { marginBottom: 6, color: "#526079", fontSize: 10, fontWeight: "800" },
  field: { minHeight: 50, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 16, backgroundColor: "#F6F8FC", borderWidth: 1, borderColor: "#E8ECF3" },
  fieldFocused: { backgroundColor: "#FFFFFF", borderColor: "#B8D2F7", boxShadow: "0 8px 22px rgba(111,151,210,.12)" },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: "#17223C", fontSize: 12, fontWeight: "700" },
  clear: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  dropdown: { marginTop: 7, overflow: "hidden", borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EBF2", boxShadow: "0 16px 34px rgba(57,70,101,.15)", zIndex: 100 },
  dropdownHead: { minHeight: 38, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FAFBFD", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E9EDF3" },
  dropdownTitle: { color: "#66758F", fontSize: 10, fontWeight: "900", letterSpacing: .25 },
  done: { color: "#739FE2", fontSize: 10, fontWeight: "900" },
  result: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EDF0F5" },
  resultPressed: { backgroundColor: "#F5F9FF" },
  resultIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF6FF" },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { color: "#15213A", fontSize: 11, fontWeight: "900" },
  resultAddress: { marginTop: 2, color: "#7B879B", fontSize: 9, lineHeight: 13, fontWeight: "600" },
  message: { paddingHorizontal: 13, paddingVertical: 12, color: "#7D899C", fontSize: 9, lineHeight: 14, fontWeight: "600" },
  powered: { paddingHorizontal: 13, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FAFBFD" },
  poweredText: { color: "#9AA5B5", fontSize: 8, fontWeight: "700" },
});
