import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TripExpense, TripMember } from "@trava/shared";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { createExpense, deleteExpense, listExpenses, updateExpense, type ExpenseInput } from "../api/expenses.api";

export function ExpensesScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ open: boolean; expense: TripExpense | null }>({ open: false, expense: null });
  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId), staleTime: 30_000 });
  const expenseQuery = useQuery({ queryKey: ["trip-expenses", tripId], queryFn: () => listExpenses(tripId), enabled: Boolean(tripId), staleTime: 15_000 });
  const trip = tripQuery.data;
  const expenses = expenseQuery.data?.expenses ?? [];
  const members = expenseQuery.data?.members ?? [];

  const save = useMutation({
    mutationFn: ({ expense, value }: { expense: TripExpense | null; value: ExpenseInput }) =>
      expense ? updateExpense(tripId, expense.id, value) : createExpense(tripId, value),
    onSuccess: async () => {
      setEditor({ open: false, expense: null });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trip-expenses", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["trip-budget", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["home-dashboard"] }),
      ]);
    },
    onError: (error) => Alert.alert("Expense", error instanceof Error ? error.message : "Unable to save expense."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(tripId, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trip-expenses", tripId] }),
        queryClient.invalidateQueries({ queryKey: ["trip-budget", tripId] }),
      ]);
    },
    onError: (error) => Alert.alert("Expense", error instanceof Error ? error.message : "Unable to delete expense."),
  });

  const personal = expenses.filter((expense) => expense.createdBy === user?.id || expense.splitMethod === "payer_only");
  const shared = expenses.filter((expense) => expense.splits.length > 1 || expense.splitMethod !== "payer_only");
  const totalShared = shared.reduce((sum, expense) => sum + expense.amount, 0);
  const myShared = shared.reduce((sum, expense) => sum + (expense.splits.find((split) => split.userId === user?.id)?.amount ?? 0), 0);
  const avgPerPerson = members.length ? totalShared / members.length : totalShared;
  const latestShared = shared.slice().sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));

  if (!trip) {
    return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" size="large" /> : <Text style={styles.error}>Trip unavailable.</Text>}</SafeAreaView>;
  }

  async function shareInvoice(mode: "reminder" | "invoice" | "receipt") {
    const summary = [
      `TRAVA · ${trip.name}`,
      `Shared trip expenses: ${money(totalShared, trip.currencyCode)}`,
      `Average per traveler: ${money(avgPerPerson, trip.currencyCode)}`,
      `Your current shared allocation: ${money(myShared, trip.currencyCode)}`,
      "",
      ...latestShared.slice(0, 12).map((expense) => `${expense.expenseDate} · ${expense.title} · ${money(expense.amount, trip.currencyCode)}`),
    ].join("\n");
    const prefix = mode === "reminder" ? "Payment reminder\n\n" : mode === "receipt" ? "TRAVA expense receipt\n\n" : "TRAVA trip invoice\n\n";
    await Share.share({ title: `${trip.name} expenses`, message: prefix + summary });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={expenseQuery.isRefetching} onRefresh={() => void expenseQuery.refetch()} tintColor="#7257EC" />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.maxWidth}>
          <View style={styles.headingRow}>
            <View><Text style={styles.eyebrow}>TRIP FINANCES</Text><Text style={styles.heading}>Expenses</Text></View>
            <View style={styles.headingActions}><View style={styles.searchPill}><Text style={styles.searchGlyph}>⌕</Text><Text style={styles.searchText}>Search</Text></View><View style={styles.morePill}><Text style={styles.moreText}>⋮</Text></View></View>
          </View>

          <View style={styles.folderGrid}>
            <Pressable style={styles.folderPress}>
              <View style={styles.folderTabBlue} />
              <LinearGradient colors={["#F2F6FF", "#EAF1FF"]} style={styles.folderBlue}>
                <LinearGradient colors={["#FFFBEF", "#FFFFFF", "#E7F0FF"]} style={styles.folderArt}><Text style={styles.folderEmoji}>🌼 🌸 🌺</Text></LinearGradient>
                <View style={styles.folderBadge}><Text style={styles.folderBadgeText}>♙</Text></View>
                <Text style={styles.folderTitle}>Personal Expenses</Text><Text style={styles.folderCount}>{personal.length} items</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.folderPress}>
              <View style={styles.folderTabPink} />
              <LinearGradient colors={["#FFF1F6", "#FFF4F7"]} style={styles.folderPink}>
                <LinearGradient colors={["#FFF0F8", "#FFFFFF", "#FFF3DB"]} style={styles.folderArt}><Text style={styles.folderEmoji}>🌷 🌻 🌹</Text></LinearGradient>
                <View style={[styles.folderBadge, styles.folderBadgePink]}><Text style={[styles.folderBadgeText, { color: "#F05C8A" }]}>♙</Text></View>
                <Text style={styles.folderTitle}>Shared Expenses</Text><Text style={styles.folderCount}>{shared.length} items</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.sharedHeading}>
            <View><Text style={styles.sectionTitle}>Shared Expenses</Text><Text style={styles.sectionMeta}>{money(totalShared, trip.currencyCode)} total trip spending</Text></View>
            <Pressable onPress={() => setEditor({ open: true, expense: null })}><Text style={styles.addExpense}>＋ Add Expense</Text></Pressable>
          </View>

          <View style={styles.sharedList}>
            {latestShared.map((expense) => {
              const canEdit = expenseQuery.data?.canEditAll || expense.createdBy === user?.id;
              return (
                <View key={expense.id} style={styles.expenseRow}>
                  <View style={styles.expenseIcon}><Text style={styles.expenseGlyph}>▤</Text></View>
                  <View style={styles.expenseCopy}><Text style={styles.expenseTitle}>{expense.title}</Text><Text style={styles.expenseMeta}>😎 Paid by {expense.paidByName} · {new Date(`${expense.expenseDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text></View>
                  <View style={styles.expenseRight}><Text style={styles.amount}>{money(expense.amount, trip.currencyCode)}</Text><View style={styles.paidPill}><Text style={styles.paidText}>Paid⌄</Text></View></View>
                  {canEdit ? <View style={styles.rowActions}><Pressable onPress={() => setEditor({ open: true, expense })}><Text style={styles.rowAction}>⌁</Text></Pressable><Pressable onPress={() => Alert.alert("Delete expense?", expense.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(expense.id) }])}><Text style={styles.rowAction}>♲</Text></Pressable></View> : null}
                </View>
              );
            })}
            {!latestShared.length && !expenseQuery.isLoading ? <View style={styles.empty}><Text style={styles.emptyTitle}>No shared expenses yet</Text><Text style={styles.emptyText}>Add a shared expense and TRAVA will split it across your selected travelers.</Text></View> : null}
          </View>

          <Pressable style={styles.manage}><Text style={styles.manageText}>♙ Manage Shared Expenses</Text></Pressable>

          <LinearGradient colors={["#FFF0F5", "#FFF8FB"]} style={styles.invoice}>
            <View style={styles.invoiceHeader}><View><Text style={styles.invoiceTitle}>▤  Invoice Generator</Text><Text style={styles.invoiceSub}>Create a share trip invoice</Text></View><Text style={styles.briefcase}>💼</Text></View>
            <View style={styles.invoicePaper}>
              <Text style={styles.invoiceName}>Trip Invoice — {trip.name}</Text>
              <View style={styles.invoiceDivider} />
              <View style={styles.invoiceValues}>
                <View><Text style={styles.invoiceLabel}>Total</Text><Text style={styles.invoiceValue}>{money(totalShared, trip.currencyCode)}</Text></View>
                <View><Text style={styles.invoiceLabel}>Per Person</Text><Text style={styles.invoiceValue}>{money(avgPerPerson, trip.currencyCode)}</Text></View>
                <View style={styles.memberStack}>{members.slice(0,3).map((member, i) => <View key={member.id} style={[styles.memberDot, { marginLeft: i ? -6 : 0 }]}><Text style={styles.memberInitial}>{member.fullName.slice(0,1)}</Text></View>)}</View>
              </View>
              <View style={styles.invoiceActions}>
                <Pressable onPress={() => void shareInvoice("reminder")} style={styles.reminder}><Text style={styles.reminderText}>➤ Send Reminder</Text></Pressable>
                <Pressable onPress={() => void shareInvoice("invoice")} style={styles.invoiceButton}><Text style={styles.invoiceButtonText}>⇩ Download Invoice</Text></Pressable>
                <Pressable onPress={() => void shareInvoice("receipt")} style={[styles.invoiceButton, styles.invoiceButtonOutline]}><Text style={styles.invoiceButtonText}>▧ Generate Receipt</Text></Pressable>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.personalPanel}>
            <Text style={styles.sectionTitle}>Personal Expenses</Text>
            {personal.slice(0, 6).map((expense) => (
              <View key={expense.id} style={styles.personalRow}><Text style={styles.personalTitle}>{expense.title}</Text><Text style={styles.personalAmount}>{money(expense.amount, trip.currencyCode)}</Text></View>
            ))}
          </View>
        </View>
      </ScrollView>

      <ExpenseModal
        key={`${editor.open}-${editor.expense?.id ?? "new"}`}
        visible={editor.open}
        expense={editor.expense}
        members={members}
        userId={user?.id ?? ""}
        currency={trip.currencyCode}
        saving={save.isPending}
        onClose={() => setEditor({ open: false, expense: null })}
        onSave={(value) => save.mutate({ expense: editor.expense, value })}
      />
    </SafeAreaView>
  );
}

function ExpenseModal({ visible, expense, members, userId, currency, saving, onClose, onSave }: { visible:boolean; expense:TripExpense|null; members:TripMember[]; userId:string; currency:string; saving:boolean; onClose():void; onSave(value:ExpenseInput):void }) {
  const accepted = members.filter((member) => member.status === "accepted");
  const defaultPayer = expense?.paidBy || userId || accepted[0]?.userId || "";
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "Food");
  const [date, setDate] = useState(expense?.expenseDate ?? new Date().toISOString().slice(0,10));
  const [paidBy, setPaidBy] = useState(defaultPayer);
  const [shared, setShared] = useState(expense ? expense.splitMethod !== "payer_only" : true);
  const [error, setError] = useState<string|null>(null);

  function submit() {
    const numeric = Number(amount);
    if (title.trim().length < 2 || !Number.isFinite(numeric) || numeric <= 0 || !paidBy) { setError("Add a title, amount, and payer."); return; }
    const splitUsers = shared ? accepted : accepted.filter((m) => m.userId === paidBy);
    const target = splitUsers.length ? splitUsers : accepted.slice(0,1);
    const each = target.length ? numeric / target.length : numeric;
    onSave({
      title: title.trim(),
      description: expense?.description ?? null,
      category: category.trim() || "Other",
      amount: numeric,
      expenseDate: date,
      paidBy,
      splitMethod: shared ? "equal" : "payer_only",
      receiptStoragePath: expense?.receiptStoragePath ?? null,
      notes: expense?.notes ?? null,
      splits: target.map((member, index) => ({ userId: member.userId, amount: index === target.length - 1 ? numeric - each * (target.length - 1) : each })),
    });
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modal}>
    <View style={styles.modalHead}><Text style={styles.modalTitle}>{expense ? "Edit Expense" : "Add Expense"}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
      <Label text="Expense title" /><TextInput value={title} onChangeText={setTitle} placeholder="Dinner" placeholderTextColor="#A0A6B3" style={styles.input} />
      <View style={styles.modalRow}><View style={styles.modalHalf}><Label text={`Amount (${currency})`} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#A0A6B3" style={styles.input} /></View><View style={styles.modalHalf}><Label text="Date" /><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#A0A6B3" style={styles.input} /></View></View>
      <Label text="Category" /><TextInput value={category} onChangeText={setCategory} placeholder="Food" placeholderTextColor="#A0A6B3" style={styles.input} />
      <Label text="Paid by" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberChoices}>{accepted.map((member) => <Pressable key={member.userId} onPress={() => setPaidBy(member.userId)} style={[styles.memberChoice, paidBy === member.userId && styles.memberChoiceActive]}><Text style={[styles.memberChoiceText, paidBy === member.userId && styles.memberChoiceTextActive]}>{member.fullName}</Text></Pressable>)}</ScrollView>
      <Pressable onPress={() => setShared((value) => !value)} style={styles.shareToggle}><View style={[styles.checkbox, shared && styles.checkboxOn]}><Text style={styles.checkText}>{shared ? "✓" : ""}</Text></View><View><Text style={styles.shareTitle}>Split equally with trip members</Text><Text style={styles.shareSub}>Turn off to keep this as a personal/payer-only expense.</Text></View></Pressable>
      {error ? <Text style={styles.modalError}>{error}</Text> : null}
      <Pressable disabled={saving} onPress={submit} style={styles.save}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{expense ? "Save Changes" : "Add Expense"}</Text>}</Pressable>
    </ScrollView>
  </View></View></Modal>;
}
function Label({text}:{text:string}) { return <Text style={styles.inputLabel}>{text}</Text>; }
function money(value:number, code:string) { const symbol=code==="PHP"?"₱":code==="USD"?"$":`${code} `; return `${symbol}${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FCFBFE"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#FCFBFE"},error:{color:"#C83B4A",fontSize:10},
  content:{padding:14,paddingBottom:100},maxWidth:{width:"100%",maxWidth:760,alignSelf:"center"},headingRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-end"},eyebrow:{color:"#7D8290",fontSize:7,letterSpacing:1,fontWeight:"900"},heading:{marginTop:2,color:"#151D31",fontSize:26,lineHeight:28,fontWeight:"900"},headingActions:{flexDirection:"row",gap:7},searchPill:{height:34,minWidth:108,flexDirection:"row",alignItems:"center",paddingHorizontal:10,borderRadius:17,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E9EBF1"},searchGlyph:{color:"#8B93A2",fontSize:14},searchText:{marginLeft:5,color:"#7D8698",fontSize:7,fontWeight:"700"},morePill:{width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E9EBF1"},moreText:{color:"#6F788A",fontSize:16},
  folderGrid:{marginTop:10,flexDirection:"row",gap:9},folderPress:{flex:1,minWidth:0,paddingTop:8},folderTabBlue:{position:"absolute",top:0,left:7,width:"44%",height:17,borderTopLeftRadius:10,borderTopRightRadius:10,backgroundColor:"#7799F6"},folderTabPink:{position:"absolute",top:0,left:7,width:"44%",height:17,borderTopLeftRadius:10,borderTopRightRadius:10,backgroundColor:"#F15A8B"},folderBlue:{minHeight:155,padding:12,borderRadius:17,borderTopLeftRadius:12},folderPink:{minHeight:155,padding:12,borderRadius:17,borderTopLeftRadius:12},
  folderArt:{height:69,alignItems:"center",justifyContent:"center",borderRadius:10},folderEmoji:{fontSize:21,letterSpacing:4},folderBadge:{position:"absolute",left:9,top:79,width:21,height:21,borderRadius:11,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFFFF"},folderBadgePink:{backgroundColor:"#FFF8FA"},folderBadgeText:{color:"#7695F2",fontSize:10,fontWeight:"900"},folderTitle:{marginTop:9,color:"#202A41",fontSize:9,fontWeight:"900"},folderCount:{marginTop:3,color:"#8790A1",fontSize:7,fontWeight:"700"},
  sharedHeading:{marginTop:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{color:"#202A41",fontSize:10,fontWeight:"900"},sectionMeta:{marginTop:2,color:"#9098A7",fontSize:6,fontWeight:"700"},addExpense:{color:"#4E83EE",fontSize:8,fontWeight:"900"},sharedList:{marginTop:8,gap:7},expenseRow:{minHeight:59,flexDirection:"row",alignItems:"center",padding:9,borderRadius:14,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF3"},expenseIcon:{width:34,height:34,borderRadius:11,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4F88"},expenseGlyph:{color:"#FFFFFF",fontSize:15,fontWeight:"900"},expenseCopy:{flex:1,minWidth:0,paddingHorizontal:9},expenseTitle:{color:"#253047",fontSize:8,fontWeight:"900"},expenseMeta:{marginTop:3,color:"#9299A8",fontSize:6,lineHeight:8,fontWeight:"700"},expenseRight:{alignItems:"flex-end"},amount:{color:"#243047",fontSize:9,fontWeight:"900"},paidPill:{marginTop:5,paddingHorizontal:8,paddingVertical:3,borderRadius:7,backgroundColor:"#E9FFF0"},paidText:{color:"#49A66C",fontSize:6,fontWeight:"900"},rowActions:{marginLeft:7,flexDirection:"row",gap:7},rowAction:{color:"#9AA1AE",fontSize:12,fontWeight:"900"},
  empty:{alignItems:"center",padding:25,borderRadius:15,backgroundColor:"#FFFFFF"},emptyTitle:{color:"#283249",fontSize:10,fontWeight:"900"},emptyText:{marginTop:4,maxWidth:340,textAlign:"center",color:"#9299A8",fontSize:7,lineHeight:11,fontWeight:"700"},manage:{alignSelf:"center",marginTop:10,paddingHorizontal:12,paddingVertical:7},manageText:{color:"#4B7FDB",fontSize:7,fontWeight:"900"},
  invoice:{marginTop:5,padding:11,borderRadius:18},invoiceHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},invoiceTitle:{color:"#EE4C7D",fontSize:9,fontWeight:"900"},invoiceSub:{marginTop:2,color:"#8F8790",fontSize:6,fontWeight:"700"},briefcase:{fontSize:23},invoicePaper:{marginTop:8,padding:11,borderRadius:13,backgroundColor:"#FFFFFF"},invoiceName:{color:"#263047",fontSize:7,fontWeight:"900"},invoiceDivider:{marginVertical:9,borderTopWidth:1,borderTopColor:"#EEF0F3"},invoiceValues:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},invoiceLabel:{color:"#9299A8",fontSize:6,fontWeight:"700"},invoiceValue:{marginTop:3,color:"#263047",fontSize:9,fontWeight:"900"},memberStack:{flexDirection:"row"},memberDot:{width:20,height:20,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#EDF0FF",borderWidth:2,borderColor:"#FFFFFF"},memberInitial:{color:"#715BE1",fontSize:6,fontWeight:"900"},invoiceActions:{marginTop:10,flexDirection:"row",gap:7},reminder:{flex:1.1,height:34,alignItems:"center",justifyContent:"center",borderRadius:8,backgroundColor:"#15325B"},reminderText:{color:"#FFFFFF",fontSize:6,fontWeight:"900"},invoiceButton:{flex:1,height:34,alignItems:"center",justifyContent:"center",borderRadius:8,backgroundColor:"#FFFFFF"},invoiceButtonOutline:{borderWidth:1,borderColor:"#DDE1E9"},invoiceButtonText:{color:"#263047",fontSize:6,fontWeight:"900"},
  personalPanel:{marginTop:10,padding:12,borderRadius:18,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF3"},personalRow:{height:36,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderTopColor:"#F0F1F4"},personalTitle:{color:"#263047",fontSize:7,fontWeight:"800"},personalAmount:{color:"#263047",fontSize:7,fontWeight:"900"},
  modalBackdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(9,14,25,.5)"},modal:{maxHeight:"88%",borderTopLeftRadius:27,borderTopRightRadius:27,backgroundColor:"#FFFFFF"},modalHead:{height:58,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:"#EFF0F4"},modalTitle:{color:"#1C263D",fontSize:17,fontWeight:"900"},close:{color:"#737C8D",fontSize:27},modalContent:{padding:18,paddingBottom:35},inputLabel:{marginTop:11,marginBottom:5,color:"#59677E",fontSize:8,fontWeight:"900"},input:{height:46,paddingHorizontal:12,borderRadius:13,color:"#1C263D",backgroundColor:"#F4F5F8",fontSize:10,fontWeight:"700"},modalRow:{flexDirection:"row",gap:8},modalHalf:{flex:1},memberChoices:{gap:6},memberChoice:{paddingHorizontal:10,paddingVertical:7,borderRadius:10,backgroundColor:"#F0F2F6"},memberChoiceActive:{backgroundColor:"#7257EC"},memberChoiceText:{color:"#677286",fontSize:7,fontWeight:"900"},memberChoiceTextActive:{color:"#FFFFFF"},shareToggle:{marginTop:14,flexDirection:"row",alignItems:"center",gap:9,padding:11,borderRadius:14,backgroundColor:"#F8F7FC"},checkbox:{width:22,height:22,borderRadius:7,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#D4D7E0"},checkboxOn:{backgroundColor:"#7257EC",borderColor:"#7257EC"},checkText:{color:"#FFFFFF",fontSize:11,fontWeight:"900"},shareTitle:{color:"#273149",fontSize:8,fontWeight:"900"},shareSub:{marginTop:2,color:"#8E96A5",fontSize:6,fontWeight:"700"},modalError:{marginTop:8,color:"#C83B4A",fontSize:8,fontWeight:"700"},save:{marginTop:16,height:48,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#7257EC"},saveText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"}
});
