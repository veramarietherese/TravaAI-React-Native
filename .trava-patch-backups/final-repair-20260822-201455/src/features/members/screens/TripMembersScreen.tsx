import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripMember } from "@trava/shared";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { inviteTripMember, listTripMembers, removeTripMember } from "../api/members.api";

export function TripMembersScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const membersQuery = useQuery({ queryKey: ["trip-members", tripId], queryFn: () => listTripMembers(tripId), enabled: Boolean(tripId) });
  const trip = tripQuery.data;
  const payload = membersQuery.data;

  const inviteMutation = useMutation({ mutationFn: (email: string) => inviteTripMember(tripId, email), onSuccess: async (message) => { setInviteOpen(false); Alert.alert("Invitation ready", message); await refresh(); }, onError: (error) => Alert.alert("Invite member", message(error)) });
  const removeMutation = useMutation({ mutationFn: (memberId: string) => removeTripMember(tripId, memberId), onSuccess: refresh, onError: (error) => Alert.alert("Remove member", message(error)) });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trip-members", tripId] }),
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
    ]);
  }
  function confirmRemove(member: TripMember) {
    Alert.alert("Remove traveler?", `${member.fullName} will lose access to this trip and its shared itinerary and expenses.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removeMutation.mutate(member.id) }]);
  }

  if (!trip) return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" size="large" /> : <Text style={styles.error}>{message(tripQuery.error)}</Text>}</SafeAreaView>;
  const accepted = payload?.members.filter((member) => member.status === "accepted") ?? trip.members.filter((member) => member.status === "accepted");
  const pending = payload?.members.filter((member) => member.status === "pending") ?? trip.members.filter((member) => member.status === "pending");
  const canManage = payload?.canManage ?? trip.canManageMembers;

  return <SafeAreaView style={styles.safe} edges={["top"]}><StatusBar style="dark" /><TripWorkspaceHeader tripId={tripId} title={trip.name} subtitle="Members and invitations" /><ScrollView refreshControl={<RefreshControl refreshing={membersQuery.isRefetching} onRefresh={() => void membersQuery.refetch()} tintColor="#7257EC" />} contentContainerStyle={styles.content}><View style={styles.maxWidth}>
    <View style={styles.hero}><View style={styles.heroIcon}><Text style={styles.heroGlyph}>☺</Text></View><View style={styles.heroCopy}><Text style={styles.heroTitle}>Travel together, safely</Text><Text style={styles.heroText}>Accepted members can view and contribute. Only the owner can edit trip settings, budget categories, invitations, and remove members.</Text></View>{canManage ? <Pressable onPress={() => setInviteOpen(true)} style={styles.inviteButton}><Text style={styles.inviteButtonText}>＋ Invite</Text></Pressable> : null}</View>
    <Section title="Trip owner" subtitle="Full administrative control"><MemberRow member={accepted.find((item) => item.role === "owner") ?? trip.owner} /></Section>
    <Section title="Accepted members" subtitle={`${accepted.filter((item) => item.role !== "owner").length} collaborators`}>
      {accepted.filter((item) => item.role !== "owner").map((member) => <MemberRow key={member.id} member={member} action={canManage ? <Pressable disabled={removeMutation.isPending} onPress={() => confirmRemove(member)}><Text style={styles.remove}>Remove</Text></Pressable> : null} />)}
      {!accepted.some((item) => item.role !== "owner") ? <Empty text="Invite another traveler to collaborate on the itinerary and expenses." /> : null}
    </Section>
    <Section title="Pending invitations" subtitle="Accounts must already exist in Trava AI">
      {pending.map((member) => <MemberRow key={member.id} member={member} action={canManage ? <Pressable disabled={removeMutation.isPending} onPress={() => confirmRemove(member)}><Text style={styles.remove}>Cancel</Text></Pressable> : null} />)}
      {!pending.length ? <Empty text="There are no invitations waiting for a response." /> : null}
    </Section>
    <View style={styles.permissions}><Text style={styles.permissionsTitle}>{canManage ? "Your permissions: Owner" : "Your permissions: Member"}</Text><Text style={styles.permissionsText}>{canManage ? "You can edit the trip, manage members and budget categories, and moderate all shared content." : "You can view the trip and add activities and expenses. You may edit or delete only content you created."}</Text></View>
  </View></ScrollView><InviteModal key={inviteOpen ? "invite-open" : "invite-closed"} visible={inviteOpen} saving={inviteMutation.isPending} onClose={() => setInviteOpen(false)} onInvite={(email) => inviteMutation.mutate(email)} /></SafeAreaView>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View></View><View style={styles.memberList}>{children}</View></View>; }
function MemberRow({ member, action }: { member: TripMember; action?: ReactNode }) { return <View style={styles.member}><View style={styles.avatar}>{member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={styles.avatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.memberCopy}><Text style={styles.memberName}>{member.fullName}</Text><Text style={styles.memberMeta}>{member.email ?? "Email unavailable"} · {member.role === "owner" ? "Owner" : member.status === "pending" ? "Invitation pending" : "Member"}</Text></View>{action}</View>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }
function InviteModal({ visible, saving, onClose, onInvite }: { visible: boolean; saving: boolean; onClose(): void; onInvite(email: string): void }) { const [email, setEmail] = useState(""); const [error, setError] = useState<string | null>(null); return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Invite by email</Text><Text style={styles.modalText}>For privacy, invitations can be sent only to an email that already belongs to a verified Trava AI traveler.</Text><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="traveler@example.com" placeholderTextColor="#98A1B3" style={styles.input} />{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.modalActions}><Pressable disabled={saving} onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => { const normalized = email.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(normalized)) { setError("Enter a valid email address."); return; } setError(null); onInvite(normalized); }} style={styles.sendButton}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendText}>Send invitation</Text>}</Pressable></View></View></View></Modal>; }
function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F8F9FF" }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, content: { padding: 16, paddingBottom: 60 }, maxWidth: { width: "100%", maxWidth: 760, alignSelf: "center" }, hero: { flexDirection: "row", alignItems: "center", gap: 13, padding: 17, borderRadius: 24, backgroundColor: "#17223C" }, heroIcon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#7257EC" }, heroGlyph: { color: "#FFFFFF", fontSize: 25, fontWeight: "900" }, heroCopy: { flex: 1 }, heroTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }, heroText: { marginTop: 4, color: "#C6CDE0", fontSize: 9, lineHeight: 14, fontWeight: "600" }, inviteButton: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: "#FF6F91" }, inviteButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" }, section: { marginTop: 14, padding: 16, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9EBF3" }, sectionHeader: { flexDirection: "row", justifyContent: "space-between" }, sectionTitle: { color: "#17223C", fontSize: 16, fontWeight: "900" }, sectionSubtitle: { marginTop: 3, color: "#8791A3", fontSize: 9, fontWeight: "600" }, memberList: { marginTop: 12, gap: 8 }, member: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, padding: 10, borderRadius: 17, backgroundColor: "#F7F8FC" }, avatar: { width: 42, height: 42, overflow: "hidden", borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#E6E0FF" }, avatarText: { color: "#7257EC", fontSize: 15, fontWeight: "900" }, memberCopy: { flex: 1, minWidth: 0 }, memberName: { color: "#17223C", fontSize: 11, fontWeight: "900" }, memberMeta: { marginTop: 4, color: "#7A8599", fontSize: 8, fontWeight: "600" }, remove: { color: "#C83B4A", fontSize: 9, fontWeight: "900" }, empty: { padding: 18, alignItems: "center", borderRadius: 16, backgroundColor: "#F8F9FC" }, emptyText: { textAlign: "center", color: "#8791A3", fontSize: 9, lineHeight: 14, fontWeight: "600" }, permissions: { marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: "#F0ECFF" }, permissionsTitle: { color: "#5E45D3", fontSize: 11, fontWeight: "900" }, permissionsText: { marginTop: 5, color: "#6E668F", fontSize: 9, lineHeight: 15, fontWeight: "600" }, modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(9,15,30,0.5)" }, modalCard: { width: "100%", maxWidth: 460, padding: 20, borderRadius: 25, backgroundColor: "#FFFFFF" }, modalTitle: { color: "#17223C", fontSize: 20, fontWeight: "900" }, modalText: { marginTop: 6, color: "#7A8599", fontSize: 10, lineHeight: 16, fontWeight: "600" }, input: { marginTop: 16, minHeight: 48, paddingHorizontal: 13, borderRadius: 15, color: "#17223C", backgroundColor: "#F3F4F8", fontSize: 11, fontWeight: "700" }, modalActions: { marginTop: 16, flexDirection: "row", gap: 9 }, cancelButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#EEF0F5" }, cancelText: { color: "#5F6B80", fontSize: 10, fontWeight: "900" }, sendButton: { flex: 2, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#7257EC" }, sendText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" }, error: { marginTop: 9, color: "#C83B4A", fontSize: 9, fontWeight: "700" } });
