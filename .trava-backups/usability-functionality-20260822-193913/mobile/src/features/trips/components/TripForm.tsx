import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { TripSummary } from "@trava/shared";

export interface TripFormValue {
  name: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  currencyCode: string;
  travelStyle: string;
  travelGroup: string;
  flightNumber: string;
  flightDate: string;
  status: "draft" | "upcoming" | "ongoing" | "completed";
}

export interface PickedCover {
  asset: ImagePicker.ImagePickerAsset;
}

export function TripForm({ initialTrip, submitting, submitLabel, onSubmit, onCancel }: {
  initialTrip?: TripSummary | null;
  submitting: boolean;
  submitLabel: string;
  onSubmit(value: TripFormValue, cover: PickedCover | null): void;
  onCancel(): void;
}) {
  const [value, setValue] = useState<TripFormValue>(() => ({
    name: initialTrip?.name ?? "",
    destination: initialTrip?.destination ?? "",
    description: initialTrip?.description ?? "",
    startDate: initialTrip?.startDate ?? "",
    endDate: initialTrip?.endDate ?? "",
    totalBudget: initialTrip ? String(initialTrip.totalBudget) : "",
    currencyCode: initialTrip?.currencyCode ?? "PHP",
    travelStyle: initialTrip?.travelStyle ?? "",
    travelGroup: initialTrip?.travelGroup ?? "",
    flightNumber: initialTrip?.flightNumber ?? "",
    flightDate: initialTrip?.flightDate ?? "",
    status: initialTrip?.status ?? "upcoming",
  }));
  const [cover, setCover] = useState<PickedCover | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TripFormValue>(key: K, next: TripFormValue[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function pickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo access is required to choose a trip cover.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCover({ asset: result.assets[0] });
      setError(null);
    }
  }

  function submit() {
    const name = value.name.trim();
    const destination = value.destination.trim();
    if (name.length < 2) {
      setError("Enter a trip name.");
      return;
    }
    if (destination.length < 2) {
      setError("Enter a destination.");
      return;
    }
    if (value.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.startDate)) {
      setError("Use YYYY-MM-DD for the start date.");
      return;
    }
    if (value.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.endDate)) {
      setError("Use YYYY-MM-DD for the end date.");
      return;
    }
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    const budget = Number(value.totalBudget || 0);
    if (!Number.isFinite(budget) || budget < 0) {
      setError("Enter a valid budget amount.");
      return;
    }
    setError(null);
    onSubmit({ ...value, name, destination }, cover);
  }

  const preview = cover?.asset.uri ?? initialTrip?.coverImageUrl ?? null;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.maxWidth}>
        <View style={styles.coverCard}>
          {preview ? <Image source={{ uri: preview }} contentFit="cover" style={styles.coverImage} /> : <View style={styles.coverFallback}><Text style={styles.coverGlyph}>✈</Text><Text style={styles.coverFallbackText}>Add a cover that makes this trip easy to spot.</Text></View>}
          <Pressable accessibilityRole="button" onPress={() => void pickCover()} style={styles.coverButton}><Text style={styles.coverButtonText}>{preview ? "Change cover" : "Choose cover"}</Text></Pressable>
        </View>

        <Section title="Trip essentials" subtitle="The details every collaborator sees.">
          <Field label="Trip name" value={value.name} onChangeText={(text) => update("name", text)} placeholder="e.g. Japan spring escape" />
          <Field label="Destination" value={value.destination} onChangeText={(text) => update("destination", text)} placeholder="City, country, or region" />
          <Field label="Description" value={value.description} onChangeText={(text) => update("description", text)} placeholder="What is this trip about?" multiline />
          <View style={styles.row}>
            <Field compact label="Start date" value={value.startDate} onChangeText={(text) => update("startDate", text)} placeholder="YYYY-MM-DD" />
            <Field compact label="End date" value={value.endDate} onChangeText={(text) => update("endDate", text)} placeholder="YYYY-MM-DD" />
          </View>
        </Section>

        <Section title="Planning preferences" subtitle="Budget, travel style, and group context.">
          <View style={styles.row}>
            <Field compact label="Total budget" value={value.totalBudget} onChangeText={(text) => update("totalBudget", text)} placeholder="0.00" keyboardType="decimal-pad" />
            <Field compact label="Currency" value={value.currencyCode} onChangeText={(text) => update("currencyCode", text.toUpperCase().slice(0, 3))} placeholder="PHP" autoCapitalize="characters" />
          </View>
          <View style={styles.row}>
            <Field compact label="Travel style" value={value.travelStyle} onChangeText={(text) => update("travelStyle", text)} placeholder="Relaxed, adventure…" />
            <Field compact label="Travel group" value={value.travelGroup} onChangeText={(text) => update("travelGroup", text)} placeholder="Solo, family…" />
          </View>
        </Section>

        <Section title="Flight tracking" subtitle="Optional. Add this now or from the trip overview later.">
          <View style={styles.row}>
            <Field compact label="Flight number" value={value.flightNumber} onChangeText={(text) => update("flightNumber", text.toUpperCase())} placeholder="PR2334" autoCapitalize="characters" />
            <Field compact label="Flight date" value={value.flightDate} onChangeText={(text) => update("flightDate", text)} placeholder="YYYY-MM-DD" />
          </View>
        </Section>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable disabled={submitting} onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          <Pressable disabled={submitting} onPress={submit} style={[styles.submitButton, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{submitLabel}</Text>}</Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text><View style={styles.fields}>{children}</View></View>;
}

function Field({ label, compact, multiline, ...props }: { label: string; compact?: boolean; multiline?: boolean } & ComponentProps<typeof TextInput>) {
  return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#9AA3B5" style={[styles.input, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 50, backgroundColor: "#F8F9FF" },
  maxWidth: { width: "100%", maxWidth: 680, alignSelf: "center" },
  coverCard: { minHeight: 220, overflow: "hidden", borderRadius: 26, backgroundColor: "#EDE9FF", borderWidth: 1, borderColor: "#E5DFFF" },
  coverImage: { width: "100%", height: 230 },
  coverFallback: { minHeight: 220, alignItems: "center", justifyContent: "center", padding: 24 },
  coverGlyph: { color: "#7259EA", fontSize: 48 },
  coverFallbackText: { marginTop: 10, maxWidth: 270, color: "#776E9D", textAlign: "center", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  coverButton: { position: "absolute", right: 13, bottom: 13, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, backgroundColor: "rgba(20,29,52,0.85)" },
  coverButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  section: { marginTop: 16, borderRadius: 23, padding: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5" },
  sectionTitle: { color: "#17223C", fontSize: 17, fontWeight: "900" },
  sectionSubtitle: { marginTop: 3, color: "#818B9E", fontSize: 10, lineHeight: 15, fontWeight: "600" },
  fields: { marginTop: 14, gap: 12 },
  row: { flexDirection: "row", gap: 10 },
  field: { width: "100%" },
  fieldCompact: { flex: 1, minWidth: 0 },
  label: { marginBottom: 6, color: "#526079", fontSize: 10, fontWeight: "800" },
  input: { minHeight: 47, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, color: "#18233D", backgroundColor: "#F5F6FA", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  error: { marginTop: 14, color: "#C83B4A", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  actions: { marginTop: 18, flexDirection: "row", gap: 10 },
  cancelButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#EEF0F5" },
  cancelText: { color: "#5F6B80", fontSize: 12, fontWeight: "900" },
  submitButton: { flex: 2, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#7055EC" },
  submitText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
});
