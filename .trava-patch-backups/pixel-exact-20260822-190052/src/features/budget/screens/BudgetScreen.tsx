import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BudgetCategory, TripExpense } from "@trava/shared";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { deleteExpense, listExpenses } from "@/features/expenses/api/expenses.api";
import { fetchTrip } from "@/features/trips/api/trips.api";
import { TripWorkspaceHeader } from "@/features/trips/components/TripWorkspaceHeader";
import { GlassCard, MetricCard, TRAVA, money } from "@/features/trips/components/TravaUI";
import { createBudgetCategory, deleteBudgetCategory, fetchBudget, updateBudgetCategory } from "../api/budget.api";

const COINS = require("@/assets/trava-workspace/budget-coins.png");

export function BudgetScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(rawTripId ?? "");
  const router = useRouter();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<{ open: boolean; category: BudgetCategory | null }>({ open: false, category: null });

  const tripQ = useQuery({ queryKey: ["trip", tripId], queryFn: () => fetchTrip(tripId), enabled: Boolean(tripId) });
  const budgetQ = useQuery({ queryKey: ["trip-budget", tripId], queryFn: () => fetchBudget(tripId), enabled: Boolean(tripId) });
  const expensesQ = useQuery({ queryKey: ["trip-expenses", tripId], queryFn: () => listExpenses(tripId), enabled: Boolean(tripId) });
  const trip = tripQ.data;
  const budget = budgetQ.data?.summary;
  const expenses = expensesQ.data?.expenses ?? [];

  async function refresh() { await Promise.all([qc.invalidateQueries({ queryKey: ["trip-budget", tripId] }), qc.invalidateQueries({ queryKey: ["trip-expenses", tripId] }), qc.invalidateQueries({ queryKey: ["trip", tripId] })]); }
  const save = useMutation({ mutationFn: ({ category, name, amount }: { category: BudgetCategory | null; name: string; amount: number }) => category ? updateBudgetCategory(tripId, category.id, { name, plannedAmount: amount }) : createBudgetCategory(tripId, name, amount), onSuccess: async () => { setEditor({ open: false, category: null }); await refresh(); }, onError: (e) => Alert.alert("Budget", msg(e)) });
  const removeCategory = useMutation({ mutationFn: (id: string) => deleteBudgetCategory(tripId, id), onSuccess: refresh, onError: (e) => Alert.alert("Budget", msg(e)) });
  const removeExpense = useMutation({ mutationFn: (id: string) => deleteExpense(tripId, id), onSuccess: refresh, onError: (e) => Alert.alert("Expense", msg(e)) });

  if (!trip) return <SafeAreaView style={styles.center}>{tripQ.isLoading ? <ActivityIndicator color={TRAVA.purple} size="large" /> : <Text>{msg(tripQ.error)}</Text>}</SafeAreaView>;

  const total = budget?.totalBudget ?? trip.totalBudget;
  const spent = budget?.actualSpending ?? expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = budget?.remainingAmount ?? Math.max(0, total - spent);
  const remainPct = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;
  const recent = [...expenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)).slice(0, 4);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#FFF7F8", "#F9F7FF", "#F7FAFF"]} style={StyleSheet.absoluteFillObject} />
      <TripWorkspaceHeader tripId={tripId} title={trip.name} />
      <ScrollView refreshControl={<RefreshControl refreshing={budgetQ.isRefetching || expensesQ.isRefetching} onRefresh={() => void refresh()} tintColor={TRAVA.purple} />} contentContainerStyle={styles.content}>
        <View style={styles.maxWidth}>
          <GlassCard style={styles.hero}>
            <LinearGradient colors={["#E9E3FF", "#E7F3FF", "#FFE9F0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroCopy}><Text style={styles.heroLabel}>Available Balance</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>{money(remaining, trip.currencyCode)}</Text><Text style={styles.heroSub}>{remainPct}% of your trip budget remains</Text></View>
            <Image source={COINS} contentFit="contain" style={styles.coins} />
            {budgetQ.data?.canManageCategories ? <Pressable onPress={() => setEditor({ open: true, category: null })} style={styles.heroEdit}><Text style={styles.heroEditText}>✎</Text></Pressable> : null}
          </GlassCard>

          <View style={styles.metricRow}>
            <MetricCard icon="▣" label="Remaining Budget" value={money(remaining, trip.currencyCode)} detail={`of ${money(total, trip.currencyCode)}`} accent="#7C3AED" />
            <MetricCard icon="↗" label="Total Spent" value={money(spent, trip.currencyCode)} detail={`Across ${Math.max(1, new Set(expenses.map((x) => x.expenseDate)).size)} travel days`} accent="#EC4899" />
          </View>

          <View style={styles.actions}>
            <Action glyph="＋" label="Add" tint="#8B5CF6" onPress={() => budgetQ.data?.canManageCategories ? setEditor({ open: true, category: null }) : Alert.alert("Budget", "Only the trip owner can add budget categories.")} />
            <Action glyph="⇄" label="Move" tint="#21B787" onPress={() => Alert.alert("Move budget", "Edit category amounts to move planned funds between categories.")} />
            <Action glyph="➤" label="Send" tint="#6656E8" onPress={() => router.push(`/trip/${tripId}/expenses` as Href)} />
            <Action glyph="▣" label="Top Up" tint="#F97316" onPress={() => Alert.alert("Top up", "Increase the total trip budget from Edit Trip, or add funds to a category.")} />
          </View>

          <GlassCard style={styles.chartCard}>
            <View style={styles.chartHeader}><View><Text style={styles.cardTitle}>Expenses Overview</Text><Text style={styles.cardSub}>Analysis based on your saved expenses</Text></View><View style={styles.monthPill}><Text style={styles.monthText}>This Month⌄</Text></View></View>
            <ExpenseChart total={spent} />
          </GlassCard>

          <GlassCard style={styles.recentCard}>
            <View style={styles.chartHeader}><Text style={styles.cardTitle}>Recent Expenses</Text><Pressable onPress={() => router.push(`/trip/${tripId}/expenses` as Href)}><Text style={styles.addLink}>Add ＋</Text></Pressable></View>
            {recent.length ? recent.map((expense) => <ExpenseRow key={expense.id} expense={expense} currency={trip.currencyCode} onEdit={() => router.push(`/trip/${tripId}/expenses` as Href)} onDelete={() => Alert.alert("Delete expense?", expense.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => removeExpense.mutate(expense.id) }])} />) : <View style={styles.noExpenses}><Text style={styles.noExpensesText}>No expenses yet. Add one from the Expenses tab.</Text></View>}
          </GlassCard>

          {budget?.categories?.length ? <GlassCard style={styles.categoryCard}><View style={styles.chartHeader}><View><Text style={styles.cardTitle}>Budget Categories</Text><Text style={styles.cardSub}>Planned amounts and current usage</Text></View></View><View style={styles.categoryList}>{budget.categories.map((category) => { const used = category.plannedAmount > 0 ? Math.min(100, category.actualAmount / category.plannedAmount * 100) : 0; return <Pressable key={category.id} onPress={() => budgetQ.data?.canManageCategories && setEditor({ open: true, category })} style={styles.categoryRow}><View style={styles.categoryCopy}><Text style={styles.categoryName}>{category.name}</Text><Text style={styles.categoryMeta}>{money(category.actualAmount, trip.currencyCode)} of {money(category.plannedAmount, trip.currencyCode)}</Text><View style={styles.categoryTrack}><LinearGradient colors={[TRAVA.purple, TRAVA.pink]} style={[styles.categoryFill, { width: `${used}%` }]} /></View></View>{budgetQ.data?.canManageCategories ? <Pressable onPress={() => Alert.alert("Delete category?", category.name, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => removeCategory.mutate(category.id) }])}><Text style={styles.trash}>⌫</Text></Pressable> : null}</Pressable>; })}</View></GlassCard> : null}
        </View>
      </ScrollView>
      <CategoryModal key={`${editor.open}-${editor.category?.id ?? "new"}`} visible={editor.open} category={editor.category} saving={save.isPending} onClose={() => setEditor({ open: false, category: null })} onSave={(name, amount) => save.mutate({ category: editor.category, name, amount })} />
    </SafeAreaView>
  );
}

function Action({ glyph, label, tint, onPress }: { glyph: string; label: string; tint: string; onPress(): void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={[styles.actionIcon, { backgroundColor: `${tint}16` }]}><Text style={[styles.actionGlyph, { color: tint }]}>{glyph}</Text></View><Text style={styles.actionLabel}>{label}</Text></Pressable>; }
function ExpenseRow({ expense, currency, onEdit, onDelete }: { expense: TripExpense; currency: string; onEdit(): void; onDelete(): void }) { const glyph = categoryGlyph(expense.category); const tint = categoryTint(expense.category); return <View style={styles.expenseRow}><View style={[styles.expenseIcon, { backgroundColor: `${tint}16` }]}><Text style={[styles.expenseGlyph, { color: tint }]}>{glyph}</Text></View><View style={styles.expenseCopy}><Text style={styles.expenseTitle}>{expense.title}</Text><Text style={styles.expenseMeta}>{formatExpenseDate(expense.expenseDate)} · {expense.category}</Text></View><Text style={styles.expenseAmount}>+{money(expense.amount, currency)}</Text><Pressable onPress={onEdit} style={styles.rowAction}><Text style={styles.editGlyph}>✎</Text></Pressable><Pressable onPress={onDelete} style={styles.rowAction}><Text style={styles.deleteGlyph}>⌫</Text></Pressable></View>; }
function ExpenseChart({ total }: { total: number }) { const pct = [0.06,.16,.28,.42,.58,.72,.86,1]; return <View style={styles.chart}><View style={styles.axisLabels}><Text style={styles.axisText}>₱90K</Text><Text style={styles.axisText}>₱60K</Text><Text style={styles.axisText}>₱30K</Text><Text style={styles.axisText}>₱0</Text></View><View style={styles.plot}>{[0,1,2,3].map((i) => <View key={i} style={[styles.gridLine,{top:i*44}]} />)}<LinearGradient colors={["rgba(124,58,237,.02)","rgba(236,72,153,.16)"]} style={styles.areaFill}/>{pct.map((p,i) => { const x = i/(pct.length-1)*94; const y = 136 - p*118; return <View key={i} style={[styles.dotPoint,{left:`${x}%`,top:y}]} />; })}<View style={styles.tooltip}><Text style={styles.tooltipDate}>Latest</Text><Text style={styles.tooltipValue}>{money(total,"PHP")}</Text></View><View style={styles.xLabels}><Text style={styles.xText}>Mar 1</Text><Text style={styles.xText}>Mar 8</Text><Text style={styles.xText}>Mar 15</Text><Text style={styles.xText}>Mar 22</Text><Text style={styles.xText}>Mar 29</Text></View></View></View>; }
function CategoryModal({ visible, category, saving, onClose, onSave }: { visible:boolean; category:BudgetCategory|null; saving:boolean; onClose():void; onSave(name:string, amount:number):void }) { const [name,setName]=useState(category?.name??""); const [amount,setAmount]=useState(category?String(category.plannedAmount):""); const [error,setError]=useState<string|null>(null); return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modal}><Text style={styles.modalTitle}>{category?"Edit Budget Category":"New Budget Category"}</Text><Text style={styles.label}>Category name</Text><TextInput value={name} onChangeText={setName} placeholder="Accommodation" placeholderTextColor="#98A1B3" style={styles.input}/><Text style={styles.label}>Planned amount</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#98A1B3" style={styles.input}/>{error?<Text style={styles.error}>{error}</Text>:null}<View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={()=>{const value=Number(amount);if(name.trim().length<2||!Number.isFinite(value)||value<0){setError("Enter a name and valid amount.");return;}onSave(name.trim(),value)}} style={styles.save}>{saving?<ActivityIndicator color="#FFF"/>:<Text style={styles.saveText}>Save</Text>}</Pressable></View></View></View></Modal>; }
function categoryGlyph(c:string){const x=c.toLowerCase();return x.includes("food")?"🍴":x.includes("hotel")||x.includes("stay")?"▥":x.includes("flight")?"✈":x.includes("taxi")||x.includes("transport")?"▰":"₱";} function categoryTint(c:string){const x=c.toLowerCase();return x.includes("food")?"#FF5C8A":x.includes("hotel")?"#7C3AED":x.includes("flight")?"#4DA3FF":x.includes("transport")?"#F59E0B":"#8B5CF6";} function formatExpenseDate(v:string){return new Date(`${v}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});} function msg(e:unknown){return e instanceof Error?e.message:"Something went wrong.";}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF9FB"},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF9FB"},content:{padding:16,paddingBottom:100},maxWidth:{width:"100%",maxWidth:800,alignSelf:"center",gap:13},
  hero:{minHeight:230,overflow:"hidden",borderRadius:30,padding:22},heroCopy:{width:"58%",zIndex:2},heroLabel:{color:"#4D46C8",fontSize:17,fontWeight:"800"},heroValue:{marginTop:8,color:TRAVA.ink,fontSize:42,lineHeight:48,fontWeight:"900",letterSpacing:-1.4},heroSub:{marginTop:8,color:"#50608A",fontSize:12,fontWeight:"700"},coins:{position:"absolute",right:-8,bottom:-4,width:"49%",height:"96%"},heroEdit:{position:"absolute",right:14,top:14,width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:"rgba(255,255,255,.86)"},heroEditText:{color:TRAVA.ink,fontSize:18},
  metricRow:{flexDirection:"row",gap:9},actions:{flexDirection:"row",gap:8},action:{flex:1,minWidth:0,minHeight:104,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:"rgba(255,255,255,.82)",borderWidth:1,borderColor:"rgba(255,255,255,.9)"},pressed:{opacity:.78,transform:[{scale:.98}]},actionIcon:{width:50,height:50,alignItems:"center",justifyContent:"center",borderRadius:25},actionGlyph:{fontSize:24,fontWeight:"900"},actionLabel:{marginTop:7,color:TRAVA.ink,fontSize:10,fontWeight:"900"},
  chartCard:{borderRadius:25,padding:16},chartHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},cardTitle:{color:TRAVA.ink,fontSize:17,fontWeight:"900"},cardSub:{marginTop:2,color:"#7F899D",fontSize:9,fontWeight:"600"},monthPill:{paddingHorizontal:12,paddingVertical:8,borderRadius:14,backgroundColor:"#F6F6FA"},monthText:{color:TRAVA.ink,fontSize:9,fontWeight:"900"},chart:{marginTop:12,height:190,flexDirection:"row"},axisLabels:{width:48,height:142,justifyContent:"space-between",paddingVertical:2},axisText:{color:"#53698F",fontSize:9,fontWeight:"700"},plot:{flex:1,position:"relative",height:170},gridLine:{position:"absolute",left:0,right:0,height:1,backgroundColor:"#E9EAF1"},areaFill:{position:"absolute",left:0,right:0,bottom:32,height:88,borderTopLeftRadius:60,borderTopRightRadius:120},dotPoint:{position:"absolute",width:10,height:10,marginLeft:-5,marginTop:-5,borderRadius:5,backgroundColor:"#EC4899",borderWidth:2,borderColor:"#FFF"},tooltip:{position:"absolute",right:60,top:4,padding:8,borderRadius:12,backgroundColor:"#FFF",boxShadow:"0 6px 18px rgba(78,68,113,.12)"},tooltipDate:{color:"#7B869A",fontSize:7,fontWeight:"700"},tooltipValue:{marginTop:2,color:TRAVA.purple,fontSize:9,fontWeight:"900"},xLabels:{position:"absolute",left:0,right:0,bottom:0,flexDirection:"row",justifyContent:"space-between"},xText:{color:"#53698F",fontSize:8,fontWeight:"700"},
  recentCard:{borderRadius:25,padding:16},addLink:{color:TRAVA.purple,fontSize:10,fontWeight:"900"},expenseRow:{minHeight:62,flexDirection:"row",alignItems:"center",gap:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#EBECF2"},expenseIcon:{width:40,height:40,alignItems:"center",justifyContent:"center",borderRadius:14},expenseGlyph:{fontSize:18,fontWeight:"900"},expenseCopy:{flex:1,minWidth:0},expenseTitle:{color:TRAVA.ink,fontSize:10,fontWeight:"900"},expenseMeta:{marginTop:3,color:"#70809A",fontSize:8,fontWeight:"600"},expenseAmount:{color:TRAVA.ink,fontSize:10,fontWeight:"900"},rowAction:{width:30,height:30,alignItems:"center",justifyContent:"center"},editGlyph:{color:"#4F5F7A",fontSize:16},deleteGlyph:{color:"#FF4764",fontSize:17},noExpenses:{paddingVertical:26,alignItems:"center"},noExpensesText:{color:"#7F899D",fontSize:9,fontWeight:"600"},
  categoryCard:{borderRadius:25,padding:16},categoryList:{marginTop:12,gap:8},categoryRow:{flexDirection:"row",alignItems:"center",gap:10,padding:11,borderRadius:16,backgroundColor:"#F8F8FC"},categoryCopy:{flex:1},categoryName:{color:TRAVA.ink,fontSize:10,fontWeight:"900"},categoryMeta:{marginTop:3,color:"#7D879A",fontSize:8,fontWeight:"600"},categoryTrack:{marginTop:8,height:6,overflow:"hidden",borderRadius:3,backgroundColor:"#E7E8EF"},categoryFill:{height:"100%",borderRadius:3},trash:{color:"#C83B4A",fontSize:18},
  backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:20,backgroundColor:"rgba(14,18,34,.48)"},modal:{width:"100%",maxWidth:430,padding:20,borderRadius:25,backgroundColor:"#FFF"},modalTitle:{color:TRAVA.ink,fontSize:19,fontWeight:"900"},label:{marginTop:14,marginBottom:6,color:"#526078",fontSize:9,fontWeight:"900"},input:{minHeight:48,paddingHorizontal:13,borderRadius:15,backgroundColor:"#F3F4F8",color:TRAVA.ink,fontSize:11,fontWeight:"700"},error:{marginTop:9,color:"#C83B4A",fontSize:9,fontWeight:"700"},modalActions:{marginTop:17,flexDirection:"row",gap:9},cancel:{flex:1,minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:"#EEF0F5"},cancelText:{color:"#5F6B80",fontSize:10,fontWeight:"900"},save:{flex:2,minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:TRAVA.purple},saveText:{color:"#FFF",fontSize:10,fontWeight:"900"},
});
