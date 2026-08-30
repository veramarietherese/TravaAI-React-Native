import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import {
  useLocalTripWorkspace,
  type LocalChecklistItem,
} from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const CHECKLIST_VISUAL = require("../../../../assets/trava-premium/checklist-pencil-pink.png");

type ChecklistStatus = "todo" | "completed" | "pending";
type ChecklistFilter = "All" | LocalChecklistItem["category"];

type CategoryMeta = {
  label: string;
  icon: TravaIconName;
  bg: string;
  fg: string;
};

const CATEGORIES: LocalChecklistItem["category"][] = [
  "General",
  "Packing",
  "Money",
  "Documents",
  "Travel",
  "Health",
];

const CAT_META: Record<LocalChecklistItem["category"], CategoryMeta> = {
  General: { label: "Essentials", icon: "briefcase-outline", bg: "#EEF4FF", fg: "#6C82E8" },
  Packing: { label: "Packing", icon: "bag-handle-outline", bg: "#F4EEFF", fg: "#8A70DF" },
  Money: { label: "Money", icon: "wallet-outline", bg: "#FFF5E9", fg: "#D99A63" },
  Documents: { label: "Documents", icon: "folder-outline", bg: "#EEF5FF", fg: "#6990DB" },
  Travel: { label: "Transport", icon: "train-outline", bg: "#EEF8FF", fg: "#63A2DA" },
  Health: { label: "Health", icon: "heart-outline", bg: "#FFF0F5", fg: "#E67DA4" },
};

const STATUS_TABS: { key: ChecklistStatus; label: string; icon: TravaIconName }[] = [
  { key: "todo", label: "To do", icon: "sparkles-outline" },
  { key: "completed", label: "Completed", icon: "checkmark" },
  { key: "pending", label: "Pending", icon: "time-outline" },
];

const SUGGESTIONS: { title: string; category: LocalChecklistItem["category"] }[] = [
  { title: "Hotel confirmation", category: "General" },
  { title: "Flight tickets", category: "General" },
  { title: "Travel insurance", category: "General" },
  { title: "Comfortable walking shoes", category: "Packing" },
  { title: "Portable umbrella", category: "Packing" },
  { title: "Universal travel adapter", category: "Packing" },
  { title: "Passport copy", category: "Documents" },
  { title: "Pocket Wi-Fi or eSIM", category: "Travel" },
  { title: "Basic medicines", category: "Health" },
];

function itemStatus(item: LocalChecklistItem): ChecklistStatus {
  if (item.completed || item.status === "completed") return "completed";
  if (item.status === "pending") return "pending";
  return "todo";
}

export function ChecklistScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const {
    state,
    addChecklist,
    toggleChecklist,
    updateChecklist,
    deleteChecklist,
  } = useLocalTripWorkspace(tripId);

  const [text, setText] = useState("");
  const [category, setCategory] = useState<LocalChecklistItem["category"]>("General");
  const [status, setStatus] = useState<ChecklistStatus>("todo");
  const [filter, setFilter] = useState<ChecklistFilter>("All");
  const [editing, setEditing] = useState<LocalChecklistItem | null>(null);
  const [menuItem, setMenuItem] = useState<LocalChecklistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalChecklistItem | null>(null);
  const [collapsed, setCollapsed] = useState<Partial<Record<LocalChecklistItem["category"], boolean>>>({
    Documents: true,
    Health: true,
  });

  const completedCount = useMemo(
    () => state.checklist.filter((item) => itemStatus(item) === "completed").length,
    [state.checklist],
  );
  const pendingCount = useMemo(
    () => state.checklist.filter((item) => itemStatus(item) === "pending").length,
    [state.checklist],
  );
  const todoCount = Math.max(0, state.checklist.length - completedCount - pendingCount);
  const pct = state.checklist.length
    ? Math.round((completedCount / state.checklist.length) * 100)
    : 0;

  const grouped = useMemo(() => {
    const filtered = state.checklist.filter((item) => {
      if (itemStatus(item) !== status) return false;
      if (filter !== "All" && item.category !== filter) return false;
      return true;
    });

    return CATEGORIES.map((key) => ({
      key,
      items: filtered.filter((item) => item.category === key),
    })).filter((group) => group.items.length > 0);
  }, [filter, state.checklist, status]);

  function add() {
    const value = text.trim();
    if (!value) return;
    addChecklist(value, category);
    setText("");
    setStatus("todo");
    setFilter("All");
    setCollapsed((current) => ({ ...current, [category]: false }));
  }

  function addSuggestions() {
    const existing = new Set(state.checklist.map((item) => item.title.trim().toLowerCase()));
    SUGGESTIONS.filter((item) => !existing.has(item.title.toLowerCase())).forEach((item) =>
      addChecklist(item.title, item.category),
    );
    setStatus("todo");
    setFilter("All");
  }

  function updateStatus(item: LocalChecklistItem, next: ChecklistStatus) {
    updateChecklist(item.id, {
      completed: next === "completed",
      status: next,
    });
    setMenuItem(null);
  }

  function toggleGroup(key: LocalChecklistItem["category"]) {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  }

  function resetFilters() {
    setStatus("todo");
    setFilter("All");
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <ScreenShell tripId={tripId} title={trip.name || "Trip"}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.max}>
            <LinearGradient
              colors={["#FFF4F9", "#F8F3FF", "#EEF7FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.hero, compact && s.heroCompact]}
            >
              <View style={[s.visualWrap, compact && s.visualWrapCompact]}>
                <Image source={CHECKLIST_VISUAL} contentFit="contain" style={s.visual} />
              </View>

              <View style={[s.heroCopy, compact && s.heroCopyCompact]}>
                <View style={s.eyebrowRow}>
                  <Ionicons name="sparkles-outline" size={15} color="#C66B99" />
                  <Text style={s.eyebrow}>TRIP READINESS</Text>
                </View>
                <Text style={s.heroTitle}>
                  {pct >= 100 ? "Everything is ready" : "Build your travel checklist"}
                </Text>
                <Text style={s.heroSub}>
                  {completedCount} of {state.checklist.length} tasks completed
                </Text>
                <Pressable onPress={addSuggestions} style={s.suggest}>
                  <Ionicons name="sparkles-outline" size={14} color="#6A82C4" />
                  <Text style={s.suggestText}>Add suggested essentials</Text>
                </Pressable>
              </View>

              <View style={[s.ring, compact && s.ringCompact]}>
                <LinearGradient
                  colors={["#A9C4F4", "#9B91EE", "#EDA3CB"]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={s.ringGrad}
                >
                  <View style={s.ringInner}>
                    <Text style={s.ringPct}>{pct}%</Text>
                    <Text style={s.ringCount}>{completedCount}/{state.checklist.length}</Text>
                  </View>
                </LinearGradient>
              </View>
            </LinearGradient>

            <View style={s.workspaceCard}>
              <View style={s.statusTabs}>
                {STATUS_TABS.map((tab) => {
                  const active = status === tab.key;
                  const count = tab.key === "todo" ? todoCount : tab.key === "completed" ? completedCount : pendingCount;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setStatus(tab.key)}
                      style={[s.statusTab, active && s.statusTabActive]}
                    >
                      <Ionicons name={tab.icon} size={14} color={active ? "#FFFFFF" : "#949AA5"} />
                      <Text style={[s.statusTabText, active && s.statusTabTextActive]}>{tab.label}</Text>
                      {count > 0 ? <Text style={[s.statusCount, active && s.statusCountActive]}>{count}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>

              <View style={s.addRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={add}
                  placeholder="Add a checklist item..."
                  placeholderTextColor="#9AA4B5"
                  style={s.input}
                  returnKeyType="done"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add checklist item"
                  onPress={add}
                  style={({ pressed }) => [s.addCircle, pressed && s.pressed]}
                >
                  <LinearGradient
                    colors={["#8BBDF7", "#9698F3", "#E597C7"]}
                    style={s.addCircleGradient}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.categoryFilters}
              >
                <Pressable
                  onPress={() => setFilter("All")}
                  style={[s.filterChip, filter === "All" && s.filterChipOn]}
                >
                  <Text style={[s.filterText, filter === "All" && s.filterTextOn]}>All</Text>
                </Pressable>
                {CATEGORIES.map((key) => {
                  const meta = CAT_META[key];
                  const active = filter === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setFilter(key);
                        setCategory(key);
                      }}
                      style={[s.filterChip, active && s.filterChipOn]}
                    >
                      <Ionicons name={meta.icon} size={13} color={active ? meta.fg : "#8892A3"} />
                      <Text style={[s.filterText, active && { color: meta.fg }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable accessibilityLabel="Reset checklist filters" onPress={resetFilters} style={s.tuneButton}>
                  <Ionicons name="options-outline" size={16} color="#6E7A8F" />
                </Pressable>
              </ScrollView>

              <View style={s.groupList}>
                {grouped.map((group) => {
                  const meta = CAT_META[group.key];
                  const isCollapsed = Boolean(collapsed[group.key]);
                  return (
                    <View key={group.key} style={s.groupCard}>
                      <Pressable onPress={() => toggleGroup(group.key)} style={s.groupHeader}>
                        <View style={[s.groupIcon, { backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={18} color={meta.fg} />
                        </View>
                        <Text style={s.groupTitle}>{meta.label}</Text>
                        <View style={s.groupCount}><Text style={s.groupCountText}>{group.items.length}</Text></View>
                        <Ionicons
                          name={isCollapsed ? "chevron-down" : "chevron-up"}
                          size={17}
                          color="#1F2937"
                        />
                      </Pressable>

                      {!isCollapsed ? (
                        <View style={s.groupBody}>
                          {group.items.map((item) => {
                            const current = itemStatus(item);
                            const itemMeta = CAT_META[item.category];
                            return (
                              <View key={item.id} style={s.itemRow}>
                                <Pressable
                                  accessibilityLabel={item.completed ? `Mark ${item.title} incomplete` : `Complete ${item.title}`}
                                  onPress={() => toggleChecklist(item.id)}
                                  style={[s.check, current === "completed" && s.checkDone]}
                                >
                                  {current === "completed" ? (
                                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                                  ) : null}
                                </Pressable>

                                <View style={[s.itemIcon, { backgroundColor: itemMeta.bg }]}>
                                  <Ionicons name={itemMeta.icon} size={17} color={itemMeta.fg} />
                                </View>

                                <View style={s.itemCopy}>
                                  <Text style={[s.itemTitle, current === "completed" && s.itemTitleDone]} numberOfLines={1}>
                                    {item.title}
                                  </Text>
                                  <Text style={[s.itemMeta, { color: itemMeta.fg }]}>{itemMeta.label}</Text>
                                </View>

                                {current === "pending" ? (
                                  <View style={s.pendingPill}>
                                    <View style={s.pendingDot} />
                                    <Text style={s.pendingPillText}>Pending</Text>
                                  </View>
                                ) : null}

                                <Pressable
                                  accessibilityLabel={`More options for ${item.title}`}
                                  onPress={() => setMenuItem(item)}
                                  style={s.moreButton}
                                >
                                  <Ionicons name="ellipsis-vertical" size={18} color="#72819A" />
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {grouped.length === 0 ? (
                  <View style={s.empty}>
                    <View style={s.emptyIcon}>
                      <Ionicons name={status === "completed" ? "checkmark-done-outline" : status === "pending" ? "time-outline" : "list-outline"} size={27} color="#829FDD" />
                    </View>
                    <Text style={s.emptyTitle}>
                      {status === "completed" ? "No completed tasks yet" : status === "pending" ? "No pending tasks" : "Your list is clear"}
                    </Text>
                    <Text style={s.emptySub}>
                      {status === "todo" ? "Add an item above or use suggested essentials to get started." : "Items moved into this status will appear here."}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>

        <EditModal
          key={editing?.id ?? "checklist-edit-closed"}
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(title, nextCategory) => {
            if (editing) updateChecklist(editing.id, { title, category: nextCategory });
            setEditing(null);
          }}
        />

        <ItemMenu
          key={menuItem?.id ?? "checklist-menu-closed"}
          item={menuItem}
          onClose={() => setMenuItem(null)}
          onEdit={() => {
            if (menuItem) setEditing(menuItem);
            setMenuItem(null);
          }}
          onMove={(next) => {
            if (menuItem) updateStatus(menuItem, next);
          }}
          onDelete={() => {
            if (menuItem) setDeleteTarget(menuItem);
            setMenuItem(null);
          }}
        />

        <ConfirmDelete
          key={deleteTarget?.id ?? "checklist-delete-closed"}
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDelete={() => {
            if (deleteTarget) deleteChecklist(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      </ScreenShell>
    </SafeAreaView>
  );
}

function EditModal({
  item,
  onClose,
  onSave,
}: {
  item: LocalChecklistItem | null;
  onClose(): void;
  onSave(title: string, category: LocalChecklistItem["category"]): void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState<LocalChecklistItem["category"]>(item?.category ?? "General");
  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalTitle}>Edit checklist item</Text>
              <Text style={s.modalSub}>Update the task name or category.</Text>
            </View>
            <Pressable onPress={onClose} style={s.close}>
              <Ionicons name="close" size={20} color="#65758C" />
            </Pressable>
          </View>

          <Text style={s.label}>Item</Text>
          <TextInput value={title} onChangeText={setTitle} style={s.modalInput} />

          <Text style={s.label}>Category</Text>
          <View style={s.editCategories}>
            {CATEGORIES.map((value) => {
              const meta = CAT_META[value];
              const active = category === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setCategory(value)}
                  style={[s.editCategory, active && s.editCategoryOn]}
                >
                  <Ionicons name={meta.icon} size={13} color={active ? meta.fg : "#8792A4"} />
                  <Text style={[s.editCategoryText, active && { color: meta.fg }]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => onSave(title.trim() || item.title, category)}
            style={({ pressed }) => [s.savePress, pressed && s.pressed]}
          >
            <LinearGradient colors={["#75C9F5", "#969AF5", "#EE9BC8"]} style={s.saveButton}>
              <Ionicons name="checkmark" size={17} color="#FFFFFF" />
              <Text style={s.saveText}>Save changes</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ItemMenu({
  item,
  onClose,
  onEdit,
  onMove,
  onDelete,
}: {
  item: LocalChecklistItem | null;
  onClose(): void;
  onEdit(): void;
  onMove(status: ChecklistStatus): void;
  onDelete(): void;
}) {
  if (!item) return null;
  const current = itemStatus(item);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel="Close checklist item menu" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={s.menuCard}>
          <View style={s.menuHandle} />
          <Text style={s.menuTitle} numberOfLines={1}>{item.title}</Text>
          <MenuAction icon="create-outline" label="Edit item" onPress={onEdit} />
          {current !== "todo" ? <MenuAction icon="list-outline" label="Move to To do" onPress={() => onMove("todo")} /> : null}
          {current !== "pending" ? <MenuAction icon="time-outline" label="Mark as pending" onPress={() => onMove("pending")} /> : null}
          {current !== "completed" ? <MenuAction icon="checkmark-circle-outline" label="Mark completed" onPress={() => onMove("completed")} /> : null}
          <MenuAction icon="trash-outline" label="Delete item" destructive onPress={onDelete} />
        </View>
      </View>
    </Modal>
  );
}

function MenuAction({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: TravaIconName;
  label: string;
  destructive?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.menuAction, pressed && s.menuActionPressed]}>
      <Ionicons name={icon} size={19} color={destructive ? "#D96682" : "#647793"} />
      <Text style={[s.menuActionText, destructive && s.menuActionDestructive]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#A2AABA" />
    </Pressable>
  );
}

function ConfirmDelete({
  item,
  onClose,
  onDelete,
}: {
  item: LocalChecklistItem | null;
  onClose(): void;
  onDelete(): void;
}) {
  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.modal, s.confirmModal]}>
          <View style={s.deleteCircle}>
            <Ionicons name="trash-outline" size={24} color="#D66F88" />
          </View>
          <Text style={s.confirmTitle}>Delete checklist item?</Text>
          <Text style={s.confirmBody}>{item.title}</Text>
          <View style={s.confirmActions}>
            <Pressable onPress={onClose} style={s.cancelButton}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={s.deleteButton}>
              <Text style={s.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { padding: 22, paddingBottom: 150 },
  max: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },

  hero: {
    minHeight: 184,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8E9F0",
    boxShadow: "0 16px 40px rgba(44,50,72,.08)",
    position: "relative",
  },
  heroCompact: { minHeight: 300 },
  visualWrap: { position: "absolute", left: 20, top: 18, width: 170, height: 150 },
  visualWrapCompact: { left: 14, top: 14, width: 142, height: 128 },
  visual: { width: "100%", height: "100%" },
  heroCopy: { position: "absolute", left: 194, top: 29, right: 140 },
  heroCopyCompact: { left: 20, right: 20, top: 155 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { color: "#B85F8B", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { marginTop: 10, color: PX.ink, fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 },
  heroSub: { marginTop: 4, color: "#697488", fontSize: 10, fontWeight: "700" },
  suggest: {
    marginTop: 12,
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,.88)",
    borderWidth: 1,
    borderColor: "rgba(225,228,239,.78)",
  },
  suggestText: { color: "#61718A", fontSize: 9, fontWeight: "900" },
  ring: { position: "absolute", right: 25, top: 37, width: 96, height: 96, borderRadius: 48 },
  ringCompact: { right: 20, top: 25, width: 88, height: 88 },
  ringGrad: { width: "100%", height: "100%", borderRadius: 999, padding: 8 },
  ringInner: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  ringPct: { color: PX.ink, fontSize: 20, fontWeight: "900" },
  ringCount: { marginTop: 1, color: "#727B8B", fontSize: 8.5, fontWeight: "900" },

  workspaceCard: {
    padding: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7ED",
    boxShadow: "0 12px 32px rgba(36,42,58,.055)",
  },
  statusTabs: {
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    backgroundColor: "#F3F3F4",
  },
  statusTab: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statusTabActive: {
    backgroundColor: "#111317",
    boxShadow: "0 7px 16px rgba(17,19,23,.16)",
  },
  statusTabText: { color: "#8C929D", fontSize: 9.5, fontWeight: "800" },
  statusTabTextActive: { color: "#FFFFFF", fontWeight: "900" },
  statusCount: { minWidth: 18, height: 18, borderRadius: 9, textAlign: "center", lineHeight: 18, color: "#7E8694", backgroundColor: "#E7E8EA", fontSize: 8, fontWeight: "900" },
  statusCountActive: { color: "#161A20", backgroundColor: "#FFFFFF" },

  addRow: {
    marginTop: 12,
    height: 44,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CDD8FB",
    boxShadow: "0 6px 16px rgba(110,128,190,.06)",
  },
  input: { flex: 1, color: PX.ink, fontSize: 10.5, fontWeight: "700" },
  addCircle: { width: 34, height: 34, borderRadius: 17, overflow: "hidden" },
  addCircleGradient: { flex: 1, alignItems: "center", justifyContent: "center" },

  categoryFilters: { marginTop: 10, gap: 7, alignItems: "center", paddingRight: 4 },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F6F7FA",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipOn: { backgroundColor: "#EEF3FF", borderColor: "#D8E0F7" },
  filterText: { color: "#7A8496", fontSize: 8.5, fontWeight: "800" },
  filterTextOn: { color: "#5B78C7", fontWeight: "900" },
  tuneButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F7F9" },

  groupList: { marginTop: 12, gap: 8 },
  groupCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF0",
  },
  groupHeader: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  groupIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  groupTitle: { flex: 1, color: PX.ink, fontSize: 11, fontWeight: "900" },
  groupCount: { minWidth: 28, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F2F6" },
  groupCountText: { color: "#647083", fontSize: 8.5, fontWeight: "900" },
  groupBody: { paddingHorizontal: 10, paddingBottom: 8 },

  itemRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ECEEF2",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#CBD3DF",
    backgroundColor: "#FFFFFF",
  },
  checkDone: { borderColor: "#F06DA8", backgroundColor: "#F06DA8" },
  itemIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { color: PX.ink, fontSize: 10, fontWeight: "800" },
  itemTitleDone: { color: "#9AA2AF", textDecorationLine: "line-through" },
  itemMeta: { marginTop: 2, fontSize: 7.5, fontWeight: "800" },
  pendingPill: { paddingHorizontal: 7, height: 22, borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F4F1FF" },
  pendingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#7B62DF" },
  pendingPillText: { color: "#7660D3", fontSize: 7.5, fontWeight: "900" },
  moreButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },

  empty: { paddingVertical: 34, alignItems: "center" },
  emptyIcon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF5FF" },
  emptyTitle: { marginTop: 10, color: PX.ink, fontSize: 12, fontWeight: "900" },
  emptySub: { marginTop: 4, maxWidth: 340, textAlign: "center", color: "#8490A2", fontSize: 9, lineHeight: 13, fontWeight: "600" },

  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(17,24,39,.40)" },
  modal: { width: "100%", maxWidth: 480, padding: 20, borderRadius: 26, backgroundColor: "#FFFFFF" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  modalTitle: { color: PX.ink, fontSize: 18, fontWeight: "900" },
  modalSub: { marginTop: 3, color: "#7B8799", fontSize: 9, fontWeight: "600" },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6F8" },
  label: { marginTop: 14, marginBottom: 6, color: "#59677E", fontSize: 9, fontWeight: "900" },
  modalInput: { height: 48, paddingHorizontal: 13, borderRadius: 15, color: PX.ink, backgroundColor: "#F7F8FB", borderWidth: 1, borderColor: "#E5E8EE" },
  editCategories: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  editCategory: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: "transparent" },
  editCategoryOn: { backgroundColor: "#F1F4FF", borderColor: "#D8E0F5" },
  editCategoryText: { color: "#7E889A", fontSize: 8.5, fontWeight: "800" },
  savePress: { marginTop: 17, height: 48, borderRadius: 24, overflow: "hidden" },
  saveButton: { flex: 1, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  saveText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },

  menuCard: { width: "100%", maxWidth: 420, borderRadius: 26, padding: 16, backgroundColor: "#FFFFFF" },
  menuHandle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "#E1E4E9", marginBottom: 12 },
  menuTitle: { color: PX.ink, fontSize: 13, fontWeight: "900", marginBottom: 8 },
  menuAction: { minHeight: 48, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ECEEF2" },
  menuActionPressed: { backgroundColor: "#F8F9FB" },
  menuActionText: { flex: 1, color: "#536177", fontSize: 10.5, fontWeight: "800" },
  menuActionDestructive: { color: "#D96682" },

  confirmModal: { maxWidth: 400, alignItems: "center" },
  deleteCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F4" },
  confirmTitle: { marginTop: 14, color: PX.ink, fontSize: 17, fontWeight: "900" },
  confirmBody: { marginTop: 5, color: "#7E899B", fontSize: 10, fontWeight: "700", textAlign: "center" },
  confirmActions: { width: "100%", marginTop: 18, flexDirection: "row", gap: 9 },
  cancelButton: { flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F3F6" },
  cancelText: { color: "#69768A", fontSize: 10, fontWeight: "900" },
  deleteButton: { flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#E9849C" },
  deleteButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
});
