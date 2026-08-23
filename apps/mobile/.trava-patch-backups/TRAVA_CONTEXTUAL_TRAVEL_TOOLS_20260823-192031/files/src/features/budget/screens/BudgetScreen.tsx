import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Glass, PX, ScreenShell, Soft3DIcon, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalExpense } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const coins = require("../../../../assets/trava-pixel/budget-coins.png");
const CATEGORIES = ["Food & Dining", "Accommodation", "Transportation", "Activities", "Shopping", "Other"] as const;
const EXPENSE_META: Record<string, { icon: TravaIconName; colors: [string, string]; tilt: number }> = {
  "Food & Dining": { icon: "restaurant-outline", colors: ["#F28FB0", "#FFC1D3"], tilt: -4 },
  Accommodation: { icon: "bed-outline", colors: ["#8C80E7", "#C7BDF8"], tilt: 3 },
  Transportation: { icon: "airplane-outline", colors: ["#69ACE7", "#B8DCF8"], tilt: -3 },
  Activities: { icon: "ticket-outline", colors: ["#66BFA2", "#B4E6D4"], tilt: 4 },
  Shopping: { icon: "bag-handle-outline", colors: ["#E79A62", "#FFD0A7"], tilt: -3 },
  Other: { icon: "receipt-outline", colors: ["#7B8596", "#BDC5D0"], tilt: 2 },
};

type AmountMode = "set" | "topup" | null;

export function BudgetScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, setTotalBudget, addExpense, updateExpense, deleteExpense } = useLocalTripWorkspace(tripId);
  const [editor, setEditor] = useState<LocalExpense | null | "new">(null);
  const [amountMode, setAmountMode] = useState<AmountMode>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [range, setRange] = useState<"month" | "all">("month");

  const spent = useMemo(() => state.expenses.reduce((sum, e) => sum + e.amount, 0), [state.expenses]);
  const remaining = Math.max(0, state.totalBudget - spent);
  const percentRemaining = state.totalBudget ? Math.max(0, Math.min(100, Math.round((remaining / state.totalBudget) * 100))) : 0;

  async function sendBudget() {
    await Share.share({
      title: `${trip.name || "Trip"} budget`,
      message: `${trip.name || "Trip"} budget\nTotal: ₱${formatMoney(state.totalBudget)}\nSpent: ₱${formatMoney(spent)}\nRemaining: ₱${formatMoney(remaining)}`,
    }).catch(() => Alert.alert("Share budget", "Unable to open the share sheet on this device."));
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Japan"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <LinearGradient colors={["#EEF7FF", "#F4F2FF", "#FFF2F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroCopy}><Text style={s.balanceLabel}>Available Balance</Text><Text style={s.balance}>₱{formatMoney(remaining)}</Text><Text style={s.remains}><Text style={s.remainsStrong}>{percentRemaining}%</Text> of your trip budget remains</Text></View>
        <Image source={coins} contentFit="contain" style={s.coins}/>
        <Pressable accessibilityLabel="Edit total trip budget" onPress={() => setAmountMode("set")} style={s.heroEdit}><Ionicons name="create-outline" size={20} color={PX.ink}/></Pressable>
      </LinearGradient>

      <View style={s.metrics}>
        <Glass style={s.metric}><View style={[s.metricIcon, { backgroundColor: "#EAF5FF" }]}><Ionicons name="wallet-outline" size={24} color="#6699D0"/></View><View style={s.metricCopy}><Text style={s.metricLabel}>Remaining Budget</Text><Text style={s.metricValue}>₱{formatMoney(remaining)}</Text><Text style={s.metricSub}>of ₱{formatMoney(state.totalBudget)}</Text></View></Glass>
        <Glass style={s.metric}><View style={[s.metricIcon, { backgroundColor: "#FFF0F6" }]}><Ionicons name="trending-up-outline" size={24} color="#D97FA9"/></View><View style={s.metricCopy}><Text style={s.metricLabel}>Total Spent</Text><Text style={s.metricValue}>₱{formatMoney(spent)}</Text><Text style={s.metricSub}>{state.expenses.length} saved expenses</Text></View></Glass>
      </View>

      <View style={s.actions}>
        <Action icon="add-outline" label="Add expense" colors={["#E9F5FF", "#DDEEFF"]} onPress={() => setEditor("new")}/>
        <Action icon="swap-horizontal-outline" label="Move" colors={["#EBF9F5", "#DDF4ED"]} onPress={() => setMoveOpen(true)}/>
        <Action icon="share-outline" label="Send" colors={["#F0F1FF", "#E5E8FF"]} onPress={() => void sendBudget()}/>
        <Action icon="add-circle-outline" label="Top up" colors={["#FFF2F7", "#FFE6F1"]} onPress={() => setAmountMode("topup")}/>
      </View>

      <Glass style={s.chartCard}>
        <View style={s.chartHead}><View><Text style={s.sectionTitle}>Expenses Overview</Text><Text style={s.sectionSub}>Based on the expenses saved to this trip</Text></View><Pressable onPress={() => setRange((v) => v === "month" ? "all" : "month")} style={s.month}><Text style={s.monthText}>{range === "month" ? "This Month" : "All Time"}</Text><Ionicons name="chevron-down" size={13} color="#52617C"/></Pressable></View>
        <TrendChart expenses={state.expenses}/>
      </Glass>

      <Glass style={s.recent}>
        <View style={s.recentHead}><Text style={s.sectionTitle}>Recent Expenses</Text><Pressable onPress={() => setEditor("new")} style={s.addLinkButton}><Ionicons name="add" size={16} color="#6D93CF"/><Text style={s.addLink}>Add</Text></Pressable></View>
        {state.expenses.slice(0, 5).map((e) => <CompactExpenseRow key={e.id} expense={e} onEdit={() => setEditor(e)} onDelete={() => Alert.alert("Delete expense?", e.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteExpense(e.id) }])}/>) }
        {state.expenses.length > 5 ? <Text style={s.moreCount}>+{state.expenses.length - 5} more saved expenses</Text> : null}
        <Pressable onPress={() => setManageOpen(true)} style={s.manageExpenses}><Ionicons name="list-outline" size={17} color="#56657A"/><Text style={s.manageExpensesText}>Manage expenses</Text><Ionicons name="chevron-forward" size={16} color="#8A94A4"/></Pressable>
      </Glass>
    </View></ScrollView>
    <ExpenseModal key={`budget-expense-${editor === "new" ? "new" : editor?.id ?? "idle"}`} value={editor} onClose={() => setEditor(null)} onSave={(v) => { if (editor && editor !== "new") updateExpense(editor.id, v); else addExpense({ ...v, shared: false, paid: true }); setEditor(null); }}/>
    <BudgetAmountModal key={`${amountMode}-${state.totalBudget}`} mode={amountMode} total={state.totalBudget} onClose={() => setAmountMode(null)} onSave={(amount) => { setTotalBudget(amountMode === "topup" ? state.totalBudget + amount : amount); setAmountMode(null); }}/>
    <MoveExpenseModal key={`${moveOpen}-${state.expenses.length}`} visible={moveOpen} expenses={state.expenses} onClose={() => setMoveOpen(false)} onMove={(id, category) => { updateExpense(id, { category }); setMoveOpen(false); }}/>
    <ManageExpensesModal visible={manageOpen} expenses={state.expenses} onClose={() => setManageOpen(false)} onEdit={(expense) => { setManageOpen(false); setEditor(expense); }} onDelete={(expense) => Alert.alert("Delete expense?", expense.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteExpense(expense.id) }])}/>
  </ScreenShell></SafeAreaView>;
}

function Action({ icon, label, colors, onPress }: { icon: TravaIconName; label: string; colors: readonly [string, string]; onPress(): void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.action, pressed && s.pressed]}><LinearGradient colors={colors} style={s.actionCircle}><Ionicons name={icon} size={24} color="#657DA5"/></LinearGradient><Text style={s.actionLabel}>{label}</Text></Pressable>;
}

function TrendChart({ expenses }: { expenses: LocalExpense[] }) {
  const values = useMemo(() => {
    const recent = expenses.slice(0, 8).reverse().map((item) => Math.max(0, Number(item.amount) || 0));
    const data = recent.length ? recent : [0];
    const max = Math.max(...data, 1);
    return data.map((value) => ({ value, height: Math.max(8, Math.round((value / max) * 112)) }));
  }, [expenses]);
  const total = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return <View style={s.chart}>
    <View style={s.chartSummary}><Text style={s.chartTotal}>₱{formatMoney(total)}</Text><Text style={s.chartCaption}>live saved spending</Text></View>
    <View style={s.bars}>{values.map((item, index) => <View key={`bar-${index}-${item.value}`} style={s.barColumn}><View style={[s.bar,{height:item.height}]}/><View style={s.barDot}/></View>)}</View>
    <View style={s.xLabels}><Text style={s.axis}>Older</Text><Text style={s.axis}>Recent spending</Text><Text style={s.axis}>Latest</Text></View>
  </View>;
}

function CompactExpenseRow({ expense, onEdit, onDelete }: { expense: LocalExpense; onEdit(): void; onDelete(): void }) {
  const meta = EXPENSE_META[expense.category] ?? EXPENSE_META.Other;
  return <View style={s.expenseRow}><View style={s.expenseMini}><Soft3DIcon colors={meta.colors} icon={meta.icon} foreground="#FFFFFF" size={38} tilt={meta.tilt}/></View><View style={s.expenseCopy}><Text style={s.expenseTitle}>{expense.title}</Text><Text style={s.expenseMeta}>{expense.date} · {expense.category}</Text></View><Text style={s.expenseAmount}>₱{formatMoney(expense.amount)}</Text><Pressable accessibilityLabel={`Edit ${expense.title}`} onPress={onEdit} style={s.rowBtn}><Ionicons name="create-outline" size={17} color="#6C82A4"/></Pressable><Pressable accessibilityLabel={`Delete ${expense.title}`} onPress={onDelete} style={s.rowBtn}><Ionicons name="trash-outline" size={17} color="#D86E82"/></Pressable></View>;
}

function ManageExpensesModal({ visible, expenses, onClose, onEdit, onDelete }: { visible: boolean; expenses: LocalExpense[]; onClose(): void; onEdit(expense: LocalExpense): void; onDelete(expense: LocalExpense): void }) {
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal,s.manageModal]}><View style={s.modalHeader}><View><Text style={s.modalTitle}>Manage expenses</Text><Text style={s.modalSub}>{expenses.length} saved expense{expenses.length===1?"":"s"}</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><ScrollView style={s.manageScroll} contentContainerStyle={{paddingTop:8}}>{expenses.map((expense)=><CompactExpenseRow key={`manage-${expense.id}`} expense={expense} onEdit={()=>onEdit(expense)} onDelete={()=>onDelete(expense)}/>)}</ScrollView><Pressable onPress={onClose} style={s.manageDone}><Text style={s.manageDoneText}>Done</Text></Pressable></View></View></Modal>;
}

function ExpenseModal({ value, onClose, onSave }: { value: LocalExpense | null | "new"; onClose(): void; onSave(v: Omit<LocalExpense, "id" | "shared" | "paid">): void }) {
  const e = value && value !== "new" ? value : null;
  const [title, setTitle] = useState(e?.title ?? "");
  const [amount, setAmount] = useState(e ? String(e.amount) : "");
  const [category, setCategory] = useState(e?.category ?? "Food & Dining");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [error, setError] = useState("");
  if (!value) return null;
  const save = () => { const numeric = Number(amount); if (!title.trim()) return setError("Add an expense name."); if (!Number.isFinite(numeric) || numeric <= 0) return setError("Enter an amount greater than zero."); onSave({ title: title.trim(), amount: numeric, category, date: e?.date ?? "Today" }); };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHeader}><View><Text style={s.modalTitle}>{e ? "Edit expense" : "Add expense"}</Text><Text style={s.modalSub}>Save it locally to this trip.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><Text style={s.label}>Expense name</Text><TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Taxi, dinner, hotel…" placeholderTextColor="#9BA6B8"/><Text style={s.label}>Amount</Text><View style={s.moneyInput}><Text style={s.currency}>₱</Text><TextInput style={s.moneyField} value={amount} onChangeText={(v) => setAmount(cleanMoney(v))} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor="#9BA6B8"/></View><Text style={s.label}>Category</Text><Pressable onPress={() => setCategoryOpen((v) => !v)} style={s.select}><Text style={s.selectText}>{category}</Text><Ionicons name={categoryOpen ? "chevron-up" : "chevron-down"} size={17} color="#72809A"/></Pressable>{categoryOpen ? <View style={s.selectMenu}>{CATEGORIES.map((c) => <Pressable key={c} onPress={() => { setCategory(c); setCategoryOpen(false); }} style={[s.selectOption, c === category && s.selectOptionOn]}><Text style={s.selectOptionText}>{c}</Text>{c === category ? <Ionicons name="checkmark" size={16} color="#6E94CF"/> : null}</Pressable>)}</View> : null}{error ? <Text style={s.error}>{error}</Text> : null}<View style={s.modalBtns}><Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={save} style={s.savePress}><LinearGradient colors={["#88BDF4", "#ADB0F5", "#EEA3C6"]} style={s.save}><Text style={s.saveText}>Save expense</Text></LinearGradient></Pressable></View></View></View></Modal>;
}

function BudgetAmountModal({ mode, total, onClose, onSave }: { mode: AmountMode; total: number; onClose(): void; onSave(value: number): void }) {
  const [amount, setAmount] = useState(mode === "set" ? String(total) : ""); const [error, setError] = useState(""); if (!mode) return null;
  const submit = () => { const value = Number(amount); if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero."); onSave(value); };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><Text style={s.modalTitle}>{mode === "set" ? "Edit total budget" : "Top up trip budget"}</Text><Text style={s.modalSub}>{mode === "set" ? "Set the full amount available for this trip." : "Add funds to the current trip budget."}</Text><Text style={s.label}>Amount</Text><View style={s.moneyInput}><Text style={s.currency}>₱</Text><TextInput autoFocus style={s.moneyField} value={amount} onChangeText={(v) => setAmount(cleanMoney(v))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9BA6B8"/></View>{error ? <Text style={s.error}>{error}</Text> : null}<View style={s.modalBtns}><Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={submit} style={s.savePress}><LinearGradient colors={["#88BDF4", "#ADB0F5", "#EEA3C6"]} style={s.save}><Text style={s.saveText}>{mode === "set" ? "Update budget" : "Add funds"}</Text></LinearGradient></Pressable></View></View></View></Modal>;
}

function MoveExpenseModal({ visible, expenses, onClose, onMove }: { visible: boolean; expenses: LocalExpense[]; onClose(): void; onMove(id: string, category: string): void }) {
  const [expenseId, setExpenseId] = useState(expenses[0]?.id ?? ""); const [category, setCategory] = useState<string>(expenses[0]?.category ?? "Other"); if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><Text style={s.modalTitle}>Move an expense</Text><Text style={s.modalSub}>Reclassify a saved expense into another budget category.</Text><Text style={s.label}>Expense</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{expenses.map((e) => <Pressable key={e.id} onPress={() => { setExpenseId(e.id); setCategory(e.category); }} style={[s.chip, expenseId === e.id && s.chipOn]}><Text numberOfLines={1} style={[s.chipText, expenseId === e.id && s.chipTextOn]}>{e.title}</Text></Pressable>)}</ScrollView><Text style={s.label}>Move to</Text><View style={s.categoryGrid}>{CATEGORIES.map((c) => <Pressable key={c} onPress={() => setCategory(c)} style={[s.categoryChoice, category === c && s.categoryChoiceOn]}><Text style={[s.categoryChoiceText, category === c && s.categoryChoiceTextOn]}>{c}</Text></Pressable>)}</View><View style={s.modalBtns}><Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => expenseId && onMove(expenseId, category)} style={s.savePress}><LinearGradient colors={["#88BDF4", "#ADB0F5", "#EEA3C6"]} style={s.save}><Text style={s.saveText}>Move expense</Text></LinearGradient></Pressable></View></View></View></Modal>;
}

function cleanMoney(value: string) { const cleaned = value.replace(/[^0-9.]/g, ""); const [whole, ...rest] = cleaned.split("."); return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole; }
function formatMoney(value: number) { return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" }, scroll: { padding: 22, paddingBottom: 130 }, max: { width: "100%", maxWidth: 640, alignSelf: "center", gap: 16 },
  hero: { height: 260, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "#E9EFF8", boxShadow: "0 16px 38px rgba(78,92,125,.10)" }, heroCopy: { position: "absolute", left: 28, top: 44, zIndex: 3 }, balanceLabel: { color: "#607FB0", fontSize: 18, fontWeight: "700" }, balance: { marginTop: 12, color: PX.ink, fontSize: 42, lineHeight: 49, fontWeight: "900", letterSpacing: -1.2 }, remains: { marginTop: 12, color: "#55648E", fontSize: 14, fontWeight: "600" }, remainsStrong: { fontWeight: "900" }, coins: { position: "absolute", width: 270, height: 220, right: -2, bottom: -10 }, heroEdit: { position: "absolute", right: 18, top: 18, width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.88)", borderWidth: 1, borderColor: "rgba(255,255,255,.95)" },
  metrics: { flexDirection: "row", gap: 12 }, metric: { flex: 1, minHeight: 112, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, metricIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }, metricCopy: { flex: 1, minWidth: 0 }, metricLabel: { color: "#56668E", fontSize: 12, fontWeight: "600" }, metricValue: { marginTop: 5, color: PX.ink, fontSize: 18, fontWeight: "900" }, metricSub: { marginTop: 5, color: "#607092", fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10 }, action: { flex: 1, minHeight: 104, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", borderWidth: 1, borderColor: "#ECEEF4", boxShadow: "0 10px 24px rgba(71,75,107,.06)" }, pressed: { opacity: .72, transform: [{ scale: .98 }] }, actionCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, actionLabel: { marginTop: 8, color: PX.ink, fontSize: 11, textAlign: "center", fontWeight: "800" },
  chartCard: { borderRadius: 24, padding: 18 }, chartHead: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, sectionTitle: { color: PX.ink, fontSize: 17, fontWeight: "900" }, sectionSub: { marginTop: 2, color: PX.muted, fontSize: 10, fontWeight: "600" }, month: { height: 38, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F6F8FC" }, monthText: { color: "#52617C", fontSize: 9, fontWeight: "900" }, chart: { height: 190, marginTop: 14, overflow: "hidden", borderRadius: 20, backgroundColor: "#FBFDFF", paddingHorizontal:16, paddingTop:14 }, chartSummary:{flexDirection:"row",alignItems:"baseline",gap:8},chartTotal:{color:PX.ink,fontSize:18,fontWeight:"900"},chartCaption:{color:PX.muted,fontSize:8,fontWeight:"700"},bars:{flex:1,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-around",paddingHorizontal:8,paddingBottom:28},barColumn:{width:22,alignItems:"center",justifyContent:"flex-end"},bar:{width:8,borderRadius:5,backgroundColor:"#83AFE8",minHeight:8},barDot:{width:12,height:12,borderRadius:6,marginTop:-3,borderWidth:3,borderColor:"#83AFE8",backgroundColor:"#FFF"}, xLabels: { position: "absolute", left: 12, right: 12, bottom: 10, flexDirection: "row", justifyContent: "space-between" }, axis: { color: "#73829B", fontSize: 8, fontWeight: "700" },
  recent: { borderRadius: 24, padding: 18 }, recentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, addLinkButton: { flexDirection: "row", alignItems: "center", gap: 2 }, addLink: { color: "#6D93CF", fontSize: 10, fontWeight: "900" }, expenseRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#EEF0F5" }, expenseMini: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow:"hidden", borderWidth:1, borderColor:"rgba(255,255,255,.9)" }, miniHighlight:{position:"absolute",top:4,left:7,right:7,height:8,borderRadius:5,backgroundColor:"rgba(255,255,255,.55)"}, expenseCopy: { flex: 1, minWidth: 0 }, expenseTitle: { color: PX.ink, fontSize: 12, fontWeight: "900" }, expenseMeta: { marginTop: 3, color: PX.muted, fontSize: 8, fontWeight: "600" }, expenseAmount: { color: PX.ink, fontSize: 11, fontWeight: "900" }, rowBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FC" }, moreCount:{paddingVertical:8,color:PX.muted,fontSize:9,fontWeight:"700"},manageExpenses:{marginTop:10,minHeight:48,paddingHorizontal:14,borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#F7F8FA",borderWidth:1,borderColor:"#E6E9EE"},manageExpensesText:{flex:1,textAlign:"center",color:"#4B5566",fontSize:10,fontWeight:"900"},
  manageModal:{maxWidth:560,maxHeight:"84%"},manageScroll:{maxHeight:520},manageDone:{marginTop:12,minHeight:46,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#22262B"},manageDoneText:{color:"#FFF",fontSize:10,fontWeight:"900"},backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(12,18,38,.42)" }, modal: { width: "100%", maxWidth: 460, padding: 20, borderRadius: 26, backgroundColor: "#FFF", boxShadow: "0 20px 50px rgba(25,32,54,.16)" }, modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }, modalTitle: { color: PX.ink, fontSize: 19, fontWeight: "900" }, modalSub: { marginTop: 4, color: PX.muted, fontSize: 9, fontWeight: "600" }, close: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" }, label: { marginTop: 14, marginBottom: 6, color: "#526079", fontSize: 9, fontWeight: "900" }, input: { minHeight: 49, paddingHorizontal: 13, borderRadius: 15, backgroundColor: "#F6F8FC", borderWidth: 1, borderColor: "#E8ECF3", color: PX.ink, fontSize: 11, fontWeight: "700" }, moneyInput: { height: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", backgroundColor: "#F6F8FC", borderWidth: 1, borderColor: "#E8ECF3" }, currency: { marginLeft: 14, color: "#63789A", fontSize: 14, fontWeight: "900" }, moneyField: { flex: 1, height: "100%", paddingHorizontal: 10, color: PX.ink, fontSize: 12, fontWeight: "800" }, select: { height: 49, paddingHorizontal: 13, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F6F8FC", borderWidth: 1, borderColor: "#E8ECF3" }, selectText: { color: PX.ink, fontSize: 11, fontWeight: "800" }, selectMenu: { marginTop: 6, overflow: "hidden", borderRadius: 15, borderWidth: 1, borderColor: "#E6EBF2", backgroundColor: "#FFF" }, selectOption: { minHeight: 39, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectOptionOn: { backgroundColor: "#EFF7FF" }, selectOptionText: { color: "#56657D", fontSize: 10, fontWeight: "700" }, error: { marginTop: 9, color: "#C46172", fontSize: 9, fontWeight: "700" }, modalBtns: { marginTop: 17, flexDirection: "row", gap: 9 }, cancel: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#EEF0F5" }, cancelText: { color: "#5F6B80", fontSize: 10, fontWeight: "900" }, savePress: { flex: 1.7 }, save: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15 }, saveText: { color: "#FFF", fontSize: 10, fontWeight: "900" }, chips: { gap: 7, paddingBottom: 2 }, chip: { maxWidth: 170, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 15, backgroundColor: "#F6F8FB", borderWidth: 1, borderColor: "#E8ECF2" }, chipOn: { backgroundColor: "#EBF5FF", borderColor: "#C9DDF5" }, chipText: { color: "#6D7890", fontSize: 9, fontWeight: "800" }, chipTextOn: { color: "#5D86C6" }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, categoryChoice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 15, backgroundColor: "#F6F8FB", borderWidth: 1, borderColor: "#E8ECF2" }, categoryChoiceOn: { backgroundColor: "#EEF6FF", borderColor: "#C8DDF5" }, categoryChoiceText: { color: "#6E7990", fontSize: 9, fontWeight: "800" }, categoryChoiceTextOn: { color: "#5D86C6" },
});
