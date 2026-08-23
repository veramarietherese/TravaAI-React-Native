import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripMember } from "@trava/shared";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Glass, PX, ScreenShell } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";
import { inviteTripMember, listTripMembers, removeTripMember } from "../api/members.api";

export function TripMembersScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { syncStatus, onlineCount } = useLocalTripWorkspace(tripId);
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const membersQuery = useQuery({ queryKey: ["trip-members", tripId], queryFn: () => listTripMembers(tripId), enabled: Boolean(tripId) && !tripId.startsWith("local-") });
  const payload = membersQuery.data;
  const members = payload?.members ?? [];
  const accepted = useMemo(() => members.filter((member) => member.status === "accepted"), [members]);
  const pending = useMemo(() => members.filter((member) => member.status === "pending"), [members]);
  const canManage = payload?.canManage ?? (trip.ownerId !== "local");

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trip-members", tripId] }),
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
    ]);
  }

  const invite = useMutation({
    mutationFn: (email: string) => inviteTripMember(tripId, email),
    onSuccess: async (message) => { setInviteOpen(false); await refresh(); Alert.alert("Invitation sent", message); },
    onError: (error) => Alert.alert("Invite traveler", message(error)),
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => removeTripMember(tripId, memberId),
    onSuccess: refresh,
    onError: (error) => Alert.alert("Remove traveler", message(error)),
  });

  function confirmRemove(member: TripMember) {
    Alert.alert("Remove traveler?", `${member.fullName} will lose access to this trip.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate(member.id) },
    ]);
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Trip"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <LinearGradient colors={["#EEF7FF", "#F5F3FF", "#FFF2F7"]} style={s.liveCard}>
        <View style={s.liveIcon}><Ionicons name="people" size={27} color="#3D6FA8"/><View style={[s.statusDot, syncStatus === "offline" && s.statusOffline]}/></View>
        <View style={s.liveCopy}><Text style={s.liveTitle}>Live trip collaboration</Text><Text style={s.liveText}>{syncStatus === "live" ? `${onlineCount} collaborator${onlineCount === 1 ? "" : "s"} online · edits sync instantly` : syncStatus === "connecting" ? "Connecting to live trip sync…" : syncStatus === "offline" ? "Offline · your changes remain saved locally" : "Local workspace ready"}</Text></View>
        {canManage && !tripId.startsWith("local-") ? <Pressable onPress={() => setInviteOpen(true)} style={s.invite}><Ionicons name="person-add" size={17} color="#FFFFFF"/><Text style={s.inviteText}>Invite</Text></Pressable> : null}
      </LinearGradient>

      <Glass style={s.infoCard}><Ionicons name="sync-circle-outline" size={22} color="#5C89C7"/><Text style={s.infoText}>Accepted travelers can open the same trip and see itinerary, expense, budget and checklist changes live. Each device keeps a local copy so the workspace remains usable if someone disconnects.</Text></Glass>

      {membersQuery.isLoading ? <View style={s.loading}><ActivityIndicator color="#6E9BDA"/><Text style={s.loadingText}>Loading travelers…</Text></View> : null}
      {membersQuery.isError ? <Glass style={s.errorCard}><Ionicons name="alert-circle-outline" size={22} color="#C66A7C"/><View style={{ flex: 1 }}><Text style={s.errorTitle}>Members could not load</Text><Text style={s.errorText}>{message(membersQuery.error)}</Text></View><Pressable onPress={() => void membersQuery.refetch()} style={s.retry}><Text style={s.retryText}>Retry</Text></Pressable></Glass> : null}

      {!membersQuery.isLoading && !membersQuery.isError ? <>
        <Section title="Travel group" subtitle={`${accepted.length || Math.max(1, trip.memberCount)} accepted traveler${(accepted.length || trip.memberCount) === 1 ? "" : "s"}`}>
          {accepted.length ? accepted.map((member) => <MemberRow key={`accepted-${member.id}`} member={member} action={canManage && member.role !== "owner" ? <Pressable onPress={() => confirmRemove(member)} style={s.rowAction}><Ionicons name="person-remove-outline" size={17} color="#C86779"/></Pressable> : null}/>) : <Empty text="Invite friends by the email they use for TRAVA."/>}
        </Section>
        <Section title="Pending invitations" subtitle={pending.length ? "Waiting for a response" : "No pending invitations"}>
          {pending.length ? pending.map((member) => <MemberRow key={`pending-${member.id}`} member={member} pending action={canManage ? <Pressable onPress={() => confirmRemove(member)} style={s.rowAction}><Ionicons name="close" size={18} color="#C86779"/></Pressable> : null}/>) : <Empty text="Everyone you invited has responded."/>}
        </Section>
      </> : null}
    </View></ScrollView>
    <InviteModal key={inviteOpen ? "invite-modal-open" : "invite-modal-idle"} visible={inviteOpen} saving={invite.isPending} onClose={() => setInviteOpen(false)} onInvite={(email) => invite.mutate(email)}/>
  </ScreenShell></SafeAreaView>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <View style={s.section}><View><Text style={s.sectionTitle}>{title}</Text><Text style={s.sectionSub}>{subtitle}</Text></View><View style={s.list}>{children}</View></View>;
}
function MemberRow({ member, pending, action }: { member: TripMember; pending?: boolean; action?: ReactNode }) {
  return <Glass style={s.member}><View style={s.avatar}>{member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} contentFit="cover" style={StyleSheet.absoluteFillObject}/> : <Text style={s.avatarText}>{member.fullName.slice(0,1).toUpperCase()}</Text>}</View><View style={s.memberCopy}><View style={s.nameRow}><Text style={s.memberName}>{member.fullName}</Text>{member.role === "owner" ? <View style={s.ownerPill}><Text style={s.ownerText}>OWNER</Text></View> : null}</View><Text style={s.memberMeta}>{member.email ?? "TRAVA traveler"}</Text></View>{pending ? <View style={s.pendingPill}><Ionicons name="time-outline" size={13} color="#A27657"/><Text style={s.pendingText}>Pending</Text></View> : <View style={s.onlinePill}><View style={s.miniDot}/><Text style={s.onlineText}>Member</Text></View>}{action}</Glass>;
}
function Empty({ text }: { text: string }) { return <View style={s.empty}><Ionicons name="people-outline" size={26} color="#8BA7C9"/><Text style={s.emptyText}>{text}</Text></View>; }
function InviteModal({ visible, saving, onClose, onInvite }: { visible: boolean; saving: boolean; onClose(): void; onInvite(email: string): void }) {
  const [email, setEmail] = useState(""); const [error, setError] = useState<string | null>(null);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>Invite a travel buddy</Text><Text style={s.modalSub}>Use the email attached to their TRAVA account.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><Text style={s.label}>Email address</Text><TextInput autoFocus autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="friend@example.com" placeholderTextColor="#99A4B7" style={s.input}/>{error ? <Text style={s.formError}>{error}</Text> : null}<View style={s.modalBtns}><Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => { const normalized = email.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(normalized)) { setError("Enter a valid email address."); return; } setError(null); onInvite(normalized); }} style={s.sendPress}><LinearGradient colors={["#75AFE9", "#A6AFE9", "#EC9ABB"]} style={s.send}>{saving ? <ActivityIndicator color="#FFF"/> : <><Ionicons name="send" size={16} color="#FFF"/><Text style={s.sendText}>Send invite</Text></>}</LinearGradient></Pressable></View></View></View></Modal>;
}
function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:22,paddingBottom:130},max:{width:"100%",maxWidth:640,alignSelf:"center",gap:16},liveCard:{minHeight:112,padding:18,borderRadius:28,flexDirection:"row",alignItems:"center",gap:13,borderWidth:1,borderColor:"#E2EAF4",boxShadow:"0 14px 32px rgba(70,86,116,.09)"},liveIcon:{width:56,height:56,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.85)",borderWidth:1,borderColor:"#E5ECF4"},statusDot:{position:"absolute",right:3,bottom:3,width:11,height:11,borderRadius:6,backgroundColor:"#4FC89A",borderWidth:2,borderColor:"#FFF"},statusOffline:{backgroundColor:"#E99AA9"},liveCopy:{flex:1},liveTitle:{color:PX.ink,fontSize:17,fontWeight:"900"},liveText:{marginTop:4,color:"#637393",fontSize:10,lineHeight:15,fontWeight:"700"},invite:{height:43,paddingHorizontal:13,borderRadius:16,flexDirection:"row",alignItems:"center",gap:6,backgroundColor:"#6495D1"},inviteText:{color:"#FFF",fontSize:10,fontWeight:"900"},infoCard:{padding:14,borderRadius:20,flexDirection:"row",alignItems:"flex-start",gap:10},infoText:{flex:1,color:"#62708B",fontSize:9,lineHeight:15,fontWeight:"600"},loading:{padding:30,alignItems:"center",gap:8},loadingText:{color:PX.muted,fontSize:10,fontWeight:"700"},errorCard:{padding:14,borderRadius:20,flexDirection:"row",alignItems:"center",gap:10},errorTitle:{color:PX.ink,fontSize:11,fontWeight:"900"},errorText:{marginTop:3,color:PX.muted,fontSize:9,fontWeight:"600"},retry:{paddingHorizontal:11,paddingVertical:8,borderRadius:12,backgroundColor:"#EAF4FF"},retryText:{color:"#527BB4",fontSize:9,fontWeight:"900"},section:{gap:10},sectionTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},sectionSub:{marginTop:3,color:PX.muted,fontSize:9,fontWeight:"600"},list:{gap:8},member:{minHeight:70,padding:10,borderRadius:20,flexDirection:"row",alignItems:"center",gap:10},avatar:{width:46,height:46,borderRadius:23,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#E6F1FF"},avatarText:{color:"#527BB4",fontSize:16,fontWeight:"900"},memberCopy:{flex:1,minWidth:0},nameRow:{flexDirection:"row",alignItems:"center",gap:7},memberName:{color:PX.ink,fontSize:12,fontWeight:"900"},memberMeta:{marginTop:4,color:PX.muted,fontSize:9,fontWeight:"600"},ownerPill:{paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:"#EDF5FF"},ownerText:{color:"#5C83B7",fontSize:7,fontWeight:"900"},onlinePill:{paddingHorizontal:8,paddingVertical:5,borderRadius:12,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#EDF8F4"},miniDot:{width:6,height:6,borderRadius:3,backgroundColor:"#4FC89A"},onlineText:{color:"#4F9078",fontSize:8,fontWeight:"900"},pendingPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:12,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#FFF5EB"},pendingText:{color:"#A27657",fontSize:8,fontWeight:"900"},rowAction:{width:34,height:34,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF4F6"},empty:{minHeight:90,borderRadius:20,alignItems:"center",justifyContent:"center",gap:6,backgroundColor:"#F8FAFD",borderWidth:1,borderColor:"#E9EEF4"},emptyText:{color:PX.muted,fontSize:9,fontWeight:"600"},backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:22,backgroundColor:"rgba(12,18,38,.42)"},modal:{width:"100%",maxWidth:440,padding:20,borderRadius:26,backgroundColor:"#FFF"},modalHead:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},modalTitle:{color:PX.ink,fontSize:19,fontWeight:"900"},modalSub:{marginTop:4,color:PX.muted,fontSize:9,fontWeight:"600"},close:{width:36,height:36,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F7FA"},label:{marginTop:15,marginBottom:6,color:"#526079",fontSize:9,fontWeight:"900"},input:{height:50,paddingHorizontal:14,borderRadius:16,backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E6EBF2",color:PX.ink,fontSize:11,fontWeight:"700"},formError:{marginTop:8,color:"#C46172",fontSize:9,fontWeight:"700"},modalBtns:{marginTop:16,flexDirection:"row",gap:8},cancel:{flex:1,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EEF0F5"},cancelText:{color:PX.muted,fontSize:9,fontWeight:"900"},sendPress:{flex:1.6},send:{height:46,borderRadius:14,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},sendText:{color:"#FFF",fontSize:9,fontWeight:"900"},
});
