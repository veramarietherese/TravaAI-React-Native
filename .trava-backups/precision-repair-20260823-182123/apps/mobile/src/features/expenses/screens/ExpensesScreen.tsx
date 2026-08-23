import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { Glass, PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalExpense } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const piggy = require("../../../../assets/trava-pixel/personal-piggy.png");
const group = require("../../../../assets/trava-pixel/shared-group.png");
const ramen = require("../../../../assets/trava-pixel/ramen.png");
const gift = require("../../../../assets/trava-pixel/invoice-gift.png");
const CATEGORIES = ["Food & Dining", "Accommodation", "Transportation", "Activities", "Shopping", "Other"] as const;

export function ExpensesScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, addExpense, updateExpense, deleteExpense, syncStatus } = useLocalTripWorkspace(tripId);
  const [editor, setEditor] = useState<LocalExpense | null | "new">(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const personalItems = useMemo(() => state.expenses.filter((e) => !e.shared), [state.expenses]);
  const sharedItems = useMemo(() => state.expenses.filter((e) => e.shared), [state.expenses]);
  const personal = useMemo(() => personalItems.reduce((sum, e) => sum + e.amount, 0), [personalItems]);
  const shared = useMemo(() => sharedItems.reduce((sum, e) => sum + e.amount, 0), [sharedItems]);
  const people = Math.max(1, trip.memberCount || 1);
  const per = shared / people;

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Japan"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <View style={s.summaryRow}>
        <LinearGradient colors={["#E8F4FF", "#F0F0FF", "#FFF0F6"]} style={s.summary}><Text style={[s.sumLabel, { color: "#547CB8" }]}>Personal Expenses</Text><Text style={s.sumValue}>₱{money(personal)}</Text><Text style={s.sumSub}>Across {personalItems.length} {personalItems.length === 1 ? "expense" : "expenses"}</Text><Image source={piggy} contentFit="contain" style={s.sumAsset}/></LinearGradient>
        <LinearGradient colors={["#FFF0F5", "#F4F0FF", "#EAF5FF"]} style={s.summary}><Text style={[s.sumLabel, { color: "#C96D98" }]}>Shared Expenses</Text><Text style={s.sumValue}>₱{money(shared)}</Text><Text style={s.sumSub}>Across {sharedItems.length} {sharedItems.length === 1 ? "expense" : "expenses"}</Text><Image source={group} contentFit="contain" style={s.sumAsset}/></LinearGradient>
      </View>

      <Glass style={s.sharedCard}>
        <View style={s.sectionHead}><View style={s.sectionTitleWrap}><View style={s.peopleCircle}><Ionicons name="people" size={22} color="#507EBB"/></View><View><Text style={s.sectionTitle}>Shared Expenses</Text><Text style={s.sectionSub}>{sharedItems.length} group {sharedItems.length === 1 ? "expense" : "expenses"} · {syncStatus === "live" ? "live sync on" : "saved locally"}</Text></View></View><Pressable onPress={() => setEditor("new")} style={s.addButton}><Ionicons name="add" size={17} color="#507BB4"/><Text style={s.addLink}>Add Expense</Text></Pressable></View>
        <View style={s.sharedList}>{sharedItems.map((expense) => <SharedExpenseCard key={expense.id} expense={expense} people={people} onEdit={() => setEditor(expense)}/>)}</View>
        {!sharedItems.length ? <View style={s.empty}><Ionicons name="people-outline" size={28} color="#6F97C9"/><Text style={s.emptyTitle}>No shared expenses yet</Text><Text style={s.emptySub}>Add the first group expense and TRAVA will calculate the split.</Text></View> : null}
        <Pressable onPress={() => setManageOpen(true)} style={s.manageButton}><Text style={s.manage}>Manage Shared Expenses</Text><Ionicons name="chevron-forward" size={17} color="#5A82BB"/></Pressable>
      </Glass>

      <LinearGradient colors={["#FFF7FA", "#F5F2FF", "#EEF7FF"]} style={s.invoiceOuter}>
        <View style={s.invoiceHead}><View><View style={s.invoiceTitleRow}><Ionicons name="receipt" size={20} color="#5E83BC"/><Text style={s.invoiceTitle}>Invoice Generator</Text></View><Text style={s.invoiceSub}>Preview a real receipt image before sharing it</Text></View><Image source={gift} contentFit="contain" style={s.gift}/></View>
        <View style={s.invoiceInner}><Text style={s.tripInvoice}>Trip Invoice — {trip.name || "Japan"}</Text><View style={s.invoiceMetrics}><View><Text style={s.costLabel}>Total Amount</Text><Text style={s.invoiceValue}>₱{money(shared)}</Text></View><View><Text style={s.costLabel}>Per Person</Text><Text style={s.invoiceValue}>₱{money(per)}</Text></View></View><View style={s.invoiceAvatars}><AvatarStack count={people}/><Text style={s.peopleText}>{people} {people === 1 ? "Person" : "People"}</Text></View><View style={s.invoiceBtns}><InvoiceBtn icon="notifications-outline" label="Send Reminder" onPress={() => Alert.alert("Reminder ready", "Open the travel group to choose who should receive a reminder.")}/><InvoiceBtn icon="document-text-outline" label="Receipt Preview" onPress={() => setReceiptOpen(true)}/></View></View>
      </LinearGradient>
    </View></ScrollView>

    <ExpenseModal key={`shared-expense-${editor === "new" ? "new" : editor?.id ?? "idle"}`} value={editor} onClose={() => setEditor(null)} onSave={(v) => { if (editor && editor !== "new") updateExpense(editor.id, v); else addExpense({ ...v, shared: true, paid: true }); setEditor(null); }} onDelete={editor && editor !== "new" ? () => { deleteExpense(editor.id); setEditor(null); } : undefined}/>
    <ManageSharedModal key="manage-shared-modal" visible={manageOpen} expenses={sharedItems} onClose={() => setManageOpen(false)} onEdit={(e) => { setManageOpen(false); setEditor(e); }} onDelete={(e) => Alert.alert("Delete shared expense?", e.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteExpense(e.id) }])}/>
    <ReceiptPreviewModal key={`receipt-${receiptOpen ? "open" : "idle"}`} visible={receiptOpen} tripName={trip.name || "Japan"} expenses={sharedItems} people={people} onClose={() => setReceiptOpen(false)}/>
  </ScreenShell></SafeAreaView>;
}

function SharedExpenseCard({ expense, people, onEdit }: { expense: LocalExpense; people: number; onEdit(): void }) {
  return <LinearGradient colors={["#FFF7FA", "#F7F5FF", "#F0F8FF"]} style={s.sharedExpense}>
    <ExpenseVisual expense={expense}/><View style={s.dinnerCopy}><Text style={s.dinnerTitle}>{expense.title}</Text><Text style={s.paidBy}>{expense.category}</Text><AvatarStack count={people}/></View><View style={s.costBox}><Text style={s.costLabel}>Total Cost</Text><Text style={s.costValue}>₱{money(expense.amount)}</Text><View style={s.paidPill}><Ionicons name={expense.paid === false ? "time" : "checkmark-circle"} size={13} color={expense.paid === false ? "#D39B52" : "#43A87D"}/><Text style={[s.paidText, expense.paid === false && { color: "#B8843D" }]}>{expense.paid === false ? "Unpaid" : "Paid"}</Text></View></View><Pressable accessibilityLabel={`Edit ${expense.title}`} onPress={onEdit} style={s.cardEdit}><Ionicons name="create-outline" size={19} color="#587EAF"/></Pressable>
  </LinearGradient>;
}
function ExpenseVisual({ expense }: { expense: LocalExpense }) {
  if (expense.category === "Food & Dining") return <View style={s.foodVisual}><Image source={ramen} contentFit="contain" style={s.ramen}/></View>;
  const meta = expenseMeta(expense.category);
  return <LinearGradient colors={meta.colors} style={s.categoryVisual}><Ionicons name={meta.icon} size={34} color={meta.fg}/></LinearGradient>;
}
function expenseMeta(category: string): { icon: TravaIconName; colors: [string, string]; fg: string } {
  if (category === "Accommodation") return { icon: "bed-outline", colors: ["#EEE9FF", "#D7D0FA"], fg: "#6D66CC" };
  if (category === "Transportation") return { icon: "airplane-outline", colors: ["#E4F3FF", "#C9E3FA"], fg: "#418BCB" };
  if (category === "Activities") return { icon: "ticket-outline", colors: ["#FFF0F6", "#F8D6E7"], fg: "#C86491" };
  if (category === "Shopping") return { icon: "bag-handle-outline", colors: ["#FFF2E9", "#F9D6BA"], fg: "#C77C42" };
  return { icon: "receipt-outline", colors: ["#EEF2F7", "#DEE5EE"], fg: "#66768C" };
}

function AvatarStack({ count }: { count: number }) { const letters = ["V", "M", "A"]; const visible = Math.min(count, 3); return <View style={s.avatars}>{Array.from({ length: visible }, (_, i) => <View key={`avatar-${i}`} style={[s.avatarCircle, i === 1 && s.avatarTwo, i === 2 && s.avatarThree]}><Text style={s.avatarText}>{letters[i] || i + 1}</Text></View>)}{count > 3 ? <View style={s.plusTwo}><Text style={s.plusTwoText}>+{count - 3}</Text></View> : null}</View>; }
function InvoiceBtn({ icon, label, onPress }: { icon: TravaIconName; label: string; onPress(): void }) { return <Pressable onPress={onPress} style={({ pressed }) => [s.invoiceBtn, pressed && s.pressed]}><Ionicons name={icon} size={20} color="#567FB7"/><Text style={s.invoiceBtnText}>{label}</Text></Pressable>; }

function ReceiptPreviewModal({ visible, tripName, expenses, people, onClose }: { visible: boolean; tripName: string; expenses: LocalExpense[]; people: number; onClose(): void }) {
  const receiptRef = useRef<View | null>(null);
  const [webImage, setWebImage] = useState<string | null>(null);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  useEffect(() => { if (visible && Platform.OS === "web") setWebImage(makeReceiptPng(tripName, expenses, people)); else if (!visible) setWebImage(null); }, [visible, tripName, expenses, people]);
  if (!visible) return null;

  async function shareImage() {
    try {
      if (Platform.OS === "web") {
        const dataUrl = webImage || makeReceiptPng(tripName, expenses, people); setWebImage(dataUrl);
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `TRAVA-${safeName(tripName)}-receipt.png`, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
        if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) { await nav.share({ title: `${tripName} receipt`, text: "TRAVA shared expense receipt", files: [file] }); return; }
        Alert.alert("Browser sharing unavailable", "Use Messenger, Instagram, Email, or the Save PNG button below. TRAVA will not download anything automatically."); return;
      }
      const uri = await captureRef(receiptRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share TRAVA receipt" });
      else Alert.alert("Sharing unavailable", "This device does not provide a share sheet.");
    } catch { Alert.alert("Share receipt", "The receipt image could not be shared."); }
  }
  async function copyAndOpen(target: "messenger" | "instagram") {
    if (Platform.OS !== "web") { await shareImage(); return; }
    try {
      const dataUrl = webImage || makeReceiptPng(tripName, expenses, people); setWebImage(dataUrl);
      const blob = await (await fetch(dataUrl)).blob();
      const clip = navigator.clipboard as Clipboard & { write?: (items: ClipboardItem[]) => Promise<void> };
      if (clip?.write && typeof ClipboardItem !== "undefined") await clip.write([new ClipboardItem({ "image/png": blob })]);
      window.open(target === "messenger" ? "https://www.messenger.com/" : "https://www.instagram.com/direct/inbox/", "_blank", "noopener,noreferrer");
      Alert.alert("Receipt copied", `Paste the receipt image into ${target === "messenger" ? "Messenger" : "Instagram"}.`);
    } catch { await shareImage(); }
  }
  async function email() {
    if (Platform.OS !== "web") { await shareImage(); return; }
    try {
      const dataUrl = webImage || makeReceiptPng(tripName, expenses, people); setWebImage(dataUrl);
      const blob = await (await fetch(dataUrl)).blob();
      const clip = navigator.clipboard as Clipboard & { write?: (items: ClipboardItem[]) => Promise<void> };
      if (clip?.write && typeof ClipboardItem !== "undefined") await clip.write([new ClipboardItem({ "image/png": blob })]);
    } catch { /* email still opens with the receipt summary */ }
    const subject = encodeURIComponent(`${tripName} TRAVA receipt`);
    const body = encodeURIComponent(`TRAVA — ${tripName}\nTotal: ₱${money(total)}\nPeople: ${people}\nPer person: ₱${money(total / Math.max(1, people))}\n\nThe receipt image has been copied when browser permissions allow it. Paste it into your email.`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  }
  function saveImage() {
    if (Platform.OS !== "web") { void shareImage(); return; }
    const dataUrl = webImage || makeReceiptPng(tripName, expenses, people); setWebImage(dataUrl);
    downloadDataUrl(`TRAVA-${safeName(tripName)}-receipt.png`, dataUrl);
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal, s.receiptModal]}><View style={s.modalHeader}><View><Text style={s.modalTitle}>Receipt image preview</Text><Text style={s.modalSub}>Nothing downloads until you choose Save/Share.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View>
    {Platform.OS === "web" && webImage ? <Image source={{ uri: webImage }} contentFit="contain" style={s.receiptImage}/> : <View ref={receiptRef} collapsable={false} style={s.receiptCanvas}><Text style={s.receiptBrand}>TRAVA</Text><Text style={s.receiptTrip}>{tripName}</Text><View style={s.receiptRule}/>{expenses.map((e) => <View key={`receipt-line-${e.id}`} style={s.receiptLine}><View><Text style={s.receiptItem}>{e.title}</Text><Text style={s.receiptCat}>{e.category}</Text></View><Text style={s.receiptAmount}>₱{money(e.amount)}</Text></View>)}<View style={s.receiptRule}/><View style={s.receiptLine}><Text style={s.receiptTotalLabel}>TOTAL</Text><Text style={s.receiptTotal}>₱{money(total)}</Text></View><Text style={s.receiptFooter}>{people} travelers · ₱{money(total / Math.max(1, people))} each</Text></View>}
    <View style={s.shareGrid}><Pressable onPress={() => void shareImage()} style={s.shareAction}><Ionicons name="share-social" size={21} color="#4F79B1"/><Text style={s.shareText}>Share image</Text></Pressable><Pressable onPress={() => void copyAndOpen("messenger")} style={s.shareAction}><Ionicons name="chatbubble-ellipses" size={21} color="#4F79B1"/><Text style={s.shareText}>Messenger</Text></Pressable><Pressable onPress={() => void copyAndOpen("instagram")} style={s.shareAction}><Ionicons name="logo-instagram" size={21} color="#B55F8E"/><Text style={s.shareText}>Instagram</Text></Pressable><Pressable onPress={() => void email()} style={s.shareAction}><Ionicons name="mail" size={21} color="#4F79B1"/><Text style={s.shareText}>Email</Text></Pressable><Pressable onPress={saveImage} style={s.shareAction}><Ionicons name="download-outline" size={21} color="#4F79B1"/><Text style={s.shareText}>Save PNG</Text></Pressable></View>
  </View></View></Modal>;
}
function makeReceiptPng(name: string, expenses: LocalExpense[], people: number) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = Math.max(1200, 520 + expenses.length * 120); const ctx = canvas.getContext("2d"); if (!ctx) return "";
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); grad.addColorStop(0, "#edf7ff"); grad.addColorStop(.55, "#f3f0ff"); grad.addColorStop(1, "#fff0f6"); ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = "#fff"; roundRect(ctx,80,70,920,canvas.height-140,48); ctx.fill();
  ctx.fillStyle="#101a35";ctx.font="900 64px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText("TRAVA",140,180);ctx.font="800 38px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(name,140,240);ctx.fillStyle="#6e7995";ctx.font="600 24px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText("Shared expense receipt",140,282);
  let y=370;ctx.strokeStyle="#e6eaf1";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(140,y);ctx.lineTo(940,y);ctx.stroke();y+=70;
  for(const e of expenses){ctx.fillStyle="#101a35";ctx.font="800 28px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(e.title,140,y);ctx.textAlign="right";ctx.fillText(`₱${money(e.amount)}`,940,y);ctx.textAlign="left";ctx.fillStyle="#74809a";ctx.font="600 20px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(e.category,140,y+34);y+=105;}
  ctx.strokeStyle="#e6eaf1";ctx.beginPath();ctx.moveTo(140,y);ctx.lineTo(940,y);ctx.stroke();y+=75;const total=expenses.reduce((a,e)=>a+e.amount,0);ctx.fillStyle="#101a35";ctx.font="900 34px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText("TOTAL",140,y);ctx.textAlign="right";ctx.fillText(`₱${money(total)}`,940,y);ctx.textAlign="left";ctx.fillStyle="#6e7995";ctx.font="600 21px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(`${people} travelers · ₱${money(total/Math.max(1,people))} each`,140,y+48);return canvas.toDataURL("image/png",.95);
}
function roundRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function downloadDataUrl(filename:string,dataUrl:string){const a=document.createElement("a");a.href=dataUrl;a.download=filename;a.click();}
function safeName(value:string){return value.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"Trip";}

function ManageSharedModal({ visible, expenses, onClose, onEdit, onDelete }: { visible: boolean; expenses: LocalExpense[]; onClose(): void; onEdit(e: LocalExpense): void; onDelete(e: LocalExpense): void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal, s.manageModal]}><View style={s.modalHeader}><View><Text style={s.modalTitle}>Shared expenses</Text><Text style={s.modalSub}>Every saved shared expense is listed here.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><ScrollView style={s.manageList}>{expenses.map((e) => <View key={`manage-${e.id}`} style={s.manageRow}><ExpenseMiniIcon category={e.category}/><View style={s.manageCopy}><Text style={s.manageTitle}>{e.title}</Text><Text style={s.manageMeta}>{e.category} · ₱{money(e.amount)}</Text></View><Pressable onPress={() => onEdit(e)} style={s.iconButton}><Ionicons name="create-outline" size={18} color="#597DAE"/></Pressable><Pressable onPress={() => onDelete(e)} style={s.iconButton}><Ionicons name="trash-outline" size={18} color="#D5687C"/></Pressable></View>)}</ScrollView></View></View></Modal>;
}
function ExpenseMiniIcon({ category }: { category: string }) { const meta = expenseMeta(category); return <LinearGradient colors={meta.colors} style={s.manageIcon}><Ionicons name={meta.icon} size={19} color={meta.fg}/></LinearGradient>; }

function ExpenseModal({ value, onClose, onSave, onDelete }: { value: LocalExpense | null | "new"; onClose(): void; onSave(v: Omit<LocalExpense, "id">): void; onDelete?: () => void }) {
  const current = value && value !== "new" ? value : null; const [title,setTitle]=useState(current?.title??""); const [amount,setAmount]=useState(String(current?.amount??"")); const [category,setCategory]=useState(current?.category??CATEGORIES[0]); const [paid,setPaid]=useState(current?.paid!==false); const [selectOpen,setSelectOpen]=useState(false); const [error,setError]=useState<string|null>(null); if(!value)return null;
  function save(){const numeric=Number(amount);if(title.trim().length<2||!Number.isFinite(numeric)||numeric<=0){setError("Add a clear title and a valid amount greater than zero.");return;}onSave({title:title.trim(),amount:numeric,category,date:current?.date??"Today",shared:true,paid});}
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHeader}><View><Text style={s.modalTitle}>{current?"Edit shared expense":"Add shared expense"}</Text><Text style={s.modalSub}>This update syncs live to collaborators who have the trip open.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><Text style={s.label}>Expense name</Text><TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Dinner, hotel, taxi…" placeholderTextColor="#98A3B6"/><Text style={s.label}>Amount</Text><View style={s.moneyInput}><Text style={s.currency}>₱</Text><TextInput style={s.moneyField} value={amount} onChangeText={(text)=>setAmount(cleanMoney(text))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#98A3B6"/></View><Text style={s.label}>Category</Text><Pressable onPress={()=>setSelectOpen(v=>!v)} style={s.select}><Text style={s.selectText}>{category}</Text><Ionicons name={selectOpen?"chevron-up":"chevron-down"} size={17} color="#72809A"/></Pressable>{selectOpen?<View style={s.selectMenu}>{CATEGORIES.map(c=><Pressable key={c} onPress={()=>{setCategory(c);setSelectOpen(false);}} style={[s.selectOption,c===category&&s.selectOptionOn]}><Text style={s.selectOptionText}>{c}</Text>{c===category?<Ionicons name="checkmark" size={16} color="#5D86BE"/>:null}</Pressable>)}</View>:null}<Pressable onPress={()=>setPaid(v=>!v)} style={s.paidToggle}><View style={[s.checkbox,paid&&s.checkboxOn]}>{paid?<Ionicons name="checkmark" size={15} color="#FFF"/>:null}</View><View><Text style={s.paidToggleTitle}>Mark as paid</Text><Text style={s.paidToggleSub}>Turn off if the expense still needs settlement.</Text></View></Pressable>{error?<Text style={s.error}>{error}</Text>:null}<View style={s.modalBtns}>{onDelete?<Pressable onPress={onDelete} style={s.delete}><Ionicons name="trash-outline" size={17} color="#D75E76"/><Text style={s.deleteText}>Delete</Text></Pressable>:null}<Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={save} style={s.savePress}><LinearGradient colors={["#6EA9E7","#9EA6EC","#EA8EB7"]} style={s.save}><Text style={s.saveText}>Save expense</Text></LinearGradient></Pressable></View></View></View></Modal>;
}
function cleanMoney(value:string){const cleaned=value.replace(/[^0-9.]/g,"");const[whole,...rest]=cleaned.split(".");return rest.length?`${whole}.${rest.join("").slice(0,2)}`:whole;}function money(value:number){return Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:22,paddingBottom:130},max:{width:"100%",maxWidth:640,alignSelf:"center",gap:16},summaryRow:{flexDirection:"row",gap:14},summary:{flex:1,height:278,borderRadius:28,overflow:"hidden",padding:22,borderWidth:1,borderColor:"#E4EBF4",boxShadow:"0 15px 34px rgba(85,98,129,.10)"},sumLabel:{fontSize:16,fontWeight:"800"},sumValue:{marginTop:13,color:PX.ink,fontSize:29,fontWeight:"900",letterSpacing:-.7},sumSub:{marginTop:8,color:"#66749A",fontSize:12,fontWeight:"600"},sumAsset:{position:"absolute",width:180,height:150,right:-5,bottom:8},
  sharedCard:{borderRadius:28,padding:20},sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},sectionTitleWrap:{flexDirection:"row",alignItems:"center",gap:10},peopleCircle:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#E7F2FF"},sectionTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},sectionSub:{marginTop:2,color:PX.muted,fontSize:9,fontWeight:"600"},addButton:{minHeight:40,paddingHorizontal:12,borderRadius:16,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#EAF4FF"},addLink:{color:"#507BB4",fontSize:10,fontWeight:"900"},sharedList:{marginTop:14,gap:10},sharedExpense:{minHeight:148,borderRadius:24,padding:16,flexDirection:"row",alignItems:"center",gap:13,borderWidth:1,borderColor:"#E8EDF5"},foodVisual:{width:84,height:84,borderRadius:42,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.84)"},ramen:{width:74,height:74},categoryVisual:{width:84,height:84,borderRadius:26,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(255,255,255,.9)"},dinnerCopy:{flex:1},dinnerTitle:{color:PX.ink,fontSize:16,fontWeight:"900"},paidBy:{marginTop:6,color:"#617092",fontSize:10,fontWeight:"600"},avatars:{marginTop:10,flexDirection:"row",alignItems:"center"},avatarCircle:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#DDEEFF",borderWidth:2,borderColor:"#FFF",marginRight:-5},avatarTwo:{backgroundColor:"#E9E6FF"},avatarThree:{backgroundColor:"#FFE4F0"},avatarText:{color:"#4A6080",fontSize:9,fontWeight:"900"},plusTwo:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E3E8F0",marginLeft:2},plusTwoText:{color:"#566284",fontSize:9,fontWeight:"900"},costBox:{alignItems:"flex-start"},costLabel:{color:"#66749A",fontSize:9,fontWeight:"600"},costValue:{marginTop:4,color:PX.ink,fontSize:20,fontWeight:"900"},paidPill:{marginTop:10,paddingHorizontal:10,paddingVertical:6,borderRadius:16,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#E8F8F1"},paidText:{color:"#3A9470",fontSize:9,fontWeight:"900"},cardEdit:{width:38,height:38,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.82)"},manageButton:{paddingTop:18,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4},manage:{color:"#5A82BB",fontSize:11,fontWeight:"900"},empty:{marginTop:14,minHeight:130,alignItems:"center",justifyContent:"center",padding:18,borderRadius:22,backgroundColor:"#F7FAFE"},emptyTitle:{marginTop:7,color:PX.ink,fontSize:12,fontWeight:"900"},emptySub:{marginTop:4,color:PX.muted,fontSize:9,fontWeight:"600",textAlign:"center"},
  invoiceOuter:{borderRadius:28,padding:18,borderWidth:1,borderColor:"#E8EEF7",boxShadow:"0 15px 34px rgba(86,101,132,.09)"},invoiceHead:{minHeight:72,flexDirection:"row",justifyContent:"space-between"},invoiceTitleRow:{flexDirection:"row",alignItems:"center",gap:7},invoiceTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},invoiceSub:{marginTop:5,color:"#657294",fontSize:10,fontWeight:"600"},gift:{position:"absolute",right:-4,top:-18,width:120,height:100},invoiceInner:{marginTop:8,padding:20,borderRadius:24,backgroundColor:"rgba(255,255,255,.88)",borderWidth:1,borderColor:"#E9EDF4"},tripInvoice:{color:PX.ink,fontSize:18,fontWeight:"900"},invoiceMetrics:{marginTop:22,flexDirection:"row",gap:70},invoiceValue:{marginTop:5,color:PX.ink,fontSize:20,fontWeight:"900"},invoiceAvatars:{marginTop:22,paddingTop:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"#DADDE7",flexDirection:"row",alignItems:"center"},peopleText:{marginLeft:14,color:"#637092",fontSize:10,fontWeight:"700"},invoiceBtns:{marginTop:18,flexDirection:"row",gap:9},invoiceBtn:{flex:1,minHeight:56,borderRadius:18,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:6,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E9EBF2"},invoiceBtnText:{color:"#284366",fontSize:10,fontWeight:"800"},pressed:{opacity:.7},
  backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:22,backgroundColor:"rgba(11,17,36,.42)"},modal:{width:"100%",maxWidth:450,maxHeight:"90%",padding:20,borderRadius:26,backgroundColor:"#FFF"},manageModal:{maxWidth:520},receiptModal:{maxWidth:560},modalHeader:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},modalTitle:{color:PX.ink,fontSize:19,fontWeight:"900"},modalSub:{marginTop:4,color:PX.muted,fontSize:9,lineHeight:14,fontWeight:"600"},close:{width:36,height:36,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F7FA"},label:{marginTop:13,marginBottom:6,color:"#526079",fontSize:9,fontWeight:"900"},input:{minHeight:49,paddingHorizontal:14,borderRadius:15,backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E8ECF3",color:PX.ink,fontSize:11,fontWeight:"700"},moneyInput:{height:50,borderRadius:15,flexDirection:"row",alignItems:"center",backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E8ECF3"},currency:{marginLeft:14,color:"#63789A",fontSize:14,fontWeight:"900"},moneyField:{flex:1,height:"100%",paddingHorizontal:10,color:PX.ink,fontSize:12,fontWeight:"800"},select:{height:49,paddingHorizontal:13,borderRadius:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E8ECF3"},selectText:{color:PX.ink,fontSize:11,fontWeight:"800"},selectMenu:{marginTop:6,overflow:"hidden",borderRadius:15,borderWidth:1,borderColor:"#E6EBF2",backgroundColor:"#FFF"},selectOption:{minHeight:39,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},selectOptionOn:{backgroundColor:"#EFF7FF"},selectOptionText:{color:"#56657D",fontSize:10,fontWeight:"700"},paidToggle:{marginTop:13,padding:11,borderRadius:15,flexDirection:"row",gap:9,alignItems:"center",backgroundColor:"#F8FAFD"},checkbox:{width:24,height:24,borderRadius:8,alignItems:"center",justifyContent:"center",borderWidth:1.5,borderColor:"#B7C3D3"},checkboxOn:{borderColor:"#6699D5",backgroundColor:"#6699D5"},paidToggleTitle:{color:PX.ink,fontSize:10,fontWeight:"900"},paidToggleSub:{marginTop:2,color:PX.muted,fontSize:8,fontWeight:"600"},error:{marginTop:9,color:"#C46172",fontSize:9,fontWeight:"700"},modalBtns:{marginTop:16,flexDirection:"row",gap:8},delete:{height:46,paddingHorizontal:13,borderRadius:14,flexDirection:"row",gap:5,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0F3"},deleteText:{color:"#D75E76",fontWeight:"900",fontSize:9},cancel:{flex:1,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EEF0F5"},cancelText:{color:PX.muted,fontWeight:"900",fontSize:9},savePress:{flex:1.6},save:{height:46,borderRadius:14,alignItems:"center",justifyContent:"center"},saveText:{color:"#FFF",fontWeight:"900",fontSize:9},manageList:{marginTop:12},manageRow:{minHeight:66,flexDirection:"row",alignItems:"center",gap:9,borderBottomWidth:1,borderBottomColor:"#EEF1F5"},manageIcon:{width:40,height:40,borderRadius:13,alignItems:"center",justifyContent:"center"},manageCopy:{flex:1,minWidth:0},manageTitle:{color:PX.ink,fontSize:11,fontWeight:"900"},manageMeta:{marginTop:3,color:PX.muted,fontSize:8,fontWeight:"600"},iconButton:{width:34,height:34,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F9FC"},
  receiptImage:{width:"100%",height:430,marginTop:14,borderRadius:22,backgroundColor:"#F4F7FC"},receiptCanvas:{marginTop:14,padding:28,borderRadius:22,backgroundColor:"#F4F7FC"},receiptBrand:{color:PX.ink,fontSize:28,fontWeight:"900"},receiptTrip:{marginTop:3,color:PX.ink,fontSize:16,fontWeight:"800"},receiptRule:{height:1,backgroundColor:"#DDE3EC",marginVertical:18},receiptLine:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},receiptItem:{color:PX.ink,fontSize:12,fontWeight:"900"},receiptCat:{marginTop:3,color:PX.muted,fontSize:9,fontWeight:"600"},receiptAmount:{color:PX.ink,fontSize:12,fontWeight:"900"},receiptTotalLabel:{color:PX.ink,fontSize:13,fontWeight:"900"},receiptTotal:{color:PX.ink,fontSize:18,fontWeight:"900"},receiptFooter:{marginTop:12,color:PX.muted,fontSize:9,fontWeight:"700"},shareGrid:{marginTop:15,flexDirection:"row",flexWrap:"wrap",gap:8},shareAction:{width:"48%",minHeight:48,borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#F3F7FC",borderWidth:1,borderColor:"#E4EAF2"},shareText:{color:"#38577E",fontSize:10,fontWeight:"900"},
});
