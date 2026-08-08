import { useMutation } from "@tanstack/react-query";
import type { FlightStatus } from "@trava/shared";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { checkFlightStatus } from "@/features/flights/api/flights.api";
import { updateTripFlight } from "../api/trips.api";

export function FlightStatusCard({ tripId, initialFlightNumber, initialFlightDate, canEdit }: { tripId: string; initialFlightNumber: string | null; initialFlightDate: string | null; canEdit: boolean }) {
  const [flightNumber, setFlightNumber] = useState(initialFlightNumber ?? "");
  const [flightDate, setFlightDate] = useState(initialFlightDate ?? "");
  const [status, setStatus] = useState<FlightStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: async () => {
      const normalized = flightNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (normalized.length < 2) throw new Error("Enter a valid flight number.");
      if (canEdit) await updateTripFlight(tripId, normalized, flightDate || null);
      return checkFlightStatus(normalized, flightDate || null, tripId);
    },
    onSuccess: (data) => { setStatus(data); setMessage(null); },
    onError: (error) => { setMessage(error instanceof Error ? error.message : "Unable to check this flight."); },
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>LIVE FLIGHT CHECKER</Text><Text style={styles.title}>Flight status</Text></View>
        {status ? <View style={styles.liveBadge}><Text style={styles.liveText}>{status.status.toUpperCase()}</Text></View> : null}
      </View>
      <View style={styles.formRow}>
        <TextInput editable={canEdit} autoCapitalize="characters" value={flightNumber} onChangeText={setFlightNumber} placeholder="e.g. PR2334" placeholderTextColor="#99A2B4" style={styles.input} />
        <TextInput editable={canEdit} value={flightDate} onChangeText={setFlightDate} placeholder="YYYY-MM-DD" placeholderTextColor="#99A2B4" style={styles.dateInput} />
      </View>
      <Pressable accessibilityRole="button" disabled={lookup.isPending} onPress={() => lookup.mutate()} style={[styles.button, lookup.isPending && styles.disabled]}>
        {lookup.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Check live status</Text>}
      </Pressable>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {status ? (
        <View style={styles.result}>
          <Text style={styles.flight}>{status.flightNumber}</Text>
          <View style={styles.routeRow}>
            <View style={styles.airport}><Text style={styles.code}>{status.departure.airportCode ?? "—"}</Text><Text numberOfLines={2} style={styles.airportName}>{status.departure.airportName ?? "Departure"}</Text></View>
            <Text style={styles.route}>━━ ✈ ━━</Text>
            <View style={[styles.airport, styles.airportRight]}><Text style={styles.code}>{status.arrival.airportCode ?? "—"}</Text><Text numberOfLines={2} style={styles.airportName}>{status.arrival.airportName ?? "Arrival"}</Text></View>
          </View>
          <View style={styles.detailGrid}>
            <Detail label="Departure" value={status.departure.estimatedTime ?? status.departure.scheduledTime ?? "—"} />
            <Detail label="Terminal / Gate" value={[status.departure.terminal, status.departure.gate].filter(Boolean).join(" / ") || "—"} />
            <Detail label="Arrival" value={status.arrival.estimatedTime ?? status.arrival.scheduledTime ?? "—"} />
            <Detail label="Last checked" value={new Date(status.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEF5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  eyebrow: { color: "#7055EC", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 3, color: "#17223C", fontSize: 19, fontWeight: "900" },
  liveBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#E4F8ED" },
  liveText: { color: "#227A4B", fontSize: 9, fontWeight: "900" },
  formRow: { marginTop: 14, flexDirection: "row", gap: 9 },
  input: { flex: 1, minWidth: 0, height: 45, borderRadius: 14, paddingHorizontal: 13, backgroundColor: "#F5F6FA", color: "#18233D", fontSize: 13, fontWeight: "800" },
  dateInput: { width: 128, height: 45, borderRadius: 14, paddingHorizontal: 12, backgroundColor: "#F5F6FA", color: "#18233D", fontSize: 12, fontWeight: "700" },
  button: { marginTop: 10, minHeight: 45, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#6F55E8" },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  error: { marginTop: 9, color: "#C83B4A", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  result: { marginTop: 15, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E9EBF2" },
  flight: { color: "#7157EC", fontSize: 12, fontWeight: "900" },
  routeRow: { marginTop: 10, flexDirection: "row", alignItems: "center" },
  airport: { flex: 1 },
  airportRight: { alignItems: "flex-end" },
  code: { color: "#15213A", fontSize: 23, fontWeight: "900" },
  airportName: { marginTop: 2, color: "#78849A", fontSize: 9, lineHeight: 13, fontWeight: "700" },
  route: { color: "#9A87F4", fontSize: 13 },
  detailGrid: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detail: { width: "48%", flexGrow: 1, borderRadius: 13, padding: 10, backgroundColor: "#F7F7FC" },
  detailLabel: { color: "#8992A5", fontSize: 8, fontWeight: "800" },
  detailValue: { marginTop: 3, color: "#27334C", fontSize: 10, lineHeight: 14, fontWeight: "800" },
});
