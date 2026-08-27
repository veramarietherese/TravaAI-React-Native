import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PremiumBlueButton } from "@/components/ui/PremiumBlueButton";
import { PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalChecklistItem } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const CHECKLIST_VISUAL = require("../../../../assets/trava-premium/checklist-pencil-pink.png");
const CATEGORIES: LocalChecklistItem["category"][] = ["General", "Packing", "Money", "Documents", "Travel", "Health"];
const CAT_META: Record<LocalChecklistItem["category"], { icon: TravaIconName; bg: string; fg: string }> = {
  General: { icon: "list-outline", bg: "#F1F5FB", fg: "#6D7F99" },
  Packing: { icon: "bag-handle-outline", bg: "#EEF2FF", fg: "#7C8DDE" },
  Money: { icon: "wallet-outline", bg: "#FFF2E7", fg: "#D99562" },
  Documents: { icon: "document-text-outline", bg: "#FFF0F6", fg: "#D978A3" },
  Travel: { icon: "airplane-outline", bg: "#EAF7FF", fg: "#64A1DA" },
  Health: { icon: "medkit-outline", bg: "#FFF0F2", fg: "#D7778B" },
};
const SUGGESTIONS: { title: string; category: LocalChecklistItem["category"] }[] = [
  { title: "Portable umbrella", category: "Packing" },
  { title: "Pocket Wi-Fi or eSIM", category: "Travel" },
  { title: "Comfortable walking shoes", category: "Packing" },
];

export function ChecklistScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const { state, addChecklist, toggleChecklist, updateChecklist, deleteChecklist } = useLocalTripWorkspace(tripId);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<LocalChecklistItem["category"]>("General");
  const [filter, setFilter] = useState<"All" | LocalChecklistItem["category"]>("All");
  const [editing, setEditing] = useState<LocalChecklistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalChecklistItem | null>(null);

  const done = state.checklist.filter((item) => item.completed).length;
  const pct = state.checklist.length ? Math.round((done / state.checklist.length) * 100) : 0;
  const visible = useMemo(() => filter === "All" ? state.checklist : state.checklist.filter((item) => item.category === filter), [filter, state.checklist]);

  function add() {
    const value = text.trim();
    if (!value) return;
    addChecklist(value, category);
    setText("");
  }

  function addSuggestions() {
    const existing = new Set(state.checklist.map((item) => item.title.trim().toLowerCase()));
    SUGGESTIONS.filter((item) => !existing.has(item.title.toLowerCase())).forEach((item) => addChecklist(item.title, item.category));
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Trip"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <LinearGradient colors={["#FFF4F9", "#F5F4FF", "#EEF8FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, compact && s.heroCompact]}>
        <View style={[s.visualWrap, compact && s.visualWrapCompact]}><Image source={CHECKLIST_VISUAL} contentFit="contain" style={s.visual}/></View>
        <View style={[s.heroCopy, compact && s.heroCopyCompact]}>
          <View style={s.eyebrowRow}><Ionicons name="sparkles-outline" size={16} color="#C2769C"/><Text style={s.eyebrow}>TRIP READINESS</Text></View>
          <Text style={s.heroTitle}>{pct >= 100 ? "Everything is ready" : "Build your travel checklist"}</Text>
          <Text style={s.heroSub}>{done} of {state.checklist.length} tasks complete.</Text>
          <Pressable onPress={addSuggestions} style={s.suggest}><Ionicons name="add-circle-outline" size={18} color="#647893"/><Text style={s.suggestText}>Add suggested essentials</Text></Pressable>
        </View>
        <View style={[s.ring, compact && s.ringCompact]}><LinearGradient colors={["#9DB9EE", "#C0ADEB", "#E8A7C7"]} style={s.ringGrad}><View style={s.ringInner}><Text style={s.ringPct}>{pct}%</Text><Text style={s.ringCount}>{done}/{state.checklist.length}</Text></View></LinearGradient></View>
      </LinearGradient>

      <View style={s.addBar}>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={add} placeholder="Add a checklist item" placeholderTextColor="#8C98AA" style={s.input}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryChooser}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[s.categoryChip, category === item && s.categoryChipOn]}><Text style={[s.categoryChipText, category === item && s.categoryChipTextOn]}>{item}</Text></Pressable>)}</ScrollView>
        <PremiumBlueButton label="Add item" icon="add" onPress={add}/>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{(["All", ...CATEGORIES] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[s.filter, filter === item && s.filterOn]}><Text style={[s.filterText, filter === item && s.filterTextOn]}>{item}</Text></Pressable>)}</ScrollView>

      <View style={s.list}>{visible.map((item) => {
        const meta = CAT_META[item.category];
        return <View key={item.id} style={[s.item, item.completed && s.itemDone]}>
          <Pressable accessibilityLabel={item.completed ? `Mark ${item.title} incomplete` : `Complete ${item.title}`} onPress={() => toggleChecklist(item.id)} style={[s.check, item.completed && s.checkDone]}>{item.completed ? <Ionicons name="checkmark" size={17} color="#FFFFFF"/> : null}</Pressable>
          <View style={[s.itemIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={18} color={meta.fg}/></View>
          <View style={s.itemCopy}><Text style={[s.itemTitle, item.completed && s.itemTitleDone]}>{item.title}</Text><Text style={[s.itemCategory, { color: meta.fg }]}>{item.category}</Text></View>
          <Pressable accessibilityLabel={`Edit ${item.title}`} onPress={() => setEditing(item)} style={s.iconButton}><Ionicons name="create-outline" size={19} color="#70819B"/></Pressable>
          <Pressable accessibilityLabel={`Delete ${item.title}`} onPress={() => setDeleteTarget(item)} style={s.iconButton}><Ionicons name="trash-outline" size={19} color="#D66F88"/></Pressable>
        </View>;
      })}{visible.length === 0 ? <View style={s.empty}><Ionicons name="checkmark-done-outline" size={30} color="#82A7DA"/><Text style={s.emptyTitle}>No items in this category</Text></View> : null}</View>
    </View></ScrollView>

    <EditModal key={editing?.id ?? "checklist-edit-closed"} item={editing} onClose={() => setEditing(null)} onSave={(title, nextCategory) => { if (editing) updateChecklist(editing.id, { title, category: nextCategory }); setEditing(null); }}/>
    <ConfirmDelete key={deleteTarget?.id ?? "checklist-delete-closed"} item={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={() => { if (deleteTarget) deleteChecklist(deleteTarget.id); setDeleteTarget(null); }}/>
  </ScreenShell></SafeAreaView>;
}

function EditModal({ item, onClose, onSave }: { item: LocalChecklistItem | null; onClose(): void; onSave(title: string, category: LocalChecklistItem["category"]): void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState<LocalChecklistItem["category"]>(item?.category ?? "General");
  if (!item) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}>
    <View style={s.modalHead}><Text style={s.modalTitle}>Edit checklist item</Text><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#66758C"/></Pressable></View>
    <Text style={s.label}>Item</Text><TextInput value={title} onChangeText={setTitle} style={s.modalInput}/><Text style={s.label}>Category</Text>
    <View style={s.editCategories}>{CATEGORIES.map((value) => <Pressable key={value} onPress={() => setCategory(value)} style={[s.editCategory, category === value && s.editCategoryOn]}><Text style={[s.editCategoryText, category === value && s.editCategoryTextOn]}>{value}</Text></Pressable>)}</View>
    <PremiumBlueButton label="Save changes" icon="checkmark" onPress={() => onSave(title.trim() || item.title, category)}/>
  </View></View></Modal>;
}

function ConfirmDelete({ item, onClose, onDelete }: { item: LocalChecklistItem | null; onClose(): void; onDelete(): void }) {
  if (!item) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal, s.confirmModal]}>
    <View style={s.deleteCircle}><Ionicons name="trash-outline" size={24} color="#D66F88"/></View><Text style={s.confirmTitle}>Delete checklist item?</Text><Text style={s.confirmBody}>{item.title}</Text>
    <View style={s.confirmActions}><Pressable onPress={onClose} style={s.cancelButton}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={onDelete} style={s.deleteButton}><Text style={s.deleteButtonText}>Delete</Text></Pressable></View>
  </View></View></Modal>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" }, scroll: { padding: 22, paddingBottom: 130 }, max: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 18 },
  hero: { minHeight: 280, borderRadius: 32, overflow: "hidden", borderWidth: 1, borderColor: "#E7E9EF", boxShadow: "0 18px 42px rgba(42,48,64,.08)", position: "relative" }, heroCompact: { minHeight: 430 }, visualWrap: { position: "absolute", left: 20, top: 38, width: 185, height: 185 }, visualWrapCompact: { left: 12, top: 20, width: 170, height: 170 }, visual: { width: "100%", height: "100%" },
  heroCopy: { position: "absolute", left: 215, top: 58, right: 150 }, heroCopyCompact: { left: 22, top: 205, right: 22 }, eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 }, eyebrow: { color: "#AE6488", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, heroTitle: { marginTop: 13, color: PX.ink, fontSize: 27, lineHeight: 33, fontWeight: "900" }, heroSub: { marginTop: 7, color: "#667286", fontSize: 11, fontWeight: "700" }, suggest: { marginTop: 16, alignSelf: "flex-start", minHeight: 43, paddingHorizontal: 14, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,.80)" }, suggestText: { color: "#5E6E84", fontSize: 10, fontWeight: "900" },
  ring: { position: "absolute", right: 23, top: 78, width: 108, height: 108, borderRadius: 54 }, ringCompact: { right: 22, top: 31 }, ringGrad: { width: "100%", height: "100%", borderRadius: 999, padding: 9 }, ringInner: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }, ringPct: { color: PX.ink, fontSize: 22, fontWeight: "900" }, ringCount: { marginTop: 2, color: "#6B7588", fontSize: 10, fontWeight: "900" },
  addBar: { padding: 14, borderRadius: 26, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E8EE", gap: 11, boxShadow: "0 10px 26px rgba(40,49,67,.05)" }, input: { height: 50, borderRadius: 17, paddingHorizontal: 15, color: PX.ink, backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#E5E8EE",}, categoryChooser: { gap: 7 }, categoryChip: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17, justifyContent: "center", backgroundColor: "#F6F7FA" }, categoryChipOn: { backgroundColor: "#EDF3FF" }, categoryChipText: { color: "#788397", fontSize: 8.5, fontWeight: "800" }, categoryChipTextOn: { color: "#5E80C8" },
  filters: { gap: 8 }, filter: { minHeight: 38, paddingHorizontal: 13, borderRadius: 19, justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3E7ED" }, filterOn: { backgroundColor: "#F0F5FF", borderColor: "#CBD9F1" }, filterText: { color: "#6D788B", fontSize: 9.5, fontWeight: "800" }, filterTextOn: { color: "#5B7FC7" },
  list: { gap: 10 }, item: { minHeight: 82, padding: 12, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E9EE" }, itemDone: { backgroundColor: "#FAFBFC" }, check: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#CBD3DF" }, checkDone: { borderColor: "#79A6E8", backgroundColor: "#79A6E8" }, itemIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" }, itemCopy: { flex: 1, minWidth: 0 }, itemTitle: { color: PX.ink, fontSize: 12, fontWeight: "900" }, itemTitleDone: { color: "#8B94A2", textDecorationLine: "line-through" }, itemCategory: { marginTop: 4, fontSize: 8.5, fontWeight: "800" }, iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FB" },
  empty: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 24, backgroundColor: "#F8FAFD" }, emptyTitle: { color: "#70809A", fontSize: 11, fontWeight: "900" }, backdrop: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,21,36,.42)" }, modal: { width: "100%", maxWidth: 520, borderRadius: 28, padding: 20, backgroundColor: "#FFFFFF", boxShadow: "0 24px 70px rgba(25,35,58,.20)" }, modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }, modalTitle: { color: PX.ink, fontSize: 20, fontWeight: "900" }, close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6F9" }, label: { marginTop: 8, marginBottom: 6, color: "#66748A", fontSize: 9, fontWeight: "900" }, modalInput: { height: 50, borderRadius: 16, paddingHorizontal: 13, color: PX.ink, backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#E4E8EF",}, editCategories: { marginVertical: 12, flexDirection: "row", flexWrap: "wrap", gap: 7 }, editCategory: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17, justifyContent: "center", backgroundColor: "#F6F7FA" }, editCategoryOn: { backgroundColor: "#EEF3FF" }, editCategoryText: { color: "#7D8798", fontSize: 8.5, fontWeight: "800" }, editCategoryTextOn: { color: "#5C7FC5" },
  confirmModal: { maxWidth: 420, alignItems: "center" }, deleteCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F5" }, confirmTitle: { marginTop: 15, color: PX.ink, fontSize: 18, fontWeight: "900" }, confirmBody: { marginTop: 6, color: "#778196", fontSize: 10, fontWeight: "600", textAlign: "center" }, confirmActions: { width: "100%", marginTop: 18, flexDirection: "row", gap: 9 }, cancelButton: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F5F8" }, cancelText: { color: "#637086", fontSize: 10, fontWeight: "900" }, deleteButton: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#E8879D" }, deleteButtonText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
});
