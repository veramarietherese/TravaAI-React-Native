import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { TripSummary } from "@trava/shared";

import { SearchableLocationField } from "@/features/maps/components/SearchableLocationField";

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
export interface PickedCover { asset: ImagePicker.ImagePickerAsset; }

export function TripForm({ initialTrip, submitting, submitLabel, onSubmit, onCancel }: {
  initialTrip?: TripSummary | null;
  submitting: boolean;
  submitLabel: string;
  onSubmit(value: TripFormValue, cover: PickedCover | null): void;
  onCancel(): void;
}) {
  const [value, setValue] = useState<TripFormValue>(() => ({
    name: initialTrip?.name ?? "", destination: initialTrip?.destination ?? "", description: initialTrip?.description ?? "", startDate: initialTrip?.startDate ?? "", endDate: initialTrip?.endDate ?? "", totalBudget: initialTrip ? String(initialTrip.totalBudget) : "", currencyCode: initialTrip?.currencyCode ?? "PHP", travelStyle: initialTrip?.travelStyle ?? "", travelGroup: initialTrip?.travelGroup ?? "", flightNumber: initialTrip?.flightNumber ?? "", flightDate: initialTrip?.flightDate ?? "", status: initialTrip?.status ?? "upcoming",
  }));
  const [cover, setCover] = useState<PickedCover | null>(null);
  const [moreOpen, setMoreOpen] = useState(Boolean(initialTrip));
  const [error, setError] = useState<string | null>(null);
  function update<K extends keyof TripFormValue>(key: K, next: TripFormValue[K]) { setValue((current) => ({ ...current, [key]: next })); }

  async function pickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError("Photo access is required to choose a trip cover."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: .82 });
    if (!result.canceled && result.assets[0]) { setCover({ asset: result.assets[0] }); setError(null); }
  }
  function submit() {
    const name = value.name.trim(); const destination = value.destination.trim();
    if (name.length < 2) { setError("Enter a trip name."); return; }
    if (destination.length < 2) { setError("Choose a destination from search."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.startDate)) { setError("Add a start date using YYYY-MM-DD."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.endDate)) { setError("Add an end date using YYYY-MM-DD."); return; }
    if (value.endDate < value.startDate) { setError("End date must be on or after the start date."); return; }
    const budget = Number(value.totalBudget || 0); if (!Number.isFinite(budget) || budget < 0) { setError("Enter a valid budget amount."); return; }
    setError(null); onSubmit({ ...value, name, destination }, cover);
  }
  const preview = cover?.asset.uri ?? initialTrip?.coverImageUrl ?? null;

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><View style={styles.maxWidth}>
    <View style={styles.intro}><View style={styles.stepBadge}><Text style={styles.stepText}>{initialTrip ? "EDIT TRIP" : "1 MINUTE SETUP"}</Text></View><Text style={styles.introTitle}>{initialTrip ? "Update the essentials" : "Where are you going?"}</Text><Text style={styles.introSub}>Only the details needed to build the trip. Everything else can be added later.</Text></View>

    <View style={styles.mainCard}>
      <Field label="Trip name" value={value.name} onChangeText={(text) => update("name", text)} placeholder="e.g. Osaka weekend" />
      <SearchableLocationField label="Destination" value={value.destination} onChangeText={(text) => update("destination", text)} onSelect={(place) => update("destination", place.displayName)} placeholder="Search city, country, airport, or region" />
      <View style={styles.row}><Field compact label="Start" value={value.startDate} onChangeText={(text) => update("startDate", text)} placeholder="YYYY-MM-DD" /><Field compact label="End" value={value.endDate} onChangeText={(text) => update("endDate", text)} placeholder="YYYY-MM-DD" /></View>
    </View>

    <Pressable onPress={() => setMoreOpen((v) => !v)} style={styles.moreToggle}><View style={styles.moreIcon}><Ionicons name="options-outline" size={20} color="#527BB4"/></View><View style={styles.moreCopy}><Text style={styles.moreTitle}>Optional trip details</Text><Text style={styles.moreSub}>Budget, cover photo, flight, notes</Text></View><Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={19} color="#6C7B93"/></Pressable>

    {moreOpen ? <View style={styles.optionalCard}>
      <Pressable onPress={() => void pickCover()} style={styles.coverRow}>{preview ? <Image source={{ uri: preview }} contentFit="cover" style={styles.coverThumb}/> : <LinearGradient colors={["#DDEFFF","#E8E5FF","#F9DFEA"]} style={styles.coverThumb}><Ionicons name="image-outline" size={24} color="#537EB4"/></LinearGradient>}<View style={styles.coverCopy}><Text style={styles.optionalLabel}>Trip cover</Text><Text style={styles.optionalHint}>{preview ? "Tap to change" : "Add a photo (optional)"}</Text></View><Ionicons name="chevron-forward" size={18} color="#8090A7"/></Pressable>
      <Field label="Short note" value={value.description} onChangeText={(text) => update("description", text)} placeholder="What is this trip for? (optional)" multiline />
      <View style={styles.row}><Field compact label="Budget" value={value.totalBudget} onChangeText={(text) => update("totalBudget", text)} placeholder="0.00" keyboardType="decimal-pad" /><Field compact label="Currency" value={value.currencyCode} onChangeText={(text) => update("currencyCode", text.toUpperCase().slice(0,3))} placeholder="PHP" autoCapitalize="characters" /></View>
      <View style={styles.row}><Field compact label="Flight no." value={value.flightNumber} onChangeText={(text) => update("flightNumber", text.toUpperCase())} placeholder="PR2334" autoCapitalize="characters" /><Field compact label="Flight date" value={value.flightDate} onChangeText={(text) => update("flightDate", text)} placeholder="YYYY-MM-DD" /></View>
    </View> : null}

    {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={17} color="#C46274"/><Text style={styles.error}>{error}</Text></View> : null}
    <View style={styles.actions}><Pressable disabled={submitting} onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={submitting} onPress={submit} style={styles.submitPress}><LinearGradient colors={["#6FAAE8","#A1AAEE","#EA90B8"]} style={[styles.submitButton, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.submitText}>{submitLabel}</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF"/></>}</LinearGradient></Pressable></View>
  </View></ScrollView>;
}
function Field({ label, compact, multiline, ...props }: { label: string; compact?: boolean; multiline?: boolean } & ComponentProps<typeof TextInput>) { return <View style={[styles.field, compact && styles.fieldCompact]}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#98A3B6" style={[styles.input, multiline && styles.multiline]} /></View>; }

const styles = StyleSheet.create({
  content:{padding:18,paddingBottom:50,backgroundColor:"#FFFFFF"},maxWidth:{width:"100%",maxWidth:620,alignSelf:"center"},intro:{paddingHorizontal:4,paddingTop:6,paddingBottom:14},stepBadge:{alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:"#EAF4FF"},stepText:{color:"#557DB3",fontSize:8,fontWeight:"900",letterSpacing:.8},introTitle:{marginTop:9,color:"#101A35",fontSize:30,lineHeight:35,fontWeight:"900",letterSpacing:-.8},introSub:{marginTop:5,color:"#758198",fontSize:11,lineHeight:16,fontWeight:"600"},mainCard:{gap:13,padding:18,borderRadius:25,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E8ECF2",boxShadow:"0 12px 30px rgba(65,75,102,.07)"},row:{flexDirection:"row",gap:10},field:{width:"100%"},fieldCompact:{flex:1,minWidth:0},label:{marginBottom:6,color:"#526079",fontSize:10,fontWeight:"900"},input:{minHeight:50,borderRadius:16,paddingHorizontal:14,paddingVertical:11,color:"#17223C",backgroundColor:"#F5F7FA",borderWidth:1,borderColor:"#E8ECF2",fontSize:12,fontWeight:"700"},multiline:{minHeight:82,textAlignVertical:"top"},moreToggle:{marginTop:14,minHeight:66,padding:11,borderRadius:21,flexDirection:"row",alignItems:"center",gap:11,backgroundColor:"rgba(246,249,253,.88)",borderWidth:1,borderColor:"#E4EAF2"},moreIcon:{width:42,height:42,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#E9F3FF"},moreCopy:{flex:1},moreTitle:{color:"#17223C",fontSize:12,fontWeight:"900"},moreSub:{marginTop:3,color:"#7C879A",fontSize:9,fontWeight:"600"},optionalCard:{marginTop:10,gap:13,padding:17,borderRadius:24,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E8ECF2"},coverRow:{minHeight:66,padding:8,borderRadius:18,flexDirection:"row",alignItems:"center",gap:11,backgroundColor:"#F7F9FC"},coverThumb:{width:64,height:50,borderRadius:14,overflow:"hidden",alignItems:"center",justifyContent:"center"},coverCopy:{flex:1},optionalLabel:{color:"#17223C",fontSize:11,fontWeight:"900"},optionalHint:{marginTop:3,color:"#7C879A",fontSize:9,fontWeight:"600"},errorBox:{marginTop:13,padding:11,borderRadius:15,flexDirection:"row",gap:8,backgroundColor:"#FFF3F5"},error:{flex:1,color:"#B45B6D",fontSize:10,lineHeight:15,fontWeight:"700"},actions:{marginTop:16,flexDirection:"row",gap:9},cancelButton:{flex:1,minHeight:52,alignItems:"center",justifyContent:"center",borderRadius:17,backgroundColor:"#EEF1F5"},cancelText:{color:"#617087",fontSize:11,fontWeight:"900"},submitPress:{flex:2},submitButton:{minHeight:52,borderRadius:17,flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center"},submitText:{color:"#FFF",fontSize:11,fontWeight:"900"},disabled:{opacity:.6},
});
