import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TravaGlassNav } from "@/components/navigation/TravaGlassNav";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { apiRequest } from "@/lib/api-client";
import { createTrip } from "../api/trips.api";

type DestinationChoice = {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

type PendingCollaborator = { email: string; fullName: string; avatarUrl: string | null; role: "Editor" | "Viewer" };
type ResolvedCollaborator = { email: string; fullName: string; avatarUrl: string | null };
type CalendarTarget = "start" | "end";

const DEFAULT_DESTINATIONS: DestinationChoice[] = [
  { id: "tokyo", name: "Tokyo", displayName: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
  { id: "osaka", name: "Osaka", displayName: "Osaka, Japan", latitude: 34.6937, longitude: 135.5023 },
  { id: "cebu", name: "Cebu", displayName: "Cebu, Philippines", latitude: 10.3157, longitude: 123.8854 },
  { id: "seoul", name: "Seoul", displayName: "Seoul, South Korea", latitude: 37.5665, longitude: 126.978 },
  { id: "switzerland", name: "Switzerland", displayName: "Switzerland", latitude: 46.8182, longitude: 8.2275 },
];

export function CreateTripScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const today = useMemo(() => atNoon(new Date()), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const [destination, setDestination] = useState("");
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationResults, setDestinationResults] = useState<DestinationChoice[]>(DEFAULT_DESTINATIONS.slice(0, 4));
  const [destinationLoading, setDestinationLoading] = useState(false);
  const searchRequest = useRef(0);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>("end");
  const [monthCursor, setMonthCursor] = useState(startOfMonth(today));

  const [optionalOpen, setOptionalOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [flightNumber, setFlightNumber] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [resolvedCollaborator, setResolvedCollaborator] = useState<ResolvedCollaborator | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupChecked, setLookupChecked] = useState(false);
  const [collaborators, setCollaborators] = useState<PendingCollaborator[]>([]);
  const [permissionMode, setPermissionMode] = useState(false);
  const [linkAccess, setLinkAccess] = useState<"Anyone with link" | "Invited only">("Anyone with link");
  const shareLink = "https://trava.app/trip/new";

  useEffect(() => {
    const q = destination.trim();
    if (!destinationOpen) return;
    if (q.length < 2) {
      setDestinationResults(DEFAULT_DESTINATIONS.slice(0, 4));
      setDestinationLoading(false);
      return;
    }
    const requestId = ++searchRequest.current;
    const timer = setTimeout(async () => {
      setDestinationLoading(true);
      try {
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=7`);
        if (!response.ok) throw new Error("search failed");
        const json = (await response.json()) as {
          features?: Array<{
            geometry?: { coordinates?: [number, number] };
            properties?: Record<string, string | number | null | undefined>;
          }>;
        };
        if (requestId !== searchRequest.current) return;
        const mapped = (json.features ?? []).flatMap((feature, index) => {
          const coords = feature.geometry?.coordinates;
          if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return [];
          const p = feature.properties ?? {};
          const name = String(p.name ?? p.city ?? p.state ?? p.country ?? "Destination");
          const parts = [p.name, p.city, p.state, p.country]
            .filter((part, i, arr) => part && arr.indexOf(part) === i)
            .map(String);
          return [{
            id: String(p.osm_id ?? `${coords[1]}-${coords[0]}-${index}`),
            name,
            displayName: parts.join(", ") || name,
            latitude: coords[1],
            longitude: coords[0],
          } satisfies DestinationChoice];
        });
        setDestinationResults(mapped.length ? mapped : DEFAULT_DESTINATIONS.filter((item) => item.displayName.toLowerCase().includes(q.toLowerCase())));
      } catch {
        if (requestId !== searchRequest.current) return;
        setDestinationResults(DEFAULT_DESTINATIONS.filter((item) => item.displayName.toLowerCase().includes(q.toLowerCase())));
      } finally {
        if (requestId === searchRequest.current) setDestinationLoading(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [destination, destinationOpen]);

  useEffect(() => {
    setResolvedCollaborator(null);
    setLookupChecked(false);
  }, [inviteEmail]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Your session has expired. Please sign in again.");
      if (!destination.trim()) throw new Error("Choose a destination first.");
      if (endDate < startDate) throw new Error("End date must be on or after the start date.");
      const trip = await createTrip({
        name: `${destination.split(",")[0].trim()} Trip`,
        destination: destination.trim(),
        description: notes.trim() || null,
        startDate: isoDate(startDate),
        endDate: isoDate(endDate),
        totalBudget: Number(budget || 0),
        currencyCode: "PHP",
        travelStyle: null,
        travelGroup: collaborators.length ? "Group" : null,
        coverStoragePath: null,
        status: "upcoming",
        flightNumber: flightNumber.trim().toUpperCase() || null,
        flightDate: flightNumber.trim() ? isoDate(startDate) : null,
      });
      const inviteFailures: string[] = [];
      for (const collaborator of collaborators) {
        try {
          await apiRequest(`/api/trips/${trip.id}/members/invite`, {
            method: "POST",
            body: JSON.stringify({ email: collaborator.email }),
          });
        } catch {
          inviteFailures.push(collaborator.email);
        }
      }
      return { trip, inviteFailures };
    },
    onSuccess: async ({ trip, inviteFailures }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trips"] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
      if (inviteFailures.length) {
        Alert.alert("Trip created", `Trip created, but ${inviteFailures.length} collaborator invite${inviteFailures.length === 1 ? "" : "s"} could not be sent.`);
      }
      router.replace(`/trip/${trip.id}` as Href);
    },
    onError: (error) => Alert.alert("Create trip", error instanceof Error ? error.message : "Unable to create this trip."),
  });

  const dayCount = Math.max(1, Math.round((atNoon(endDate).getTime() - atNoon(startDate).getTime()) / 86400000) + 1);
  const monthRight = monthCursor;

  function selectDate(date: Date) {
    if (calendarTarget === "start") {
      setStartDate(date);
      if (date > endDate) setEndDate(addDays(date, 1));
      setCalendarTarget("end");
      setMonthCursor(startOfMonth(date));
    } else {
      if (date < startDate) {
        setStartDate(date);
        setEndDate(addDays(date, 1));
      } else {
        setEndDate(date);
      }
      setCalendarOpen(false);
    }
  }

  async function lookupCollaborator() {
    const identity = inviteEmail.trim();
    if (identity.length < 3) {
      Alert.alert("Find collaborator", "Finish typing the exact email address or full TRAVA name first.");
      return;
    }
    setLookupLoading(true);
    setLookupChecked(false);
    setResolvedCollaborator(null);
    try {
      const result = await apiRequest<{ data: ResolvedCollaborator | null }>(`/api/trips/member-directory/resolve?identity=${encodeURIComponent(identity)}`);
      setResolvedCollaborator(result.data);
      setLookupChecked(true);
    } catch (error) {
      setLookupChecked(true);
      Alert.alert("Find collaborator", error instanceof Error ? error.message : "Unable to search TRAVA travelers.");
    } finally {
      setLookupLoading(false);
    }
  }

  function addCollaborator(person = resolvedCollaborator) {
    if (!person) {
      Alert.alert("Invite collaborator", "Search for an exact registered TRAVA traveler first.");
      return;
    }
    const email = person.email.trim().toLowerCase();
    if (email === user?.email?.toLowerCase() || collaborators.some((item) => item.email === email)) {
      Alert.alert("Invite collaborator", "That traveler is already included.");
      return;
    }
    setCollaborators((current) => [...current, { email, fullName: person.fullName, avatarUrl: person.avatarUrl, role: "Editor" }]);
    setInviteEmail("");
    setResolvedCollaborator(null);
    setLookupChecked(false);
  }

  function cycleRole(email: string) {
    setCollaborators((current) => current.map((item) => item.email === email ? { ...item, role: item.role === "Editor" ? "Viewer" : "Editor" } : item));
  }

  async function copyOrShareLink() {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareLink);
        Alert.alert("Link copied", "The collaboration link was copied to your clipboard.");
      } else {
        await Share.share({ message: shareLink });
      }
    } catch {
      Alert.alert("Share link", shareLink);
    }
  }

  const avatarUrl = profile?.avatar_url || (typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null);
  const ownerName = profile?.full_name || user?.user_metadata?.full_name || "You";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.max}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><Ionicons name="chevron-back" size={25} color="#1C2942" /></Pressable>
            <Text style={styles.pageTitle}>Create Trip</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.label}>Destination</Text>
          <View style={[styles.destinationField, destinationOpen && styles.destinationFieldFocused]}>
            <Ionicons name="location-outline" size={24} color="#6E7E9B" />
            <TextInput
              value={destination}
              onFocus={() => setDestinationOpen(true)}
              onChangeText={(text) => { setDestination(text); setDestinationOpen(true); }}
              placeholder="Search destinations, places or activities…"
              placeholderTextColor="#8A97AE"
              autoCorrect={false}
              style={styles.destinationInput}
            />
            {destinationLoading ? <ActivityIndicator size="small" color="#668FF0" /> : destination ? <Pressable onPress={() => { setDestination(""); setDestinationOpen(true); }}><Ionicons name="close-circle" size={21} color="#A1A9B9" /></Pressable> : null}
          </View>
          {destinationOpen ? <View style={styles.destinationDropdown}>
            {destinationResults.slice(0, 6).map((item) => <Pressable key={item.id} onPress={() => { setDestination(item.displayName); setDestinationOpen(false); }} style={styles.destinationRow}>
              <View style={styles.destinationIcon}><Ionicons name="location" size={17} color="#648CEB" /></View>
              <View style={styles.destinationCopy}><Text style={styles.destinationName}>{item.name}</Text><Text numberOfLines={1} style={styles.destinationAddress}>{item.displayName}</Text></View>
              <Ionicons name="chevron-forward" size={17} color="#B4BDCC" />
            </Pressable>)}
          </View> : null}

          <View style={styles.dateRow}>
            <DateField label="Start" date={startDate} active={calendarOpen && calendarTarget === "start"} onPress={() => { const same = calendarOpen && calendarTarget === "start"; setCalendarTarget("start"); setCalendarOpen(!same); setMonthCursor(startOfMonth(startDate)); }} />
            <DateField label="End" date={endDate} active={calendarOpen && calendarTarget === "end"} onPress={() => { const same = calendarOpen && calendarTarget === "end"; setCalendarTarget("end"); setCalendarOpen(!same); setMonthCursor(startOfMonth(endDate)); }} clearable onClear={() => setEndDate(addDays(startDate, 1))} />
          </View>

          {calendarOpen ? <View style={styles.calendarPanel}>
            <View style={styles.calendarColumns}>
              <CalendarMonth
                month={monthCursor}
                start={startDate}
                end={endDate}
                onPrevious={() => setMonthCursor((current) => addMonths(current, -1))}
                onNext={() => setMonthCursor((current) => addMonths(current, 1))}
                onSelect={selectDate}
              />
              <View style={styles.calendarDivider} />
              <CalendarMonth
                month={monthRight}
                start={startDate}
                end={endDate}
                onPrevious={() => setMonthCursor((current) => addMonths(current, -1))}
                onNext={() => setMonthCursor((current) => addMonths(current, 1))}
                onSelect={selectDate}
              />
            </View>
            <View style={styles.rangeSummary}><Ionicons name="calendar-outline" size={20} color="#684BFF" /><Text style={styles.rangeText}>{shortDate(startDate)} – {shortDate(endDate)} {endDate.getFullYear()}</Text><View style={styles.rangeDot} /><Text style={styles.rangeDays}>{dayCount} {dayCount === 1 ? "day" : "days"}</Text></View>
          </View> : null}

          <Pressable onPress={() => setOptionalOpen((value) => !value)} style={styles.optionalToggle}>
            <LinearGradient colors={["#F3EEFF", "#F6F4FF"]} style={styles.optionalIcon}><Ionicons name="options-outline" size={22} color="#7758FF" /></LinearGradient>
            <View style={styles.optionalCopy}><Text style={styles.optionalTitle}>Optional trip details</Text><Text style={styles.optionalSub}>Budget, cover photo, flight, notes</Text></View>
            <Ionicons name={optionalOpen ? "chevron-up" : "chevron-down"} size={22} color="#50617D" />
          </Pressable>
          {optionalOpen ? <View style={styles.optionalPanel}>
            <View style={styles.optionalInputRow}><Ionicons name="wallet-outline" size={19} color="#71809A" /><TextInput value={budget} onChangeText={(text) => setBudget(text.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="Budget (PHP)" placeholderTextColor="#98A3B5" style={styles.optionalInput} /></View>
            <View style={styles.optionalInputRow}><Ionicons name="airplane-outline" size={19} color="#71809A" /><TextInput value={flightNumber} onChangeText={setFlightNumber} autoCapitalize="characters" placeholder="Flight number (optional)" placeholderTextColor="#98A3B5" style={styles.optionalInput} /></View>
            <View style={[styles.optionalInputRow, styles.notesRow]}><Ionicons name="document-text-outline" size={19} color="#71809A" /><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Notes (optional)" placeholderTextColor="#98A3B5" style={[styles.optionalInput, styles.notesInput]} /></View>
          </View> : null}

          <View style={styles.collabCard}>
            <View style={styles.collabHeader}><Text style={styles.collabTitle}>Collaborate</Text><Pressable onPress={() => setPermissionMode((value) => !value)}><Text style={styles.manageText}>{permissionMode ? "Done" : "Manage permissions"}</Text></Pressable></View>
            <View style={styles.inviteRow}>
              <View style={styles.inviteInputWrap}><Ionicons name="search-outline" size={22} color="#64748D" /><TextInput value={inviteEmail} onChangeText={setInviteEmail} onSubmitEditing={() => void lookupCollaborator()} autoCapitalize="none" autoCorrect={false} placeholder="Exact email or full TRAVA name…" placeholderTextColor="#A0A8B7" style={styles.inviteInput} /></View>
              <Pressable disabled={lookupLoading || inviteEmail.trim().length < 3} onPress={() => void lookupCollaborator()} style={[styles.invitePress, (lookupLoading || inviteEmail.trim().length < 3) && styles.disabled]}><LinearGradient colors={["#87B9FF", "#A8A6F7", "#EE8DBB"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.inviteButton}>{lookupLoading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.inviteButtonText}>Find</Text>}</LinearGradient></Pressable>
            </View>
            {lookupChecked ? <View style={styles.lookupResult}>{resolvedCollaborator ? <Pressable onPress={() => addCollaborator(resolvedCollaborator)} style={styles.lookupPerson}><View style={styles.lookupAvatar}>{resolvedCollaborator.avatarUrl ? <Image source={{uri:resolvedCollaborator.avatarUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Text style={styles.initials}>{resolvedCollaborator.fullName.slice(0,1).toUpperCase()}</Text>}</View><View style={styles.lookupCopy}><Text style={styles.lookupLabel}>Registered TRAVA traveler</Text><Text style={styles.lookupName}>{resolvedCollaborator.fullName}</Text><Text style={styles.lookupEmail}>{resolvedCollaborator.email}</Text></View><View style={styles.lookupAdd}><Ionicons name="add" size={20} color="#FFF"/></View></Pressable> : <View style={styles.lookupEmpty}><Ionicons name="shield-checkmark-outline" size={20} color="#7A8496"/><Text style={styles.lookupEmptyText}>No exact registered user matched. TRAVA does not reveal partial user suggestions.</Text></View>}</View> : null}
            <View style={styles.orRow}><View style={styles.rule} /><Text style={styles.orText}>or share link</Text><View style={styles.rule} /></View>
            <View style={styles.shareRow}>
              <View style={styles.linkIcon}><Ionicons name="link" size={22} color="#3E5CFF" /></View>
              <Text numberOfLines={1} style={styles.linkText}>{shareLink}</Text>
              <Pressable onPress={() => setLinkAccess((value) => value === "Anyone with link" ? "Invited only" : "Anyone with link")} style={styles.accessButton}><Text style={styles.accessText}>{linkAccess}</Text><Ionicons name="chevron-down" size={16} color="#17233D" /></Pressable>
              <Pressable onPress={() => void copyOrShareLink()} style={styles.copyButton}><Ionicons name="copy-outline" size={21} color="#4E5D76" /></Pressable>
            </View>

            <MemberRow avatarUrl={avatarUrl} name={String(ownerName)} secondary={user?.email || ""} role="Owner" roleTone="owner" />
            {collaborators.map((item) => <MemberRow key={item.email} avatarUrl={item.avatarUrl} name={item.fullName} secondary={item.email} role={item.role} roleTone={item.role === "Editor" ? "editor" : "viewer"} editable={permissionMode} onRolePress={() => cycleRole(item.email)} onRemove={() => setCollaborators((current) => current.filter((entry) => entry.email !== item.email))} />)}
            <Pressable onPress={() => setPermissionMode(false)} style={styles.addCollaborator}><View style={styles.addCircle}><Ionicons name="add" size={24} color="#5639F7" /></View><Text style={styles.addCollaboratorText}>Add another collaborator</Text></Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable disabled={mutation.isPending} onPress={() => router.back()} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable disabled={mutation.isPending} onPress={() => mutation.mutate()} style={styles.createPress}>
              <LinearGradient colors={["#76B7F8", "#A1A6F3", "#EF8AB8"]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.createButton, mutation.isPending && styles.disabled]}>
                {mutation.isPending ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.createText}>Create trip</Text><Ionicons name="arrow-forward" size={24} color="#FFF" /></>}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <TravaGlassNav />
    </SafeAreaView>
  );
}

function DateField({ label, date, active, onPress, clearable, onClear }: { label: string; date: Date; active: boolean; onPress(): void; clearable?: boolean; onClear?(): void }) {
  return <View style={styles.dateFieldWrap}><Text style={styles.label}>{label}</Text><Pressable onPress={onPress} style={[styles.dateField, active && styles.dateFieldActive]}><Ionicons name="calendar-outline" size={23} color="#546783" /><Text style={styles.dateText}>{longDate(date)}</Text><View style={styles.dateSpacer}/>{clearable ? <Pressable accessibilityLabel="Reset end date" onPress={(event) => { event.stopPropagation?.(); onClear?.(); }}><Ionicons name="close-circle" size={22} color="#A6ADBC" /></Pressable> : null}</Pressable></View>;
}

function CalendarMonth({ month, start, end, onPrevious, onNext, onSelect }: { month: Date; start: Date; end: Date; onPrevious(): void; onNext(): void; onSelect(date: Date): void }) {
  const cells = calendarCells(month);
  return <View style={styles.calendarMonth}>
    <View style={styles.calendarMonthHeader}><Pressable onPress={onPrevious} style={styles.calendarArrow}><Ionicons name="chevron-back" size={22} color="#17233D" /></Pressable><Text style={styles.calendarMonthTitle}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text><Pressable onPress={onNext} style={styles.calendarArrow}><Ionicons name="chevron-forward" size={22} color="#17233D" /></Pressable></View>
    <View style={styles.weekRow}>{["Su","Mo","Tu","We","Th","Fr","Sa"].map((item) => <Text key={item} style={styles.weekDay}>{item}</Text>)}</View>
    <View style={styles.calendarGrid}>{cells.map((cell, index) => {
      const isStart = sameDay(cell.date, start);
      const isEnd = sameDay(cell.date, end);
      const inRange = cell.date > start && cell.date < end;
      return <Pressable key={`${cell.date.toISOString()}-${index}`} onPress={() => onSelect(cell.date)} style={[styles.dayCell, inRange && styles.dayCellRange, isStart && styles.dayCellStart, isEnd && styles.dayCellEnd]}><Text style={[styles.dayText, !cell.currentMonth && styles.dayTextMuted, (isStart || isEnd) && styles.dayTextSelected]}>{cell.date.getDate()}</Text></Pressable>;
    })}</View>
  </View>;
}

function MemberRow({ avatarUrl, name, secondary, role, roleTone, editable, onRolePress, onRemove }: { avatarUrl?: string | null; name: string; secondary: string; role: string; roleTone: "owner" | "editor" | "viewer"; editable?: boolean; onRolePress?(): void; onRemove?(): void }) {
  const initials = name.split(/[ ._-]+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join("") || "T";
  const badgeStyle = roleTone === "owner" ? styles.role_owner : roleTone === "editor" ? styles.role_editor : styles.role_viewer;
  const badgeTextStyle = roleTone === "owner" ? styles.roleText_owner : roleTone === "editor" ? styles.roleText_editor : styles.roleText_viewer;
  return <View style={styles.memberRow}><View style={styles.memberAvatar}>{avatarUrl ? <Image source={{uri:avatarUrl}} contentFit="cover" style={StyleSheet.absoluteFill}/> : <Text style={styles.initials}>{initials}</Text>}</View><View style={styles.memberCopy}><View style={styles.memberNameRow}><Text numberOfLines={1} style={styles.memberName}>{name}</Text><View style={[styles.roleBadge, badgeStyle]}><Text style={[styles.roleBadgeText, badgeTextStyle]}>{role}</Text></View></View><Text numberOfLines={1} style={styles.memberEmail}>{secondary}</Text></View><Pressable disabled={!editable || roleTone === "owner"} onPress={onRolePress} style={styles.roleAction}><Text style={styles.roleActionText}>{role}</Text>{editable && roleTone !== "owner" ? <Ionicons name="chevron-forward" size={17} color="#6A7890"/> : null}</Pressable>{editable && onRemove ? <Pressable accessibilityLabel="Remove collaborator" onPress={onRemove} style={styles.removeButton}><Ionicons name="close" size={17} color="#C05F72"/></Pressable> : null}</View>;
}

function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1, 12); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate()+days); return atNoon(next); }
function addMonths(date: Date, months: number) { return new Date(date.getFullYear(), date.getMonth()+months, 1, 12); }
function atNoon(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); }
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function isoDate(date: Date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function longDate(date: Date) { return date.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
function shortDate(date: Date) { return date.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
function calendarCells(month: Date) {
  const first = startOfMonth(month);
  const firstShown = addDays(first, -first.getDay());
  return Array.from({length:42},(_,index)=>{ const date=addDays(firstShown,index); return {date,currentMonth:date.getMonth()===month.getMonth()}; });
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFFFFF"}, scroll:{paddingHorizontal:22,paddingTop:8,paddingBottom:150}, max:{width:"100%",maxWidth:820,alignSelf:"center"},
  header:{height:66,flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10}, backButton:{width:52,height:52,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.94)",borderWidth:1,borderColor:"#EEF1F5",boxShadow:"0 10px 24px rgba(31,45,72,.08)"}, pageTitle:{color:"#111A34",fontSize:25,lineHeight:31,fontWeight:"900",letterSpacing:-.4}, headerSpacer:{width:52},
  label:{marginTop:13,marginBottom:8,color:"#475874",fontSize:12,fontWeight:"900"}, destinationField:{minHeight:70,paddingHorizontal:20,borderRadius:20,flexDirection:"row",alignItems:"center",gap:14,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E2E6EE"}, destinationFieldFocused:{borderColor:"#6F5EFF",boxShadow:"0 0 0 1px #2F7BFF"}, destinationInput:{flex:1,minWidth:0,minHeight:66,color:"#111A34",fontSize:15,fontWeight:"700"}, destinationDropdown:{marginTop:7,borderRadius:20,overflow:"hidden",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E6EAF1",boxShadow:"0 15px 35px rgba(39,51,78,.13)",zIndex:50}, destinationRow:{minHeight:62,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#EDF0F5"}, destinationIcon:{width:38,height:38,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#EFF6FF"}, destinationCopy:{flex:1,minWidth:0},destinationName:{color:"#17213B",fontSize:12,fontWeight:"900"},destinationAddress:{marginTop:3,color:"#7C899D",fontSize:9,fontWeight:"600"},
  dateRow:{marginTop:5,flexDirection:"row",gap:14},dateRowCompact:{flexDirection:"column"},dateFieldWrap:{flex:1},dateField:{minHeight:67,paddingHorizontal:18,borderRadius:20,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E2E6EE"},dateFieldActive:{borderColor:"#7157FF",boxShadow:"0 0 0 1px #2F7BFF"},dateText:{color:"#111A34",fontSize:15,fontWeight:"900"},dateSpacer:{flex:1},
  calendarPanel:{marginTop:13,padding:16,borderRadius:24,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E1E6EF",boxShadow:"0 18px 44px rgba(44,59,88,.09)"},calendarColumns:{flexDirection:"row"},calendarColumnsCompact:{flexDirection:"column"},calendarDivider:{width:1,marginHorizontal:10,backgroundColor:"#EEF1F6"},calendarMonth:{flex:1,paddingHorizontal:4},calendarMonthHeader:{height:45,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},calendarArrow:{width:35,height:35,alignItems:"center",justifyContent:"center"},calendarMonthTitle:{color:"#111A34",fontSize:15,fontWeight:"900"},weekRow:{flexDirection:"row",marginTop:4},weekDay:{width:"14.2857%",textAlign:"center",color:"#52617B",fontSize:10,fontWeight:"800"},calendarGrid:{marginTop:5,flexDirection:"row",flexWrap:"wrap"},dayCell:{width:"14.2857%",height:38,alignItems:"center",justifyContent:"center",borderRadius:19},dayCellRange:{backgroundColor:"#EAF2FF"},dayCellStart:{backgroundColor:"#2B79F7"},dayCellEnd:{backgroundColor:"#DDEBFF"},dayText:{color:"#14213A",fontSize:11,fontWeight:"700"},dayTextMuted:{color:"#B5BDCC"},dayTextSelected:{color:"#FFFFFF",fontWeight:"900"},rangeSummary:{marginTop:10,minHeight:44,paddingHorizontal:12,borderRadius:12,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:"#E8ECF3"},rangeText:{color:"#253451",fontSize:11,fontWeight:"700"},rangeDot:{width:4,height:4,borderRadius:2,backgroundColor:"#6952FF"},rangeDays:{color:"#634BFF",fontSize:11,fontWeight:"800"},
  optionalToggle:{marginTop:16,minHeight:75,paddingHorizontal:16,borderRadius:21,flexDirection:"row",alignItems:"center",gap:13,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E2E6EE"},optionalIcon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center"},optionalCopy:{flex:1},optionalTitle:{color:"#17213B",fontSize:13,fontWeight:"900"},optionalSub:{marginTop:4,color:"#697790",fontSize:10,fontWeight:"600"},optionalPanel:{marginTop:9,padding:14,borderRadius:20,gap:10,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E6EAF1"},optionalInputRow:{minHeight:50,paddingHorizontal:13,borderRadius:15,flexDirection:"row",alignItems:"center",gap:9,backgroundColor:"#F8F9FB"},optionalInput:{flex:1,minHeight:48,color:"#17213B",fontSize:11,fontWeight:"700"},notesRow:{alignItems:"flex-start",paddingTop:13},notesInput:{minHeight:76,textAlignVertical:"top"},
  collabCard:{marginTop:14,padding:18,borderRadius:23,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E1E6EF"},collabHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},collabTitle:{color:"#111A34",fontSize:14,fontWeight:"900"},manageText:{color:"#6549FF",fontSize:10,fontWeight:"800"},inviteRow:{marginTop:12,flexDirection:"row",gap:11},inviteInputWrap:{flex:1,minHeight:56,paddingHorizontal:14,borderRadius:17,flexDirection:"row",alignItems:"center",gap:11,borderWidth:1,borderColor:"#E1E6EF"},inviteInput:{flex:1,minHeight:52,color:"#17213B",fontSize:11,fontWeight:"700"},invitePress:{width:138},inviteButton:{flex:1,minHeight:56,borderRadius:17,alignItems:"center",justifyContent:"center"},inviteButtonText:{color:"#FFF",fontSize:12,fontWeight:"900"},lookupResult:{marginTop:8,borderRadius:17,overflow:"hidden",borderWidth:1,borderColor:"#E3E8F0",backgroundColor:"#FAFBFD"},lookupPerson:{minHeight:72,padding:10,flexDirection:"row",alignItems:"center",gap:11},lookupAvatar:{width:46,height:46,borderRadius:23,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#E7ECF5"},lookupCopy:{flex:1,minWidth:0},lookupLabel:{color:"#7B879A",fontSize:8,fontWeight:"800",textTransform:"uppercase",letterSpacing:.5},lookupName:{marginTop:2,color:"#17213B",fontSize:12,fontWeight:"900"},lookupEmail:{marginTop:2,color:"#7C899C",fontSize:9,fontWeight:"600"},lookupAdd:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"#5B68E8"},lookupEmpty:{minHeight:60,padding:12,flexDirection:"row",alignItems:"center",gap:8},lookupEmptyText:{flex:1,color:"#727D90",fontSize:9,lineHeight:14,fontWeight:"650"},orRow:{marginVertical:14,flexDirection:"row",alignItems:"center",gap:14},rule:{height:1,flex:1,backgroundColor:"#E0E5EC"},orText:{color:"#17213B",fontSize:10,fontWeight:"700"},shareRow:{minHeight:55,flexDirection:"row",alignItems:"center",gap:10,borderRadius:16,borderWidth:1,borderColor:"#E4E8EF",overflow:"hidden"},linkIcon:{width:48,height:53,alignItems:"center",justifyContent:"center",backgroundColor:"#F1F3FF"},linkText:{flex:1,minWidth:0,color:"#30405F",fontSize:10,fontWeight:"700"},accessButton:{height:44,paddingHorizontal:9,flexDirection:"row",alignItems:"center",gap:6},accessText:{color:"#17213B",fontSize:9,fontWeight:"700"},copyButton:{width:48,height:53,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F8FA"},
  memberRow:{minHeight:58,flexDirection:"row",alignItems:"center",gap:10},memberAvatar:{width:42,height:42,borderRadius:21,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#E7ECF5"},initials:{color:"#31415E",fontSize:12,fontWeight:"900"},memberCopy:{flex:1,minWidth:0},memberNameRow:{flexDirection:"row",alignItems:"center",gap:7},memberName:{maxWidth:"70%",color:"#17213B",fontSize:11,fontWeight:"800"},memberEmail:{marginTop:2,color:"#7C899C",fontSize:9,fontWeight:"600"},roleBadge:{paddingHorizontal:7,paddingVertical:3,borderRadius:7},role_owner:{backgroundColor:"#F0E8FF"},role_editor:{backgroundColor:"#E7F1FF"},role_viewer:{backgroundColor:"#E8F8EC"},roleBadgeText:{fontSize:8,fontWeight:"800"},roleText_owner:{color:"#6A49D8"},roleText_editor:{color:"#3976D1"},roleText_viewer:{color:"#3E9B58"},roleAction:{minWidth:64,minHeight:36,flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:4},roleActionText:{color:"#4F5F79",fontSize:10,fontWeight:"700"},removeButton:{width:32,height:32,alignItems:"center",justifyContent:"center"},addCollaborator:{marginTop:4,flexDirection:"row",alignItems:"center",gap:12},addCircle:{width:42,height:42,borderRadius:21,borderWidth:2,borderColor:"#6445F6",alignItems:"center",justifyContent:"center"},addCollaboratorText:{color:"#6042F1",fontSize:11,fontWeight:"700"},
  actions:{marginTop:14,flexDirection:"row",gap:12},cancelButton:{flex:1,minHeight:64,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#F2F3F6"},cancelText:{color:"#17213B",fontSize:13,fontWeight:"900"},createPress:{flex:1.65},createButton:{minHeight:64,borderRadius:21,flexDirection:"row",gap:9,alignItems:"center",justifyContent:"center"},createText:{color:"#FFF",fontSize:14,fontWeight:"900"},disabled:{opacity:.55},
});
