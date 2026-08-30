import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type TripItem = {
  id: string;
  name: string;
  location?: string | null;
  startDate?: string | null;
};

type Props = {
  visible: boolean;
  trips: TripItem[];
  onClose: () => void;
  onSelectTrip: (trip: TripItem) => void;
};

export default function AiTripPickerModal({ visible, trips, onClose, onSelectTrip }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose a trip</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Pick the trip where this AI suggestion should be added.</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {trips.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No trips available yet</Text>
                <Text style={styles.emptyText}>Create a trip first, then add AI suggestions into its itinerary.</Text>
              </View>
            ) : (
              trips.map((trip) => (
                <Pressable key={trip.id} style={styles.tripRow} onPress={() => onSelectTrip(trip)}>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripName}>{trip.name}</Text>
                    <Text style={styles.tripMeta}>{trip.location || "Trip workspace"}{trip.startDate ? ` • ${trip.startDate}` : ""}</Text>
                  </View>
                  <Text style={styles.pickTxt}>Select</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(11,16,32,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "82%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  closeTxt: {
    fontSize: 18,
    color: "#475569",
  },
  list: {
    gap: 12,
    paddingBottom: 4,
  },
  tripRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FBFCFF",
  },
  tripInfo: {
    flex: 1,
    paddingRight: 12,
  },
  tripName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  tripMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  pickTxt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6D5DF5",
  },
  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8EDF5",
    padding: 18,
    backgroundColor: "#FBFCFF",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
});
