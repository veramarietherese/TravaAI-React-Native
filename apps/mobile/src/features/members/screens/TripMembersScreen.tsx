import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripMember } from "@trava/shared";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenShell } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";
import { TravaButton } from "@/components/ui/TravaButton";
import {
  inviteTripMember,
  listTripMembers,
  removeTripMember,
  searchTripMemberDirectory,
  type DirectoryTraveler,
} from "../api/members.api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function TripMembersScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "local-japan");
  const isSyncedTrip = UUID_RE.test(tripId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { trip } = useTripLite(tripId);
  const { syncStatus, onlineUserIds } = useLocalTripWorkspace(tripId);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<DirectoryTraveler[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), 220);
    return () => clearTimeout(timer);
  }, [searchText]);

  const membersQuery = useQuery({
    queryKey: ["trip-members", tripId],
    queryFn: () => listTripMembers(tripId),
    enabled: isSyncedTrip,
    staleTime: 10_000,
  });

  const members = membersQuery.data?.members ?? [];
  const canManage = isSyncedTrip && Boolean(membersQuery.data?.canManage);

  const directoryQuery = useQuery({
    queryKey: ["trip-member-directory", tripId, debouncedSearch],
    queryFn: () => searchTripMemberDirectory(tripId, debouncedSearch),
    enabled: canManage && debouncedSearch.length >= 2,
    staleTime: 15_000,
  });

  const selectedIds = useMemo(() => new Set(selected.map((person) => person.id)), [selected]);
  const existingIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);
  const suggestions = useMemo(
    () =>
      (directoryQuery.data ?? []).filter(
        (person) => !selectedIds.has(person.id) && !existingIds.has(person.id),
      ),
    [directoryQuery.data, existingIds, selectedIds],
  );

  const orderedMembers = useMemo(() => {
    const weight = (member: TripMember) => {
      if (member.role === "owner") return 0;
      if (member.status === "accepted") return 1;
      if (member.status === "pending") return 2;
      return 3;
    };
    return [...members].sort((a, b) => weight(a) - weight(b));
  }, [members]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trip-members", tripId] }),
      queryClient.invalidateQueries({ queryKey: ["trips"] }),
    ]);
  };

  const inviteMutation = useMutation({
    mutationFn: async (people: DirectoryTraveler[]) => {
      const outcomes: { person: DirectoryTraveler; ok: boolean; message: string }[] = [];
      for (const person of people) {
        try {
          const serverMessage = await inviteTripMember(tripId, person.email);
          outcomes.push({ person, ok: true, message: serverMessage });
        } catch (error) {
          outcomes.push({ person, ok: false, message: errorMessage(error) });
        }
      }
      return outcomes;
    },
    onSuccess: async (outcomes) => {
      const successCount = outcomes.filter((item) => item.ok).length;
      const failed = outcomes.filter((item) => !item.ok);
      await refresh();
      setSelected([]);
      setSearchText("");
      setDebouncedSearch("");

      if (!failed.length) {
        Alert.alert(
          successCount === 1 ? "Invitation sent" : "Invitations sent",
          `${successCount} traveler${successCount === 1 ? "" : "s"} invited to ${trip.name || "this trip"}.`,
        );
        return;
      }

      Alert.alert(
        "Some invitations could not be sent",
        `${successCount} sent. ${failed.map((item) => `${item.person.fullName}: ${item.message}`).join("\n")}`,
      );
    },
    onError: (error) => Alert.alert("Invite travelers", errorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeTripMember(tripId, memberId),
    onSuccess: refresh,
    onError: (error) => Alert.alert("Trip access", errorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) => inviteTripMember(tripId, email),
    onSuccess: async (serverMessage) => {
      await refresh();
      Alert.alert("Invitation resent", serverMessage);
    },
    onError: (error) => Alert.alert("Resend invitation", errorMessage(error)),
  });

  const tripLink = useMemo(() => {
    if (Platform.OS === "web") {
      const maybeWindow = globalThis as unknown as {
        location?: { origin?: string };
      };
      const origin = maybeWindow.location?.origin;
      if (origin) return `${origin}/trip/${encodeURIComponent(tripId)}`;
    }
    return Linking.createURL(`/trip/${tripId}`);
  }, [tripId]);

  async function copyTripLink() {
    try {
      if (Platform.OS === "web") {
        const root = globalThis as unknown as {
          navigator?: { clipboard?: { writeText(value: string): Promise<void> } };
        };
        if (root.navigator?.clipboard?.writeText) {
          await root.navigator.clipboard.writeText(tripLink);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
          return;
        }
      }

      await Share.share({
        message: `Join my TRAVA trip: ${tripLink}`,
        url: tripLink,
        title: `Join ${trip.name || "my trip"} on TRAVA`,
      });
    } catch (error) {
      Alert.alert("Share trip", errorMessage(error));
    }
  }

  function addSuggestion(person: DirectoryTraveler) {
    setSelected((current) =>
      current.some((item) => item.id === person.id) ? current : [...current, person],
    );
    setSearchText("");
    setDebouncedSearch("");
  }

  function removeSelected(personId: string) {
    setSelected((current) => current.filter((person) => person.id !== personId));
  }

  function openMemberActions(member: TripMember) {
    if (!canManage) {
      Alert.alert("Trip access", "Only the trip owner can manage collaborators.");
      return;
    }

    if (member.role === "owner") {
      Alert.alert("Trip owner", "The trip owner always retains access to this workspace.");
      return;
    }

    if (member.status === "pending") {
      const actions: AlertButton[] = [
        { text: "Close", style: "cancel" },
      ];
      if (member.email) {
        actions.push({
          text: "Resend invite",
          onPress: () => resendMutation.mutate(member.email as string),
        });
      }
      actions.push({
        text: "Cancel invitation",
        style: "destructive",
        onPress: () => removeMutation.mutate(member.id),
      });
      Alert.alert(member.fullName, "Manage this pending invitation.", actions);
      return;
    }

    Alert.alert(member.fullName, "Manage this traveler’s trip access.", [
      { text: "Close", style: "cancel" },
      {
        text: "Remove from trip",
        style: "destructive",
        onPress: () => removeMutation.mutate(member.id),
      },
    ]);
  }

  const inviteDisabled = !canManage || !selected.length || inviteMutation.isPending;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScreenShell tripId={tripId} title={trip.name || "Trip"}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.max}>
            <View style={s.panel}>
              <View style={s.headerRow}>
                <View>
                  <Text style={s.heading}>Invite Travelers</Text>
                  {!isSyncedTrip ? (
                    <Text style={s.localHint}>
                      Open a synced trip to invite registered TRAVA travelers.
                    </Text>
                  ) : !canManage && !membersQuery.isLoading ? (
                    <Text style={s.localHint}>
                      You can view collaborators, but only the trip owner can invite or remove them.
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close collaboration"
                  onPress={() => router.replace(`/trip/${tripId}` as Href)}
                  style={({ pressed }) => [s.closeButton, pressed && s.pressed]}
                >
                  <Ionicons name="close" size={26} color="#111318" />
                </Pressable>
              </View>

              <View style={s.searchArea}>
                <View style={[s.peopleInput, !canManage && s.disabledInput]}>
                  {selected.map((person) => (
                    <View key={person.id} style={s.personChip}>
                      <Avatar person={person} size={34} />
                      <Text numberOfLines={1} style={s.personChipText}>
                        {person.fullName}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${person.fullName}`}
                        onPress={() => removeSelected(person.id)}
                        style={s.chipRemove}
                      >
                        <Ionicons name="close" size={16} color="#3D4350" />
                      </Pressable>
                    </View>
                  ))}

                  <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    editable={canManage}
                    autoCapitalize="words"
                    autoCorrect={false}
                    placeholder={
                      canManage
                        ? selected.length
                          ? "Add another traveler"
                          : "Type a traveler name or email"
                        : "Trip owner invitation access only"
                    }
                    placeholderTextColor="#A1A6B2"
                    style={s.searchInput}
                  />

                  {directoryQuery.isFetching ? (
                    <ActivityIndicator size="small" color="#745EF6" />
                  ) : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Invite selected travelers"
                  disabled={inviteDisabled}
                  onPress={() => inviteMutation.mutate(selected)}
                  style={({ pressed }) => [
                    s.inviteButtonWrap,
                    inviteDisabled && s.disabledButton,
                    pressed && !inviteDisabled && s.pressed,
                  ]}
                >
                  <LinearGradient
                    colors={["#9A63F7", "#6652F6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.inviteButton}
                  >
                    {inviteMutation.isPending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={s.inviteText}>Invite</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                {canManage && debouncedSearch.length >= 2 ? (
                  <View style={s.dropdown}>
                    {directoryQuery.isError ? (
                      <View style={s.dropdownMessageRow}>
                        <Ionicons name="alert-circle-outline" size={18} color="#C86B7E" />
                        <Text style={s.dropdownMessage}>
                          {errorMessage(directoryQuery.error)}
                        </Text>
                      </View>
                    ) : directoryQuery.isFetching && !directoryQuery.data ? (
                      <View style={s.dropdownMessageRow}>
                        <ActivityIndicator size="small" color="#745EF6" />
                        <Text style={s.dropdownMessage}>Searching TRAVA travelers…</Text>
                      </View>
                    ) : suggestions.length ? (
                      suggestions.map((person) => (
                        <Pressable
                          key={person.id}
                          onPress={() => addSuggestion(person)}
                          style={({ pressed }) => [
                            s.suggestionRow,
                            pressed && s.suggestionPressed,
                          ]}
                        >
                          <Avatar person={person} size={40} />
                          <View style={s.suggestionCopy}>
                            <Text style={s.suggestionName}>{person.fullName}</Text>
                            <Text style={s.suggestionEmail}>{person.email}</Text>
                          </View>
                          <Ionicons name="add-circle" size={22} color="#745EF6" />
                        </Pressable>
                      ))
                    ) : (
                      <View style={s.dropdownMessageRow}>
                        <Ionicons name="search-outline" size={18} color="#8C92A1" />
                        <Text style={s.dropdownMessage}>
                          No available registered traveler matches “{debouncedSearch}”.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>

              <LinearGradient
                colors={["#FBF9FF", "#F7F8FF", "#FFF8FC"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.shareCard}
              >
                <View style={s.linkIconWrap}>
                  <Ionicons name="link-outline" size={34} color="#715BFA" />
                  <View style={s.sparkleDot} />
                </View>
                <View style={s.shareCopy}>
                  <Text style={s.shareTitle}>Shareable trip link is live</Text>
                  <Text style={s.shareSub}>
                    Invite first, then share this secure route to the trip workspace.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Copy trip link"
                  onPress={() => void copyTripLink()}
                  style={({ pressed }) => [s.copyButton, pressed && s.pressed]}
                >
                  <Ionicons
                    name={copied ? "checkmark-circle" : "copy-outline"}
                    size={21}
                    color="#715BFA"
                  />
                  <Text style={s.copyText}>{copied ? "Copied" : "Copy Link"}</Text>
                </Pressable>
              </LinearGradient>

              <View style={s.memberList}>
                {membersQuery.isLoading ? (
                  <View style={s.loadingBlock}>
                    <ActivityIndicator color="#745EF6" />
                    <Text style={s.loadingText}>Loading travelers…</Text>
                  </View>
                ) : membersQuery.isError ? (
                  <View style={s.loadingBlock}>
                    <Ionicons name="alert-circle-outline" size={22} color="#C86B7E" />
                    <Text style={s.loadingText}>{errorMessage(membersQuery.error)}</Text>
                    <Pressable onPress={() => void membersQuery.refetch()} style={s.retryButton}>
                      <Text style={s.retryText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : orderedMembers.length ? (
                  orderedMembers.map((member, index) => (
                    <MemberAccessRow
                      key={member.id}
                      member={member}
                      online={onlineUserIds.includes(member.userId)}
                      isLast={index === orderedMembers.length - 1}
                      onMenu={() => openMemberActions(member)}
                    />
                  ))
                ) : (
                  <View style={s.emptyBlock}>
                    <View style={s.emptyAvatarIcon}>
                      <Ionicons name="people-outline" size={26} color="#7766ED" />
                    </View>
                    <Text style={s.emptyTitle}>No travelers added yet</Text>
                    <Text style={s.emptyText}>
                      {isSyncedTrip
                        ? "Start typing a registered traveler’s name above to invite them."
                        : "This local demo trip has no server-backed collaboration workspace."}
                    </Text>
                  </View>
                )}
              </View>

              <LinearGradient
                colors={["#FBFAFF", "#F8F7FF", "#FFF4F8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.footer}
              >
                <View style={s.shieldCircle}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#715BFA" />
                </View>
                <View style={s.footerCopy}>
                  <Text style={s.footerTitle}>
                    Only invited travelers can access this trip workspace.
                  </Text>
                  <Text style={s.footerText}>
                    The owner can resend invitations or remove access anytime.
                  </Text>
                </View>
                <View pointerEvents="none" style={s.footerArt}>
                  <View style={s.sun} />
                  <View style={[s.mountain, s.mountainBack]} />
                  <View style={[s.mountain, s.mountainFront]} />
                  <View style={s.cloudOne} />
                  <View style={s.cloudTwo} />
                </View>
              </LinearGradient>
            </View>

            <View style={s.syncStrip}>
              <View
                style={[
                  s.syncDot,
                  syncStatus === "offline" && s.syncDotOffline,
                  syncStatus === "connecting" && s.syncDotConnecting,
                ]}
              />
              <Text style={s.syncText}>
                {syncStatus === "live"
                  ? "Trip workspace is syncing live"
                  : syncStatus === "connecting"
                    ? "Connecting to live trip sync…"
                    : syncStatus === "offline"
                      ? "Offline · local workspace remains available"
                      : "Local workspace"}
              </Text>
            </View>
          </View>
        </ScrollView>
      </ScreenShell>
    </SafeAreaView>
  );
}

function Avatar({
  person,
  size,
}: {
  person: { fullName: string; avatarUrl: string | null };
  size: number;
}) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}> 
      {person.avatarUrl ? (
        <Image
          source={{ uri: person.avatarUrl }}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text style={[s.avatarText, { fontSize: Math.max(12, size * 0.36) }]}>
          {person.fullName.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function MemberAccessRow({
  member,
  online,
  isLast,
  onMenu,
}: {
  member: TripMember;
  online: boolean;
  isLast: boolean;
  onMenu(): void;
}) {
  const status = getMemberStatus(member, online);

  return (
    <View style={[s.memberRow, isLast && s.memberRowLast]}>
      <Avatar person={member} size={48} />
      <View style={s.memberCopy}>
        <View style={s.nameLine}>
          <Text numberOfLines={1} style={s.memberName}>
            {member.fullName}
          </Text>
          {member.role === "owner" ? (
            <View style={s.ownerPill}>
              <Text style={s.ownerText}>OWNER</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={s.memberEmail}>
          {member.email ?? "TRAVA traveler"}
        </Text>
      </View>

      <View style={s.statusWrap}>
        <View style={[s.memberStatusDot, { backgroundColor: status.color }]} />
        <Text style={[s.memberStatus, { color: status.color }]}>{status.label}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Manage ${member.fullName}`}
        onPress={onMenu}
        style={({ pressed }) => [s.menuButton, pressed && s.pressed]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color="#171A20" />
      </Pressable>
    </View>
  );
}

function getMemberStatus(member: TripMember, online: boolean) {
  if (member.status === "pending") return { label: "Pending invite", color: "#7358F6" };
  if (member.status === "rejected") return { label: "Inactive", color: "#EA3D46" };
  if (online) return { label: "Online", color: "#20A33A" };
  return { label: "Away", color: "#D18B00" };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 140 },
  max: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14 },
  panel: {
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E9",
    boxShadow: "0 20px 60px rgba(39, 34, 71, 0.09)",
  },
  headerRow: {
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
  },
  heading: { color: "#111318", fontSize: 32, lineHeight: 38, fontWeight: "900", letterSpacing: -1 },
  localHint: { marginTop: 6, maxWidth: 520, color: "#7D8390", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3E4E8",
    backgroundColor: "#FFFFFF",
  },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  searchArea: { zIndex: 20, paddingHorizontal: 28, paddingBottom: 22, flexDirection: "row", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  peopleInput: {
    flex: 1,
    minWidth: 260,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DFE0E6",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  disabledInput: { backgroundColor: "#F7F7F9", opacity: 0.8 },
  personChip: {
    height: 44,
    maxWidth: 210,
    paddingLeft: 5,
    paddingRight: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E3E8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  personChipText: { maxWidth: 115, color: "#15171C", fontSize: 13, fontWeight: "700" },
  chipRemove: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchInput: { flexGrow: 1, minWidth: 150, height: 44, paddingHorizontal: 6, color: "#16181D", fontSize: 16, fontWeight: "600" },
  inviteButtonWrap: { width: 126, height: 64, borderRadius: 25, overflow: "hidden", boxShadow: "0 8px 18px rgba(108, 76, 246, .2)" },
  inviteButton: { flex: 1, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  inviteText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  disabledButton: { opacity: 0.42 },
  dropdown: {
    width: "100%",
    marginTop: -6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E0EE",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    boxShadow: "0 16px 36px rgba(55, 47, 92, .13)",
  },
  suggestionRow: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: "#F0EFF4" },
  suggestionPressed: { backgroundColor: "#F9F8FF" },
  suggestionCopy: { flex: 1, minWidth: 0 },
  suggestionName: { color: "#181A20", fontSize: 13, fontWeight: "800" },
  suggestionEmail: { marginTop: 3, color: "#8A8F9B", fontSize: 10, fontWeight: "600" },
  dropdownMessageRow: { minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 9 },
  dropdownMessage: { flex: 1, color: "#757B88", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  shareCard: {
    marginHorizontal: 28,
    marginBottom: 18,
    minHeight: 116,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DCD5FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  linkIconWrap: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: "#FAF8FF", borderWidth: 1, borderColor: "#DFDAFF" },
  sparkleDot: { position: "absolute", right: 10, top: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: "#8E70FF" },
  shareCopy: { flex: 1, minWidth: 0 },
  shareTitle: { color: "#16181E", fontSize: 18, fontWeight: "900" },
  shareSub: { marginTop: 6, color: "#747A88", fontSize: 11, lineHeight: 16, fontWeight: "600" },
  copyButton: { height: 48, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: "#7860F7", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,.72)" },
  copyText: { color: "#715BFA", fontSize: 14, fontWeight: "800" },
  memberList: { paddingHorizontal: 28 },
  memberRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#ECECEF" },
  memberRowLast: { borderBottomWidth: 0 },
  avatar: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#ECEBF7", borderWidth: 1, borderColor: "#E1E1E8" },
  avatarText: { color: "#5F55A8", fontWeight: "900" },
  memberCopy: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  memberName: { maxWidth: 210, color: "#15171C", fontSize: 15, fontWeight: "900" },
  memberEmail: { marginTop: 4, color: "#969BA6", fontSize: 11, fontWeight: "600" },
  ownerPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: "#F0ECFF" },
  ownerText: { color: "#6E59ED", fontSize: 7, fontWeight: "900", letterSpacing: 0.4 },
  statusWrap: { minWidth: 112, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  memberStatusDot: { width: 8, height: 8, borderRadius: 4 },
  memberStatus: { fontSize: 12, fontWeight: "700" },
  menuButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#E3E4E8", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  loadingBlock: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 9 },
  loadingText: { color: "#777D89", fontSize: 11, fontWeight: "600", textAlign: "center" },
  retryButton: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: "#F1EFFF" },
  retryText: { color: "#6F5BE7", fontSize: 10, fontWeight: "900" },
  emptyBlock: { minHeight: 180, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyAvatarIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F0FF" },
  emptyTitle: { marginTop: 12, color: "#1A1C21", fontSize: 15, fontWeight: "900" },
  emptyText: { marginTop: 5, maxWidth: 360, color: "#858A95", fontSize: 10, lineHeight: 15, fontWeight: "600", textAlign: "center" },
  footer: { marginTop: 12, minHeight: 104, paddingHorizontal: 28, paddingVertical: 18, borderTopWidth: 1, borderTopColor: "#E9E6F3", flexDirection: "row", alignItems: "center", gap: 13, overflow: "hidden" },
  shieldCircle: { zIndex: 2, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2DFFF" },
  footerCopy: { zIndex: 2, flex: 1, minWidth: 0 },
  footerTitle: { color: "#20232A", fontSize: 12, fontWeight: "800" },
  footerText: { marginTop: 4, color: "#767C89", fontSize: 10, fontWeight: "600" },
  footerArt: { position: "absolute", right: 0, bottom: 0, width: 250, height: 95, opacity: 0.8 },
  sun: { position: "absolute", right: 72, top: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFB7D2" },
  mountain: { position: "absolute", bottom: -1, width: 0, height: 0, borderLeftWidth: 64, borderRightWidth: 64, borderBottomWidth: 0, borderLeftColor: "transparent", borderRightColor: "transparent" },
  mountainBack: { right: 40, borderTopWidth: 70, borderTopColor: "#DCD7FF" },
  mountainFront: { right: -6, borderLeftWidth: 86, borderRightWidth: 86, borderTopWidth: 58, borderTopColor: "#C9C0FF" },
  cloudOne: { position: "absolute", right: 142, top: 38, width: 28, height: 9, borderRadius: 6, backgroundColor: "rgba(255,255,255,.86)" },
  cloudTwo: { position: "absolute", right: 18, top: 44, width: 36, height: 10, borderRadius: 6, backgroundColor: "rgba(255,255,255,.86)" },
  syncStrip: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F7F7F9" },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#35B980" },
  syncDotOffline: { backgroundColor: "#E27B8F" },
  syncDotConnecting: { backgroundColor: "#D39C35" },
  syncText: { color: "#737985", fontSize: 9, fontWeight: "700" },
});
