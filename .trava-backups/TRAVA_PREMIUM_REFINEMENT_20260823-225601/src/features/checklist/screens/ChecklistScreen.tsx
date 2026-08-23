import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalChecklistItem } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const backpack = require("../../../../assets/trava-pixel/checklist-backpack.png");
const CATEGORIES: LocalChecklistItem["category"][] = ["General", "Packing", "Money", "Documents", "Travel", "Health"];
const CAT_META: Record<LocalChecklistItem["category"], { icon: TravaIconName; bg: string; fg: string }> = {
  General: { icon: "list-outline", bg: "#F2F5F8", fg: "#6F7E94" },
  Packing: { icon: "bag-handle-outline", bg: "#F1F0FF", fg: "#817FDD" },
  Money: { icon: "wallet-outline", bg: "#FFF4EB", fg: "#D59667" },
  Documents: { icon: "document-text-outline", bg: "#ECF9F4", fg: "#55A88B" },
  Travel: { icon: "airplane-outline", bg: "#EBF6FF", fg: "#619EDB" },
  Health: { icon: "medkit-outline", bg: "#FFF0F4", fg: "#D87A98" },
};
const SUGGESTIONS: Array<{ title: string; category: LocalChecklistItem["category"] }> = [
  { title: "Portable umbrella", category: "Packing" },
  { title: "Pocket Wi-Fi or eSIM", category: "Travel" },
  { title: "Comfortable walking shoes", category: "Packing" },
];

export function ChecklistScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, addChecklist, toggleChecklist, updateChecklist, deleteChecklist } = useLocalTripWorkspace(tripId);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<LocalChecklistItem["category"]>("General");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [filter, setFilter] = useState<"All" | LocalChecklistItem["category"]>("All");
  const [editing, setEditing] = useState<LocalChecklistItem | null>(null);
  const done = state.checklist.filter((i) => i.completed).length;
  const pct = state.checklist.length ? Math.round((done / state.checklist.length) * 100) : 0;
  const visible = useMemo(() => filter === "All" ? state.checklist : state.checklist.filter((i) => i.category === filter), [state.checklist, filter]);

  function add() { if (!text.trim()) return; addChecklist(text.trim(), category); setText(""); }
  function addSuggestions() {
    const existing = new Set(state.checklist.map((i) => i.title.trim().toLowerCase()));
    const missing = SUGGESTIONS.filter((item) => !existing.has(item.title.toLowerCase()));
    if (!missing.length) { Alert.alert("Essentials already added", "Those suggested items are already in this checklist."); return; }
    missing.forEach((item) => addChecklist(item.title, item.category));
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Japan"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <LinearGradient colors={["#FFF3F7", "#F5F2FF", "#EDF7FF"]} style={s.hero}>
        <Image source={backpack} contentFit="contain" style={s.backpack}/>
        <View style={s.heroCopy}><View style={s.progressLabelRow}><Ionicons name="sparkles-outline" size={15} color="#D985A8"/><Text style={s.progressLabel}>GREAT PROGRESS</Text></View><Text style={s.heroTitle}>{pct >= 100 ? "Everything is ready" : pct >= 50 ? "You’re halfway ready" : "Getting ready for the trip"}</Text><Text style={s.heroSub}>{done} of {state.checklist.length} tasks complete.</Text><Pressable onPress={addSuggestions} style={s.suggest}><Ionicons name="add-circle-outline" size={18} color="#6E91CB"/><Text style={s.suggestText}>Add suggested essentials</Text></Pressable></View>
        <View style={s.ring}><View style={s.ringOuter}><LinearGradient colors={["#91C7F6", "#B4B4F4", "#F0A6C8"]} style={s.ringGrad}><View style={s.ringInner}><Text style={s.ringPct}>{pct}%</Text><Text style={s.ringCount}>{done}/{state.checklist.length}</Text></View></LinearGradient></View></View>
        <View style={s.progressTrack}><LinearGradient colors={["#8FC4F5", "#B3B4F4", "#EFA6C7"]} style={[s.progressFill, { width: `${pct}%` }]}/></View>
      </LinearGradient>

      <View style={s.addBar}><TextInput value={text} onChangeText={setText} onSubmitEditing={add} placeholder="Add a checklist item" placeholderTextColor="#8D97AD" style={s.input}/><Pressable onPress={() => setCategoryOpen(true)} style={s.catBtn}><View style={[s.catIcon, { backgroundColor: CAT_META[category].bg }]}><Ionicons name={CAT_META[category].icon} size={16} color={CAT_META[category].fg}/></View><Text style={s.catText}>{category}</Text><Ionicons name="chevron-down" size={15} color="#77859A"/></Pressable><Pressable accessibilityLabel="Add checklist item" onPress={add}><LinearGradient colors={["#89BFF4", "#AFB1F5", "#EFA5C8"]} style={s.plusBtn}><Ionicons name="add" size={27} color="#FFFFFF"/></LinearGradient></Pressable></View>

      <View><Text style={s.filterTitle}>Checklist items</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{(["All", ...CATEGORIES] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[s.filterChip, filter === item && s.filterChipOn]}><Text style={[s.filterText, filter === item && s.filterTextOn]}>{item}</Text></Pressable>)}</ScrollView></View>

      <View style={s.list}>{visible.map((item) => { const meta = CAT_META[item.category]; return <View key={item.id} style={[s.item, item.completed && s.itemDone]}><Pressable accessibilityLabel={`${item.completed ? "Mark incomplete" : "Mark complete"}: ${item.title}`} onPress={() => toggleChecklist(item.id)} style={[s.check, item.completed && s.checkDone]}>{item.completed ? <Ionicons name="checkmark" size={18} color="#FFFFFF"/> : null}</Pressable><View style={[s.itemCatIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={18} color={meta.fg}/></View><View style={s.itemCopy}><Text style={[s.itemTitle, item.completed && s.itemTitleDone]}>{item.title}</Text><Text style={[s.itemCat, { color: meta.fg }]}>{item.category}</Text></View><Pressable accessibilityLabel={`Edit ${item.title}`} onPress={() => setEditing(item)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color="#71819B"/></Pressable><Pressable accessibilityLabel={`Delete ${item.title}`} onPress={() => Alert.alert("Delete checklist item?", item.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteChecklist(item.id) }])} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color="#D5798A"/></Pressable></View>; })}{visible.length === 0 ? <View style={s.empty}><Ionicons name="checkmark-done-outline" size={26} color="#7CA2D4"/><Text style={s.emptyTitle}>No items in this category</Text></View> : null}</View>
    </View></ScrollView>
    <CategoryModal visible={categoryOpen} value={category} onClose={() => setCategoryOpen(false)} onSelect={(value) => { setCategory(value); setCategoryOpen(false); }}/>
    <EditModal key={`checklist-editor-${editing?.id ?? "idle"}`} item={editing} onClose={() => setEditing(null)} onSave={(title, nextCategory) => { if (editing) updateChecklist(editing.id, { title, category: nextCategory }); setEditing(null); }}/>
  </ScreenShell></SafeAreaView>;
}

function CategoryModal({ visible, value, onClose, onSelect }: { visible: boolean; value: LocalChecklistItem["category"]; onClose(): void; onSelect(v: LocalChecklistItem["category"]): void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable style={s.backdrop} onPress={onClose}><Pressable style={s.categoryModal} onPress={() => undefined}><View style={s.modalHeader}><Text style={s.modalTitle}>Choose category</Text><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View>{CATEGORIES.map((category) => { const meta = CAT_META[category]; return <Pressable key={category} onPress={() => onSelect(category)} style={[s.categoryOption, value === category && s.categoryOptionOn]}><View style={[s.categoryOptionIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={18} color={meta.fg}/></View><Text style={s.categoryOptionText}>{category}</Text>{value === category ? <Ionicons name="checkmark-circle" size={19} color="#6F96CE"/> : null}</Pressable>; })}</Pressable></Pressable></Modal>;
}

function EditModal({ item, onClose, onSave }: { item: LocalChecklistItem | null; onClose(): void; onSave(title: string, category: LocalChecklistItem["category"]): void }) {
  const [title, setTitle] = useState(item?.title ?? ""); const [category, setCategory] = useState<LocalChecklistItem["category"]>(item?.category ?? "General"); if (!item) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHeader}><Text style={s.modalTitle}>Edit checklist item</Text><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><Text style={s.label}>Item</Text><TextInput style={s.modalInput} value={title} onChangeText={setTitle}/><Text style={s.label}>Category</Text><View style={s.editCategories}>{CATEGORIES.map((c) => <Pressable key={c} onPress={() => setCategory(c)} style={[s.editCategory, category === c && s.editCategoryOn]}><Text style={[s.editCategoryText, category === c && s.editCategoryTextOn]}>{c}</Text></Pressable>)}</View><View style={s.modalBtns}><Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => onSave(title.trim() || item.title, category)} style={s.savePress}><LinearGradient colors={["#89BFF4", "#AFB1F5", "#EFA5C8"]} style={s.save}><Text style={s.saveText}>Save changes</Text></LinearGradient></Pressable></View></View></View></Modal>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" }, scroll: { padding: 22, paddingBottom: 130 }, max: { width: "100%", maxWidth: 640, alignSelf: "center", gap: 18 },
  hero: { height: 318, borderRadius: 29, overflow: "hidden", borderWidth: 1, borderColor: "#EAF0F7", boxShadow: "0 16px 38px rgba(80,94,126,.10)" }, backpack: { position: "absolute", width: 210, height: 220, left: 6, bottom: 45 }, heroCopy: { position: "absolute", left: 218, top: 54, right: 130 }, progressLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 }, progressLabel: { color: "#C9789D", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, heroTitle: { marginTop: 18, color: PX.ink, fontSize: 25, fontWeight: "900", letterSpacing: -.5 }, heroSub: { marginTop: 9, color: "#566789", fontSize: 12, fontWeight: "600" }, suggest: { marginTop: 20, height: 48, paddingHorizontal: 16, borderRadius: 24, alignSelf: "flex-start", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.88)", borderWidth: 1, borderColor: "#FFFFFF", boxShadow: "0 8px 18px rgba(78,98,132,.08)" }, suggestText: { color: "#6488C0", fontSize: 10, fontWeight: "900" }, ring: { position: "absolute", right: 22, top: 72, width: 112, height: 112, borderRadius: 56, backgroundColor: "rgba(255,255,255,.72)", alignItems: "center", justifyContent: "center" }, ringOuter: { width: 96, height: 96, borderRadius: 48 }, ringGrad: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" }, ringInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F9FBFF", alignItems: "center", justifyContent: "center" }, ringPct: { color: PX.ink, fontSize: 22, fontWeight: "900" }, ringCount: { marginTop: 3, color: "#6F8FC4", fontSize: 11, fontWeight: "800" }, progressTrack: { position: "absolute", left: 28, right: 28, bottom: 28, height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(255,255,255,.68)", borderWidth: 1, borderColor: "#FFFFFF" }, progressFill: { height: "100%", borderRadius: 6 },
  addBar: { minHeight: 84, padding: 12, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#ECEEF4", boxShadow: "0 12px 26px rgba(68,72,103,.07)" }, input: { flex: 1, height: 58, paddingHorizontal: 18, borderRadius: 19, borderWidth: 1, borderColor: "#DDE4ED", color: PX.ink, fontSize: 13 }, catBtn: { width: 158, height: 58, paddingHorizontal: 9, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#E1E6ED" }, catIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" }, catText: { flex: 1, color: PX.ink, fontSize: 11, fontWeight: "800" }, plusBtn: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  filterTitle: { color: PX.ink, fontSize: 14, fontWeight: "900" }, filters: { gap: 7, paddingTop: 8 }, filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, backgroundColor: "#F5F7FA", borderWidth: 1, borderColor: "#E9EDF2" }, filterChipOn: { backgroundColor: "#EDF6FF", borderColor: "#CBDDF3" }, filterText: { color: "#758096", fontSize: 9, fontWeight: "800" }, filterTextOn: { color: "#5F86BF" },
  list: { gap: 10 }, item: { minHeight: 82, paddingHorizontal: 15, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#EDF0F5", boxShadow: "0 8px 20px rgba(71,75,107,.055)" }, itemDone: { backgroundColor: "#FCFEFD" }, check: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#9FB7D5" }, checkDone: { borderColor: "#65B69C", backgroundColor: "#65B69C" }, itemCatIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, itemCopy: { flex: 1 }, itemTitle: { color: PX.ink, fontSize: 13, fontWeight: "900" }, itemTitleDone: { color: "#8993A3", textDecorationLine: "line-through" }, itemCat: { marginTop: 5, fontSize: 9, fontWeight: "700" }, iconBtn: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFC", borderWidth: 1, borderColor: "#EEF0F5" }, empty: { minHeight: 120, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#F8FAFD" }, emptyTitle: { marginTop: 6, color: PX.ink, fontSize: 11, fontWeight: "900" },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(12,17,34,.42)" }, modal: { width: "100%", maxWidth: 440, padding: 20, borderRadius: 26, backgroundColor: "#FFF" }, categoryModal: { width: "100%", maxWidth: 390, padding: 16, borderRadius: 25, backgroundColor: "#FFF" }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { color: PX.ink, fontSize: 18, fontWeight: "900" }, close: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" }, categoryOption: { minHeight: 54, paddingHorizontal: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 10 }, categoryOptionOn: { backgroundColor: "#F3F8FE" }, categoryOptionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, categoryOptionText: { flex: 1, color: PX.ink, fontSize: 11, fontWeight: "800" }, label: { marginTop: 13, marginBottom: 6, color: "#526079", fontSize: 9, fontWeight: "900" }, modalInput: { height: 50, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "#F5F7FA", borderWidth: 1, borderColor: "#E8ECF2", color: PX.ink }, editCategories: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, editCategory: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: "#F5F7FA", borderWidth: 1, borderColor: "#E8ECF2" }, editCategoryOn: { backgroundColor: "#EDF6FF", borderColor: "#CADDF4" }, editCategoryText: { color: "#707C91", fontSize: 9, fontWeight: "800" }, editCategoryTextOn: { color: "#5E85C0" }, modalBtns: { marginTop: 16, flexDirection: "row", gap: 8 }, cancel: { flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF0F5" }, cancelText: { color: PX.muted, fontWeight: "900", fontSize: 10 }, savePress: { flex: 1.5 }, save: { height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" }, saveText: { color: "#FFF", fontWeight: "900", fontSize: 10 },
});
