import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BudgetCategory } from "@trava/shared";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { listExpenses } from "@/features/expenses/api/expenses.api";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { createBudgetCategory, deleteBudgetCategory, fetchBudget, updateBudgetCategory } from "../api/budget.api";

const MONEY_ACTIONS = [
  ["＋", "Add", "add"],
  ["⇆", "Move", "move"],
  ["➤", "Send", "send"],
  ["▣", "Top Up", "topup"],
] as const;

export function BudgetScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ open: boolean; category: BudgetCategory | null }>({ open: false, category: null });

  const tripQuery = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId), staleTime: 30_000 });
  const budgetQuery = useQuery({ queryKey: ["trip-budget", tripId], queryFn: () => fetchBudget(tripId), enabled: Boolean(tripId), staleTime: 20_000 });
  const expensesQuery = useQuery({ queryKey: ["trip-expenses", tripId], queryFn: () => listExpenses(tripId), enabled: Boolean(tripId), staleTime: 20_000 });

  const trip = tripQuery.data;
  const budget = budgetQuery.data?.summary;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trip-budget", tripId] }),
      queryClient.invalidateQueries({ queryKey: ["trip-expenses", tripId] }),
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] }),
    ]);
  }

  const save = useMutation({
    mutationFn: ({ category, name, amount }: { category: BudgetCategory | null; name: string; amount: number }) =>
      category ? updateBudgetCategory(tripId, category.id, { name, plannedAmount: amount }) : createBudgetCategory(tripId, name, amount),
    onSuccess: async () => { setEditor({ open: false, category: null }); await refresh(); },
    onError: (error) => Alert.alert("Budget", msg(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBudgetCategory(tripId, id),
    onSuccess: refresh,
    onError: (error) => Alert.alert("Budget", msg(error)),
  });

  if (!trip) {
    return <SafeAreaView style={styles.center}>{tripQuery.isLoading ? <ActivityIndicator color="#7257EC" size="large" /> : <Text style={styles.error}>{msg(tripQuery.error)}</Text>}</SafeAreaView>;
  }

  const total = budget?.totalBudget ?? trip.totalBudget;
  const spent = budget?.actualSpending ?? 0;
  const remaining = budget?.remainingAmount ?? total;
  const percentLeft = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;
  const recent = (expensesQuery.data?.expenses ?? []).slice().sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).slice(0, 5);
  const values = recent.map((expense) => expense.amount);
  const maxChartValue = Math.max(1, ...values);
  const chart = values.map((value) => Math.max(8, Math.round((value / maxChartValue) * 64)));

  function onMoneyAction(action: string) {
    if (action === "add") setEditor({ open: true, category: null });
    else if (action === "topup") router.push(`/trip/${tripId}/edit` as Href);
    else router.push(`/trip/${tripId}/expenses` as Href);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={budgetQuery.isRefetching || expensesQuery.isRefetching} onRefresh={() => void refresh()} tintColor="#7257EC" />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.maxWidth}>
          <LinearGradient colors={["#4E8DF4", "#A7D5FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceHero}>
            <View>
              <Text style={styles.heroLabel}>Available Balance</Text>
              <Text style={styles.heroValue}>{money(remaining, trip.currencyCode)}</Text>
              <Text style={styles.heroSub}>{percentLeft}% of your trip budget remains</Text>
            </View>
            <Image source={require("../../../../assets/images/budget/budget-piggy.png")} contentFit="contain" style={styles.walletAsset} />
            <Pressable onPress={() => router.push(`/trip/${tripId}/edit` as Href)} style={styles.heroEdit}><Text style={styles.heroEditText}>⌁</Text></Pressable>
          </LinearGradient>

          <View style={styles.summaryRow}>
            <LinearGradient colors={["#FFF3F7", "#FFF7F9"]} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryValue}>{money(remaining, trip.currencyCode)}</Text>
              <Text style={styles.summaryMeta}>of {money(total, trip.currencyCode)}</Text>
            </LinearGradient>
            <LinearGradient colors={["#F4F8FF", "#F7FBFF"]} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Spent</Text>
              <Text style={styles.summaryValue}>{money(spent, trip.currencyCode)}</Text>
              <Text style={styles.summaryMeta}>Across {trip.numberOfDays} travel days</Text>
            </LinearGradient>
          </View>

          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.actionRow}>
            {MONEY_ACTIONS.map(([glyph, label, key], index) => (
              <Pressable key={key} onPress={() => onMoneyAction(key)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
                <View style={[styles.actionIcon, index === 0 && styles.actionPink, index === 1 && styles.actionBlue, index === 2 && styles.actionBlue, index === 3 && styles.actionPurple]}><Text style={styles.actionGlyph}>{glyph}</Text></View>
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View><Text style={styles.panelTitle}>Expenses Overview</Text><Text style={styles.panelSub}>Analytics based on your saved expenses</Text></View>
              <View style={styles.monthPill}><Text style={styles.monthText}>This Trip⌄</Text></View>
            </View>
            <View style={styles.chart}>
              {[0, 1, 2, 3].map((row) => <View key={row} style={[styles.gridLine, { bottom: row * 26 + 16 }]} />)}
              <View style={styles.bars}>
                {chart.length ? chart.map((height, index) => <View key={index} style={[styles.bar, { height }]} />) : <View style={styles.chartEmpty}><Text style={styles.chartEmptyText}>Expense activity will appear here.</Text></View>}
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View><Text style={styles.panelTitle}>Recent Expenses</Text><Text style={styles.panelSub}>{expensesQuery.data?.expenses.length ?? 0} total</Text></View>
              <Pressable onPress={() => router.push(`/trip/${tripId}/expenses` as Href)}><Text style={styles.addLink}>⊕ Add</Text></Pressable>
            </View>
            <View style={styles.expenseRows}>
              {recent.map((expense) => (
                <Pressable key={expense.id} onPress={() => router.push(`/trip/${tripId}/expenses` as Href)} style={({ pressed }) => [styles.expenseRow, pressed && styles.pressed]}>
                  <View style={styles.expenseIcon}><Text style={styles.expenseGlyph}>{categoryGlyph(expense.category)}</Text></View>
                  <View style={styles.expenseCopy}><Text style={styles.expenseTitle}>{expense.title}</Text><Text style={styles.expenseMeta}>{new Date(`${expense.expenseDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {expense.category}</Text></View>
                  <Text style={styles.expenseAmount}>−{money(expense.amount, trip.currencyCode)}</Text>
                  <Text style={styles.editGlyph}>⌁</Text>
                </Pressable>
              ))}
              {!recent.length && !expensesQuery.isLoading ? <View style={styles.empty}><Text style={styles.emptyText}>No expenses yet. Add one from the Expenses tab.</Text></View> : null}
            </View>
          </View>

          <View style={styles.categoryPanel}>
            <View style={styles.panelHeader}>
              <View><Text style={styles.panelTitle}>Budget Categories</Text><Text style={styles.panelSub}>Planned limits vs. actual spending</Text></View>
              {budgetQuery.data?.canManageCategories ? <Pressable onPress={() => setEditor({ open: true, category: null })}><Text style={styles.addLink}>＋ Category</Text></Pressable> : null}
            </View>
            {(budget?.categories ?? []).map((category) => {
              const used = category.plannedAmount > 0 ? Math.min(100, (category.actualAmount / category.plannedAmount) * 100) : 0;
              return (
                <View key={category.id} style={styles.category}>
                  <View style={styles.categoryTop}>
                    <View><Text style={styles.categoryName}>{category.name}</Text><Text style={styles.categoryMeta}>{money(category.actualAmount, trip.currencyCode)} spent</Text></View>
                    <View style={styles.categoryRight}><Text style={styles.categoryPlan}>{money(category.plannedAmount, trip.currencyCode)}</Text>
                      {budgetQuery.data?.canManageCategories ? <View style={styles.categoryLinks}><Pressable onPress={() => setEditor({ open: true, category })}><Text style={styles.editLink}>Edit</Text></Pressable><Pressable onPress={() => Alert.alert("Delete category?", "Expenses remain uncategorized.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(category.id) }])}><Text style={styles.deleteLink}>Delete</Text></Pressable></View> : null}
                    </View>
                  </View>
                  <View style={styles.track}><View style={[styles.fill, { width: `${used}%` }, used >= 100 && styles.over]} /></View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <CategoryModal
        key={`${editor.open}-${editor.category?.id ?? "new"}`}
        visible={editor.open}
        category={editor.category}
        saving={save.isPending}
        onClose={() => setEditor({ open: false, category: null })}
        onSave={(name, amount) => save.mutate({ category: editor.category, name, amount })}
      />
    </SafeAreaView>
  );
}

function CategoryModal({ visible, category, saving, onClose, onSave }: { visible: boolean; category: BudgetCategory | null; saving: boolean; onClose(): void; onSave(name: string, amount: number): void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [amount, setAmount] = useState(category ? String(category.plannedAmount) : "");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modal}>
        <Text style={styles.modalTitle}>{category ? "Edit budget category" : "New budget category"}</Text>
        <Text style={styles.inputLabel}>Category name</Text><TextInput value={name} onChangeText={setName} placeholder="Accommodation" placeholderTextColor="#A0A6B3" style={styles.input} />
        <Text style={styles.inputLabel}>Planned amount</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#A0A6B3" style={styles.input} />
        {error ? <Text style={styles.modalError}>{error}</Text> : null}
        <View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => { const numeric = Number(amount); if (name.trim().length < 2 || !Number.isFinite(numeric) || numeric < 0) { setError("Enter a valid name and amount."); return; } onSave(name.trim(), numeric); }} style={styles.save}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}</Pressable></View>
      </View></View>
    </Modal>
  );
}

function money(value: number, code: string) {
  const symbol = code === "PHP" ? "₱" : code === "USD" ? "$" : `${code} `;
  return `${symbol}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function msg(error: unknown) { return error instanceof Error ? error.message : "Something went wrong."; }
function categoryGlyph(category: string) {
  const key = category.toLowerCase();
  if (key.includes("food")) return "♨";
  if (key.includes("flight") || key.includes("transport")) return "✈";
  if (key.includes("stay") || key.includes("hotel")) return "▣";
  return "▤";
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FBFBFE"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#FBFBFE"},error:{color:"#C83B4A",fontSize:10,fontWeight:"700"},
  content:{padding:14,paddingBottom:100},maxWidth:{width:"100%",maxWidth:760,alignSelf:"center"},
  balanceHero:{minHeight:125,borderRadius:21,padding:18,justifyContent:"center",overflow:"hidden"},heroLabel:{color:"#FFFFFF",fontSize:8,fontWeight:"900"},heroValue:{marginTop:5,color:"#FFFFFF",fontSize:27,lineHeight:30,fontWeight:"900"},heroSub:{marginTop:3,color:"rgba(255,255,255,.9)",fontSize:8,fontWeight:"700"},
  walletAsset:{position:"absolute",right:48,bottom:5,width:100,height:100},heroEdit:{position:"absolute",right:12,top:12,width:29,height:29,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.85)"},heroEditText:{color:"#5689E8",fontSize:16,fontWeight:"900"},
  summaryRow:{marginTop:7,flexDirection:"row",gap:7},summaryCard:{flex:1,minHeight:76,borderRadius:18,padding:13},summaryLabel:{color:"#252F47",fontSize:8,fontWeight:"900"},summaryValue:{marginTop:5,color:"#1B2540",fontSize:18,fontWeight:"900"},summaryMeta:{marginTop:4,color:"#8992A3",fontSize:6,fontWeight:"700"},
  sectionLabel:{marginTop:12,color:"#19233B",fontSize:10,fontWeight:"900"},actionRow:{marginTop:7,flexDirection:"row",gap:7},actionCard:{flex:1,minWidth:0,height:77,alignItems:"center",justifyContent:"center",borderRadius:17,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},
  actionIcon:{width:35,height:35,borderRadius:18,alignItems:"center",justifyContent:"center"},actionPink:{backgroundColor:"#FFF0F5"},actionBlue:{backgroundColor:"#F1F7FF"},actionPurple:{backgroundColor:"#F6F1FF"},actionGlyph:{color:"#568CF0",fontSize:16,fontWeight:"900"},actionText:{marginTop:6,color:"#273149",fontSize:7,fontWeight:"900"},
  panel:{marginTop:10,padding:12,borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},categoryPanel:{marginTop:10,padding:12,borderRadius:19,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#ECEEF4"},
  panelHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},panelTitle:{color:"#19233B",fontSize:9,fontWeight:"900"},panelSub:{marginTop:2,color:"#939AAA",fontSize:6,fontWeight:"700"},monthPill:{paddingHorizontal:9,paddingVertical:6,borderRadius:9,backgroundColor:"#F6F8FC"},monthText:{color:"#627087",fontSize:6,fontWeight:"900"},
  chart:{height:112,marginTop:8,overflow:"hidden"},gridLine:{position:"absolute",left:0,right:0,borderTopWidth:1,borderStyle:"dashed",borderColor:"#E4E7EE"},bars:{position:"absolute",left:14,right:14,bottom:16,height:70,flexDirection:"row",alignItems:"flex-end",justifyContent:"space-around"},bar:{width:7,borderRadius:4,backgroundColor:"#4F88F3"},chartEmpty:{flex:1,alignItems:"center",justifyContent:"center"},chartEmptyText:{color:"#9AA1AF",fontSize:7,fontWeight:"700"},
  addLink:{color:"#4D83EE",fontSize:7,fontWeight:"900"},expenseRows:{marginTop:8},expenseRow:{minHeight:44,flexDirection:"row",alignItems:"center",borderTopWidth:1,borderTopColor:"#F0F1F4"},expenseIcon:{width:29,height:29,borderRadius:9,alignItems:"center",justifyContent:"center",backgroundColor:"#4C86F1"},expenseGlyph:{color:"#FFFFFF",fontSize:12,fontWeight:"900"},expenseCopy:{flex:1,minWidth:0,paddingHorizontal:8},expenseTitle:{color:"#202A41",fontSize:8,fontWeight:"900"},expenseMeta:{marginTop:2,color:"#9198A7",fontSize:6,fontWeight:"700"},expenseAmount:{color:"#212B42",fontSize:8,fontWeight:"900"},editGlyph:{marginLeft:8,color:"#8D95A5",fontSize:13},
  empty:{padding:20,alignItems:"center"},emptyText:{color:"#929AAA",fontSize:8,fontWeight:"700"},
  category:{marginTop:8,padding:10,borderRadius:14,backgroundColor:"#F8F9FC"},categoryTop:{flexDirection:"row",justifyContent:"space-between",gap:8},categoryName:{color:"#202A41",fontSize:8,fontWeight:"900"},categoryMeta:{marginTop:2,color:"#929AAA",fontSize:6,fontWeight:"700"},categoryRight:{alignItems:"flex-end"},categoryPlan:{color:"#202A41",fontSize:8,fontWeight:"900"},categoryLinks:{marginTop:4,flexDirection:"row",gap:8},editLink:{color:"#7257EC",fontSize:6,fontWeight:"900"},deleteLink:{color:"#C84B5E",fontSize:6,fontWeight:"900"},track:{marginTop:8,height:6,borderRadius:3,overflow:"hidden",backgroundColor:"#E7E9EF"},fill:{height:"100%",borderRadius:3,backgroundColor:"#64CDA9"},over:{backgroundColor:"#FF6D91"},
  modalBackdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:20,backgroundColor:"rgba(10,15,28,.48)"},modal:{width:"100%",maxWidth:420,padding:19,borderRadius:23,backgroundColor:"#FFFFFF"},modalTitle:{color:"#17213A",fontSize:18,fontWeight:"900"},inputLabel:{marginTop:13,marginBottom:5,color:"#626E84",fontSize:8,fontWeight:"900"},input:{height:47,paddingHorizontal:12,borderRadius:14,color:"#17213A",backgroundColor:"#F4F5F8",fontSize:10,fontWeight:"700"},modalError:{marginTop:8,color:"#C83B4A",fontSize:8,fontWeight:"700"},modalActions:{marginTop:15,flexDirection:"row",gap:8},cancel:{flex:1,height:45,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#EFF1F5"},cancelText:{color:"#626D81",fontSize:9,fontWeight:"900"},save:{flex:2,height:45,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#7257EC"},saveText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},
  pressed:{opacity:.72,transform:[{scale:.99}]}
});
