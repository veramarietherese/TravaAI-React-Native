import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { TripMember } from "@trava/shared";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { Glass, PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { PremiumCategoryIcon } from "@/features/trips/components/PremiumCategoryIcon";
import { listTripMembers } from "@/features/members/api/members.api";
import { useLocalTripWorkspace, type LocalExpense } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const piggy = require("../../../../assets/trava-pixel/personal-piggy.png");
const group = require("../../../../assets/trava-pixel/shared-group.png");
const gift = require("../../../../assets/trava-pixel/invoice-gift.png");
const CATEGORIES = ["Food & Dining", "Accommodation", "Transportation", "Activities", "Shopping", "Other"] as const;

export function ExpensesScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const workspace = useLocalTripWorkspace(tripId);
  const { state, addExpense, updateExpense, deleteExpense } = workspace;
  const syncStatus = (workspace as typeof workspace & { syncStatus?: "live" | "local" }).syncStatus ?? "local";
  const [editor, setEditor] = useState<LocalExpense | null | "new">(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const membersQuery = useQuery({ queryKey:["trip-members",tripId], queryFn:()=>listTripMembers(tripId), enabled:!tripId.startsWith("local-") });

  const personalItems = useMemo(() => state.expenses.filter((e) => !e.shared), [state.expenses]);
  const sharedItems = useMemo(() => state.expenses.filter((e) => e.shared), [state.expenses]);
  const personal = useMemo(() => personalItems.reduce((sum, e) => sum + e.amount, 0), [personalItems]);
  const shared = useMemo(() => sharedItems.reduce((sum, e) => sum + e.amount, 0), [sharedItems]);
  const acceptedMembers = useMemo(() => (membersQuery.data?.members ?? []).filter((member) => member.status === "accepted"), [membersQuery.data?.members]);
  const people = Math.max(1, acceptedMembers.length || trip.memberCount || 1);
  const contributors = useMemo(() => buildContributors(acceptedMembers, people, shared, sharedItems.every((item) => item.paid !== false)), [acceptedMembers, people, shared, sharedItems]);
  const per = shared / people;

  async function sendReminder() {
    const unpaid = contributors.filter((person) => !person.paid);
    const targets = unpaid.length ? unpaid : contributors;
    const message = `TRAVA payment reminder — ${trip.name || "Trip"}\n${targets.map((person) => `${person.name}: ₱${money(person.amount)} ${person.paid ? "(paid)" : "still due"}`).join("\n")}\nTotal shared expenses: ₱${money(shared)}`;
    try {
      if (Platform.OS === "web") {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message);
        Alert.alert("Reminder copied", "The payment reminder is copied. Paste it into your TRAVA group chat, Messenger, or email.");
        return;
      }
      await Share.share({ title: `${trip.name || "Trip"} payment reminder`, message });
    } catch {
      Alert.alert("Reminder", message);
    }
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Japan"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <View style={s.summaryRow}>
        <LinearGradient colors={["#E8F4FF", "#F0F0FF", "#FFF0F6"]} style={s.summary}><Text style={[s.sumLabel, { color: "#547CB8" }]}>Personal Expenses</Text><Text style={s.sumValue}>₱{money(personal)}</Text><Text style={s.sumSub}>Across {personalItems.length} {personalItems.length === 1 ? "expense" : "expenses"}</Text><Image source={piggy} contentFit="contain" style={s.sumAsset}/></LinearGradient>
        <LinearGradient colors={["#FFF0F5", "#F4F0FF", "#EAF5FF"]} style={s.summary}><Text style={[s.sumLabel, { color: "#C96D98" }]}>Shared Expenses</Text><Text style={s.sumValue}>₱{money(shared)}</Text><Text style={s.sumSub}>Across {sharedItems.length} {sharedItems.length === 1 ? "expense" : "expenses"}</Text><Image source={group} contentFit="contain" style={s.sumAsset}/></LinearGradient>
      </View>

      <Glass style={s.sharedCard}>
        <View style={s.sectionHead}><View style={s.sectionTitleWrap}><View style={s.peopleCircle}><Ionicons name="people" size={22} color="#507EBB"/></View><View><Text style={s.sectionTitle}>Shared Expenses</Text><Text style={s.sectionSub}>{sharedItems.length} group {sharedItems.length === 1 ? "expense" : "expenses"} · {syncStatus === "live" ? "live sync on" : "saved locally"}</Text></View></View><Pressable onPress={() => setEditor("new")} style={s.addButton}><Ionicons name="add" size={17} color="#507BB4"/><Text style={s.addLink}>Add Expense</Text></Pressable></View>
        <View style={s.sharedList}>{sharedItems.slice(0,5).map((expense) => <SharedExpenseCard key={expense.id} expense={expense} people={people} onEdit={() => setEditor(expense)}/>)}</View>{sharedItems.length>5?<Text style={s.moreShared}>+{sharedItems.length-5} more shared expenses</Text>:null}
        {!sharedItems.length ? <View style={s.empty}><Ionicons name="people-outline" size={28} color="#6F97C9"/><Text style={s.emptyTitle}>No shared expenses yet</Text><Text style={s.emptySub}>Add the first group expense and TRAVA will calculate the split.</Text></View> : null}
        <Pressable onPress={() => setManageOpen(true)} style={s.manageButton}><Text style={s.manage}>Manage Shared Expenses</Text><Ionicons name="chevron-forward" size={17} color="#5A82BB"/></Pressable>
      </Glass>

      <LinearGradient colors={["#FFF7FA", "#F5F2FF", "#EEF7FF"]} style={s.invoiceOuter}>
        <View style={s.invoiceHead}><View><View style={s.invoiceTitleRow}><Ionicons name="receipt" size={20} color="#5E83BC"/><Text style={s.invoiceTitle}>Invoice Generator</Text></View><Text style={s.invoiceSub}>Preview a real receipt image before sharing it</Text></View><Image source={gift} contentFit="contain" style={s.gift}/></View>
        <View style={s.invoiceInner}><Text style={s.tripInvoice}>Trip Invoice — {trip.name || "Japan"}</Text><View style={s.invoiceMetrics}><View><Text style={s.costLabel}>Total Amount</Text><Text style={s.invoiceValue}>₱{money(shared)}</Text></View><View><Text style={s.costLabel}>Per Person</Text><Text style={s.invoiceValue}>₱{money(per)}</Text></View></View><View style={s.invoiceAvatars}><AvatarStack count={people}/><Text style={s.peopleText}>{people} {people === 1 ? "Person" : "People"}</Text></View><View style={s.invoiceBtns}><InvoiceBtn icon="notifications-outline" label="Send Reminder" primary onPress={() => void sendReminder()}/><InvoiceBtn icon="document-text-outline" label="Receipt Preview" onPress={() => setReceiptOpen(true)}/></View></View>
      </LinearGradient>
    </View></ScrollView>

    <ExpenseModal key={`shared-expense-${editor === "new" ? "new" : editor?.id ?? "idle"}`} value={editor} onClose={() => setEditor(null)} onSave={(v) => { if (editor && editor !== "new") updateExpense(editor.id, v); else addExpense({ ...v, shared: true, paid: true }); setEditor(null); }} onDelete={editor && editor !== "new" ? () => { deleteExpense(editor.id); setEditor(null); } : undefined}/>
    <ManageSharedModal key="manage-shared-modal" visible={manageOpen} expenses={sharedItems} onClose={() => setManageOpen(false)} onEdit={(e) => { setManageOpen(false); setEditor(e); }} onDelete={(e) => Alert.alert("Delete shared expense?", e.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteExpense(e.id) }])}/>
    <ReceiptPreviewModal key={`receipt-${receiptOpen ? "open" : "idle"}`} visible={receiptOpen} tripName={trip.name || "Japan"} expenses={sharedItems} contributors={contributors} onClose={() => setReceiptOpen(false)}/>
  </ScreenShell></SafeAreaView>;
}

function SharedExpenseCard({ expense, people, onEdit }: { expense: LocalExpense; people: number; onEdit(): void }) {
  return <LinearGradient colors={["#FFF7FA", "#F7F5FF", "#F0F8FF"]} style={s.sharedExpense}>
    <ExpenseVisual expense={expense}/><View style={s.dinnerCopy}><Text style={s.dinnerTitle}>{expense.title}</Text><Text style={s.paidBy}>{expense.category}</Text><AvatarStack count={people}/></View><View style={s.costBox}><Text style={s.costLabel}>Total Cost</Text><Text style={s.costValue}>₱{money(expense.amount)}</Text><View style={s.paidPill}><Ionicons name={expense.paid === false ? "time" : "checkmark-circle"} size={13} color={expense.paid === false ? "#D39B52" : "#43A87D"}/><Text style={[s.paidText, expense.paid === false && { color: "#B8843D" }]}>{expense.paid === false ? "Unpaid" : "Paid"}</Text></View></View><Pressable accessibilityLabel={`Edit ${expense.title}`} onPress={onEdit} style={s.cardEdit}><Ionicons name="create-outline" size={19} color="#587EAF"/></Pressable>
  </LinearGradient>;
}
function ExpenseVisual({ expense }: { expense: LocalExpense }) {
  const meta = expenseMeta(expense.category);
  return <View style={s.expenseVisual}><PremiumCategoryIcon category={expense.category} size={44}/></View>;
}
function expenseMeta(category: string): { icon: TravaIconName; colors: [string, string]; fg: string; tilt: number } {
  if (category === "Food & Dining") return { icon: "restaurant-outline", colors: ["#F28FB0", "#FFC1D3"], fg: "#FFFFFF", tilt: -4 };
  if (category === "Accommodation") return { icon: "bed-outline", colors: ["#8C80E7", "#C7BDF8"], fg: "#FFFFFF", tilt: 3 };
  if (category === "Transportation") return { icon: "airplane-outline", colors: ["#69ACE7", "#B8DCF8"], fg: "#FFFFFF", tilt: -3 };
  if (category === "Activities") return { icon: "ticket-outline", colors: ["#66BFA2", "#B4E6D4"], fg: "#FFFFFF", tilt: 4 };
  if (category === "Shopping") return { icon: "bag-handle-outline", colors: ["#E79A62", "#FFD0A7"], fg: "#FFFFFF", tilt: -3 };
  return { icon: "receipt-outline", colors: ["#7B8596", "#BDC5D0"], fg: "#FFFFFF", tilt: 2 };
}

type ReceiptContributor = { id: string; name: string; avatarUrl: string | null; amount: number; paid: boolean };
function buildContributors(members: TripMember[], people: number, total: number, paid: boolean): ReceiptContributor[] {
  const amount = total / Math.max(1, people);
  if (members.length) return members.slice(0, people).map((member) => ({ id: member.id, name: member.fullName || "Traveler", avatarUrl: member.avatarUrl, amount, paid }));
  const fallbackNames = ["You", "Traveler 2", "Traveler 3", "Traveler 4", "Traveler 5"];
  return Array.from({length:people},(_,index)=>({id:`fallback-${index}`,name:fallbackNames[index]||`Traveler ${index+1}`,avatarUrl:null,amount,paid}));
}

function AvatarStack({ count }: { count: number }) { const letters = ["V", "M", "A"]; const visible = Math.min(count, 3); return <View style={s.avatars}>{Array.from({ length: visible }, (_, i) => <View key={`avatar-${i}`} style={[s.avatarCircle, i === 1 && s.avatarTwo, i === 2 && s.avatarThree]}><Text style={s.avatarText}>{letters[i] || i + 1}</Text></View>)}{count > 3 ? <View style={s.plusTwo}><Text style={s.plusTwoText}>+{count - 3}</Text></View> : null}</View>; }
function InvoiceBtn({ icon, label, primary = false, onPress }: { icon: TravaIconName; label: string; primary?: boolean; onPress(): void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.invoiceBtn, primary && s.invoiceBtnPrimary, pressed && s.pressed]}><Ionicons name={icon} size={19} color={primary ? "#FFFFFF" : "#20242B"}/><Text style={[s.invoiceBtnText, primary && s.invoiceBtnTextPrimary]}>{label}</Text></Pressable>;
}

function ReceiptPreviewModal({ visible, tripName, expenses, contributors, onClose }: { visible: boolean; tripName: string; expenses: LocalExpense[]; contributors: ReceiptContributor[]; onClose(): void }) {
  const receiptRef = useRef<View | null>(null);
  const [webImage, setWebImage] = useState<string | null>(null);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const allPaid = contributors.length ? contributors.every((item)=>item.paid) : false;
  useEffect(() => { if (visible && Platform.OS === "web") setWebImage(makeReceiptPng(tripName, contributors, total)); else if (!visible) setWebImage(null); }, [visible, tripName, contributors, total]);
  if (!visible) return null;

  async function shareImage() {
    try {
      if (Platform.OS === "web") {
        const dataUrl = webImage || makeReceiptPng(tripName, contributors, total); setWebImage(dataUrl);
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `TRAVA-${safeName(tripName)}-receipt.png`, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
        if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) { await nav.share({ title: `${tripName} receipt`, text: "TRAVA shared expense receipt", files: [file] }); return; }
        Alert.alert("Browser sharing unavailable", "Use Messenger, Instagram, Email, or Save PNG below."); return;
      }
      const uri = await captureRef(receiptRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share TRAVA receipt" });
      else Alert.alert("Sharing unavailable", "This device does not provide a share sheet.");
    } catch { Alert.alert("Share receipt", "The receipt image could not be shared."); }
  }
  async function copyAndOpen(target: "messenger" | "instagram") {
    if (Platform.OS !== "web") { await shareImage(); return; }
    try {
      const dataUrl = webImage || makeReceiptPng(tripName, contributors, total); setWebImage(dataUrl);
      const blob = await (await fetch(dataUrl)).blob();
      const clip = navigator.clipboard as Clipboard & { write?: (items: ClipboardItem[]) => Promise<void> };
      if (clip?.write && typeof ClipboardItem !== "undefined") await clip.write([new ClipboardItem({ "image/png": blob })]);
      window.open(target === "messenger" ? "https://www.messenger.com/" : "https://www.instagram.com/direct/inbox/", "_blank", "noopener,noreferrer");
      Alert.alert("Receipt copied", `Paste the receipt image into ${target === "messenger" ? "Messenger" : "Instagram"}.`);
    } catch { await shareImage(); }
  }
  async function email() {
    if (Platform.OS !== "web") { await shareImage(); return; }
    const subject = encodeURIComponent(`${tripName} TRAVA receipt`);
    const body = encodeURIComponent(`TRAVA — ${tripName}\nTotal: ₱${money(total)}\n${contributors.map((item)=>`${item.name}: ₱${money(item.amount)} · ${item.paid?"Paid":"Unpaid"}`).join("\n")}`);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  }
  function saveImage() {
    if (Platform.OS !== "web") { void shareImage(); return; }
    const dataUrl = webImage || makeReceiptPng(tripName, contributors, total); setWebImage(dataUrl);
    downloadDataUrl(`TRAVA-${safeName(tripName)}-receipt.png`, dataUrl);
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal, s.receiptModal]}><View style={s.modalHeader}><View><Text style={s.modalTitle}>Payment Status</Text><Text style={s.modalSub}>Receipt preview · contributor status</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View>
    <View ref={receiptRef} collapsable={false} style={s.receiptCanvas}>
      <View style={s.printerTop}/><View style={s.receiptPaper}><Text style={s.receiptTrip}>Trip Invoice — {tripName}</Text><View style={s.receiptDash}/>
        <View style={s.receiptSummary}><Text style={s.receiptSummaryLabel}>Total</Text><Text style={s.receiptSummaryValue}>₱{money(total)}</Text></View>
        <View style={s.receiptSummary}><Text style={s.receiptSummaryLabel}>Per Person</Text><Text style={s.receiptSummaryValue}>₱{money(total/Math.max(1,contributors.length))}</Text></View>
        <View style={s.receiptRule}/>{contributors.map((person,index)=><View key={person.id} style={s.contributorRow}><View style={s.contributorAvatar}>{person.avatarUrl?<Image source={{uri:person.avatarUrl}} contentFit="cover" style={StyleSheet.absoluteFillObject}/>:<Text style={s.contributorInitial}>{person.name.slice(0,1).toUpperCase()}</Text>}</View><View style={s.contributorCopy}><Text style={s.contributorName}>{person.name}</Text><Text style={s.contributorAmount}>₱{money(person.amount)}</Text></View><View style={[s.statusPill,!person.paid&&s.statusPillUnpaid]}><Ionicons name={person.paid?"checkmark-circle":"time"} size={14} color={person.paid?"#36B98A":"#E09232"}/><Text style={[s.statusText,!person.paid&&s.statusTextUnpaid]}>{person.paid?"Paid":"Unpaid"}</Text></View></View>)}
        <View style={s.receiptRule}/><View style={s.receiptTotalRow}><Text style={s.receiptTotalLabel}>TOTAL AMOUNT</Text><Text style={s.receiptTotal}>₱{money(total)}</Text></View><View style={s.paymentStatus}><Text style={s.paymentStatusLabel}>Payment Status</Text><Text style={s.paymentStatusValue}>{allPaid?"PAID":"UNPAID"}</Text></View>
      </View>
      <ReceiptQr label={`${contributors.length} ${contributors.length === 1 ? "contributor" : "contributors"} · ₱${money(total)}`}/>
    </View>
    <View style={s.shareGrid}><Pressable onPress={() => void shareImage()} style={s.shareAction}><Ionicons name="share-social" size={21} color="#4F79B1"/><Text style={s.shareText}>Share image</Text></Pressable><Pressable onPress={() => void copyAndOpen("messenger")} style={s.shareAction}><Ionicons name="chatbubble-ellipses" size={21} color="#4F79B1"/><Text style={s.shareText}>Messenger</Text></Pressable><Pressable onPress={() => void copyAndOpen("instagram")} style={s.shareAction}><Ionicons name="logo-instagram" size={21} color="#B55F8E"/><Text style={s.shareText}>Instagram</Text></Pressable><Pressable onPress={() => void email()} style={s.shareAction}><Ionicons name="mail" size={21} color="#4F79B1"/><Text style={s.shareText}>Email</Text></Pressable><Pressable onPress={saveImage} style={s.shareAction}><Ionicons name="download-outline" size={21} color="#4F79B1"/><Text style={s.shareText}>Save PNG</Text></Pressable></View>
  </View></View></Modal>;
}
function ReceiptQr({ label }: { label: string }) {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const row = Math.floor(index / 11); const col = index % 11;
    const finder = (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3);
    const dark = finder || ((row * 7 + col * 5 + row * col) % 4 === 0) || ((row + col) % 7 === 0);
    return <View key={index} style={[s.qrCell, dark && s.qrCellDark]}/>;
  });
  return <View style={s.qrBlock}><View style={s.qrGrid}>{cells}</View><View><Text style={s.qrTitle}>TRAVA RECEIPT</Text><Text style={s.qrSub}>{label} · VISUAL RECEIPT MARK</Text></View></View>;
}

function makeReceiptPng(name: string, contributors: ReceiptContributor[], total: number) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = Math.max(1250, 570 + contributors.length * 120); const ctx = canvas.getContext("2d"); if (!ctx) return "";
  ctx.fillStyle="#F3F5F9";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#272A30";roundRect(ctx,120,80,840,150,38);ctx.fill();ctx.fillStyle="#FFF";roundRect(ctx,170,140,740,canvas.height-230,22);ctx.fill();
  ctx.fillStyle="#14171C";ctx.textAlign="center";ctx.font="600 32px ui-monospace,SFMono-Regular,Menlo,monospace";ctx.fillText(`Trip Invoice — ${name}`,540,225);ctx.setLineDash([12,10]);ctx.strokeStyle="#2C3036";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(220,255);ctx.lineTo(860,255);ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign="left";ctx.font="500 28px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText("Total",220,325);ctx.textAlign="right";ctx.font="700 30px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(`₱${money(total)}`,860,325);ctx.textAlign="left";ctx.font="500 28px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText("Per Person",220,380);ctx.textAlign="right";ctx.fillText(`₱${money(total/Math.max(1,contributors.length))}`,860,380);ctx.textAlign="left";
  let y=455;for(const person of contributors){ctx.fillStyle="#E9EEF6";ctx.beginPath();ctx.arc(250,y,30,0,Math.PI*2);ctx.fill();ctx.fillStyle="#344056";ctx.textAlign="center";ctx.font="800 24px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(person.name.slice(0,1).toUpperCase(),250,y+8);ctx.textAlign="left";ctx.fillStyle="#171A20";ctx.font="650 28px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(person.name,305,y-3);ctx.fillStyle="#6E7787";ctx.font="550 21px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(`₱${money(person.amount)}`,305,y+30);ctx.fillStyle=person.paid?"#E5F8F1":"#FFF1E4";roundRect(ctx,700,y-28,150,50,18);ctx.fill();ctx.fillStyle=person.paid?"#2E8E6C":"#B57526";ctx.font="700 22px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(person.paid?"✓ Paid":"◷ Unpaid",730,y+4);ctx.strokeStyle="#E8EBF0";ctx.beginPath();ctx.moveTo(220,y+58);ctx.lineTo(860,y+58);ctx.stroke();y+=110;}
  y+=25;ctx.fillStyle="#171A20";ctx.font="800 28px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText("TOTAL AMOUNT",220,y);ctx.textAlign="right";ctx.font="900 36px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";ctx.fillText(`₱${money(total)}`,860,y);ctx.textAlign="left";return canvas.toDataURL("image/png",.96);
}
function roundRect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function downloadDataUrl(filename:string,dataUrl:string){const a=document.createElement("a");a.href=dataUrl;a.download=filename;a.click();}
function safeName(value:string){return value.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"Trip";}

function ManageSharedModal({ visible, expenses, onClose, onEdit, onDelete }: { visible: boolean; expenses: LocalExpense[]; onClose(): void; onEdit(e: LocalExpense): void; onDelete(e: LocalExpense): void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal, s.manageModal]}><View style={s.modalHeader}><View><Text style={s.modalTitle}>Shared expenses</Text><Text style={s.modalSub}>Every saved shared expense is listed here.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><ScrollView style={s.manageList}>{expenses.map((e) => <View key={`manage-${e.id}`} style={s.manageRow}><ExpenseMiniIcon category={e.category}/><View style={s.manageCopy}><Text style={s.manageTitle}>{e.title}</Text><Text style={s.manageMeta}>{e.category} · ₱{money(e.amount)}</Text></View><Pressable onPress={() => onEdit(e)} style={s.iconButton}><Ionicons name="create-outline" size={18} color="#597DAE"/></Pressable><Pressable onPress={() => onDelete(e)} style={s.iconButton}><Ionicons name="trash-outline" size={18} color="#D5687C"/></Pressable></View>)}</ScrollView></View></View></Modal>;
}
function ExpenseMiniIcon({ category }: { category: string }) { return <View style={s.manageIcon}><PremiumCategoryIcon category={category} size={34}/></View>; }

function ExpenseModal({ value, onClose, onSave, onDelete }: { value: LocalExpense | null | "new"; onClose(): void; onSave(v: Omit<LocalExpense, "id">): void; onDelete?: () => void }) {
  const current = value && value !== "new" ? value : null; const [title,setTitle]=useState(current?.title??""); const [amount,setAmount]=useState(String(current?.amount??"")); const [category,setCategory]=useState(current?.category??CATEGORIES[0]); const [paid,setPaid]=useState(current?.paid!==false); const [selectOpen,setSelectOpen]=useState(false); const [error,setError]=useState<string|null>(null); if(!value)return null;
  function save(){const numeric=Number(amount);if(title.trim().length<2||!Number.isFinite(numeric)||numeric<=0){setError("Add a clear title and a valid amount greater than zero.");return;}onSave({title:title.trim(),amount:numeric,category,date:current?.date??"Today",shared:true,paid});}
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHeader}><View><Text style={s.modalTitle}>{current?"Edit shared expense":"Add shared expense"}</Text><Text style={s.modalSub}>This update syncs live to collaborators who have the trip open.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><Text style={s.label}>Expense name</Text><TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Dinner, hotel, taxi…" placeholderTextColor="#98A3B6"/><Text style={s.label}>Amount</Text><View style={s.moneyInput}><Text style={s.currency}>₱</Text><TextInput style={s.moneyField} value={amount} onChangeText={(text)=>setAmount(cleanMoney(text))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#98A3B6"/></View><Text style={s.label}>Category</Text><Pressable onPress={()=>setSelectOpen(v=>!v)} style={s.select}><Text style={s.selectText}>{category}</Text><Ionicons name={selectOpen?"chevron-up":"chevron-down"} size={17} color="#72809A"/></Pressable>{selectOpen?<View style={s.selectMenu}>{CATEGORIES.map(c=><Pressable key={c} onPress={()=>{setCategory(c);setSelectOpen(false);}} style={[s.selectOption,c===category&&s.selectOptionOn]}><Text style={s.selectOptionText}>{c}</Text>{c===category?<Ionicons name="checkmark" size={16} color="#5D86BE"/>:null}</Pressable>)}</View>:null}<Pressable onPress={()=>setPaid(v=>!v)} style={s.paidToggle}><View style={[s.checkbox,paid&&s.checkboxOn]}>{paid?<Ionicons name="checkmark" size={15} color="#FFF"/>:null}</View><View><Text style={s.paidToggleTitle}>Mark as paid</Text><Text style={s.paidToggleSub}>Turn off if the expense still needs settlement.</Text></View></Pressable>{error?<Text style={s.error}>{error}</Text>:null}<View style={s.modalBtns}>{onDelete?<Pressable onPress={onDelete} style={s.delete}><Ionicons name="trash-outline" size={17} color="#D75E76"/><Text style={s.deleteText}>Delete</Text></Pressable>:null}<Pressable onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable onPress={save} style={s.savePress}><LinearGradient colors={["#6EA9E7","#9EA6EC","#EA8EB7"]} style={s.save}><Text style={s.saveText}>Save expense</Text></LinearGradient></Pressable></View></View></View></Modal>;
}
function cleanMoney(value:string){const cleaned=value.replace(/[^0-9.]/g,"");const[whole,...rest]=cleaned.split(".");return rest.length?`${whole}.${rest.join("").slice(0,2)}`:whole;}function money(value:number){return Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:22,paddingBottom:130},max:{width:"100%",maxWidth:640,alignSelf:"center",gap:16},summaryRow:{flexDirection:"row",gap:14},summary:{flex:1,height:278,borderRadius:28,overflow:"hidden",padding:22,borderWidth:1,borderColor:"#E4EBF4",boxShadow:"0 15px 34px rgba(85,98,129,.10)"},sumLabel:{fontSize:16,fontWeight:"800"},sumValue:{marginTop:13,color:PX.ink,fontSize:29,fontWeight:"900",letterSpacing:-.7},sumSub:{marginTop:8,color:"#66749A",fontSize:12,fontWeight:"600"},sumAsset:{position:"absolute",width:180,height:150,right:-5,bottom:8},
  sharedCard:{borderRadius:28,padding:20},sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},sectionTitleWrap:{flexDirection:"row",alignItems:"center",gap:10},peopleCircle:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#E7F2FF"},sectionTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},sectionSub:{marginTop:2,color:PX.muted,fontSize:9,fontWeight:"600"},addButton:{minHeight:40,paddingHorizontal:12,borderRadius:16,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#EAF4FF"},addLink:{color:"#507BB4",fontSize:10,fontWeight:"900"},sharedList:{marginTop:14,gap:8},moreShared:{marginTop:8,textAlign:"center",color:PX.muted,fontSize:9,fontWeight:"700"},sharedExpense:{minHeight:100,borderRadius:22,padding:13,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:"#E8EDF5"},expenseVisual:{width:54,height:54,alignItems:"center",justifyContent:"center"},dinnerCopy:{flex:1},dinnerTitle:{color:PX.ink,fontSize:14,fontWeight:"900"},paidBy:{marginTop:4,color:"#617092",fontSize:9,fontWeight:"600"},avatars:{marginTop:10,flexDirection:"row",alignItems:"center"},avatarCircle:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#DDEEFF",borderWidth:2,borderColor:"#FFF",marginRight:-5},avatarTwo:{backgroundColor:"#E9E6FF"},avatarThree:{backgroundColor:"#FFE4F0"},avatarText:{color:"#4A6080",fontSize:9,fontWeight:"900"},plusTwo:{width:30,height:30,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E3E8F0",marginLeft:2},plusTwoText:{color:"#566284",fontSize:9,fontWeight:"900"},costBox:{alignItems:"flex-start"},costLabel:{color:"#66749A",fontSize:9,fontWeight:"600"},costValue:{marginTop:4,color:PX.ink,fontSize:17,fontWeight:"900"},paidPill:{marginTop:10,paddingHorizontal:10,paddingVertical:6,borderRadius:16,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#E8F8F1"},paidText:{color:"#3A9470",fontSize:9,fontWeight:"900"},cardEdit:{width:38,height:38,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.82)"},manageButton:{paddingTop:18,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4},manage:{color:"#5A82BB",fontSize:11,fontWeight:"900"},empty:{marginTop:14,minHeight:130,alignItems:"center",justifyContent:"center",padding:18,borderRadius:22,backgroundColor:"#F7FAFE"},emptyTitle:{marginTop:7,color:PX.ink,fontSize:12,fontWeight:"900"},emptySub:{marginTop:4,color:PX.muted,fontSize:9,fontWeight:"600",textAlign:"center"},
  invoiceOuter:{borderRadius:28,padding:18,borderWidth:1,borderColor:"#E8EEF7",boxShadow:"0 15px 34px rgba(86,101,132,.09)"},invoiceHead:{minHeight:72,flexDirection:"row",justifyContent:"space-between"},invoiceTitleRow:{flexDirection:"row",alignItems:"center",gap:7},invoiceTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},invoiceSub:{marginTop:5,color:"#657294",fontSize:10,fontWeight:"600"},gift:{position:"absolute",right:-4,top:-18,width:120,height:100},invoiceInner:{marginTop:8,padding:20,borderRadius:24,backgroundColor:"rgba(255,255,255,.88)",borderWidth:1,borderColor:"#E9EDF4"},tripInvoice:{color:PX.ink,fontSize:18,fontWeight:"900"},invoiceMetrics:{marginTop:22,flexDirection:"row",gap:70},invoiceValue:{marginTop:5,color:PX.ink,fontSize:20,fontWeight:"900"},invoiceAvatars:{marginTop:22,paddingTop:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"#DADDE7",flexDirection:"row",alignItems:"center"},peopleText:{marginLeft:14,color:"#637092",fontSize:10,fontWeight:"700"},invoiceBtns:{marginTop:18,flexDirection:"row",gap:10},invoiceBtn:{flex:1,minHeight:54,borderRadius:27,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7,backgroundColor:"rgba(255,255,255,.92)",borderWidth:1,borderColor:"#DADDE3",boxShadow:"0 8px 18px rgba(30,35,46,.08)"},invoiceBtnPrimary:{backgroundColor:"#20242B",borderColor:"#20242B"},invoiceBtnText:{color:"#20242B",fontSize:10,fontWeight:"900"},invoiceBtnTextPrimary:{color:"#FFFFFF"},pressed:{opacity:.7},
  backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:22,backgroundColor:"rgba(11,17,36,.42)"},modal:{width:"100%",maxWidth:450,maxHeight:"90%",padding:20,borderRadius:26,backgroundColor:"#FFF"},manageModal:{maxWidth:520},receiptModal:{maxWidth:560},modalHeader:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},modalTitle:{color:PX.ink,fontSize:19,fontWeight:"900"},modalSub:{marginTop:4,color:PX.muted,fontSize:9,lineHeight:14,fontWeight:"600"},close:{width:36,height:36,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F7FA"},label:{marginTop:13,marginBottom:6,color:"#526079",fontSize:9,fontWeight:"900"},input:{minHeight:49,paddingHorizontal:14,borderRadius:15,backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E8ECF3",color:PX.ink,fontSize:11,fontWeight:"700"},moneyInput:{height:50,borderRadius:15,flexDirection:"row",alignItems:"center",backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E8ECF3"},currency:{marginLeft:14,color:"#63789A",fontSize:14,fontWeight:"900"},moneyField:{flex:1,height:"100%",paddingHorizontal:10,color:PX.ink,fontSize:12,fontWeight:"800"},select:{height:49,paddingHorizontal:13,borderRadius:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#F6F8FC",borderWidth:1,borderColor:"#E8ECF3"},selectText:{color:PX.ink,fontSize:11,fontWeight:"800"},selectMenu:{marginTop:6,overflow:"hidden",borderRadius:15,borderWidth:1,borderColor:"#E6EBF2",backgroundColor:"#FFF"},selectOption:{minHeight:39,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},selectOptionOn:{backgroundColor:"#EFF7FF"},selectOptionText:{color:"#56657D",fontSize:10,fontWeight:"700"},paidToggle:{marginTop:13,padding:11,borderRadius:15,flexDirection:"row",gap:9,alignItems:"center",backgroundColor:"#F8FAFD"},checkbox:{width:24,height:24,borderRadius:8,alignItems:"center",justifyContent:"center",borderWidth:1.5,borderColor:"#B7C3D3"},checkboxOn:{borderColor:"#6699D5",backgroundColor:"#6699D5"},paidToggleTitle:{color:PX.ink,fontSize:10,fontWeight:"900"},paidToggleSub:{marginTop:2,color:PX.muted,fontSize:8,fontWeight:"600"},error:{marginTop:9,color:"#C46172",fontSize:9,fontWeight:"700"},modalBtns:{marginTop:16,flexDirection:"row",gap:8},delete:{height:46,paddingHorizontal:13,borderRadius:14,flexDirection:"row",gap:5,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0F3"},deleteText:{color:"#D75E76",fontWeight:"900",fontSize:9},cancel:{flex:1,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EEF0F5"},cancelText:{color:PX.muted,fontWeight:"900",fontSize:9},savePress:{flex:1.6},save:{height:46,borderRadius:14,alignItems:"center",justifyContent:"center"},saveText:{color:"#FFF",fontWeight:"900",fontSize:9},manageList:{marginTop:12},manageRow:{minHeight:66,flexDirection:"row",alignItems:"center",gap:9,borderBottomWidth:1,borderBottomColor:"#EEF1F5"},manageIcon:{width:40,height:40,borderRadius:13,alignItems:"center",justifyContent:"center"},manageCopy:{flex:1,minWidth:0},manageTitle:{color:PX.ink,fontSize:11,fontWeight:"900"},manageMeta:{marginTop:3,color:PX.muted,fontSize:8,fontWeight:"600"},iconButton:{width:34,height:34,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#F7F9FC"},
  receiptCanvas:{marginTop:14,paddingTop:24,borderRadius:22,backgroundColor:"#F3F5F9",overflow:"hidden",alignItems:"center"},printerTop:{width:"86%",height:84,borderRadius:24,backgroundColor:"#282B30",boxShadow:"0 12px 24px rgba(0,0,0,.16)"},receiptPaper:{width:"78%",marginTop:-48,marginBottom:24,paddingHorizontal:18,paddingTop:22,paddingBottom:18,backgroundColor:"#FFF",boxShadow:"0 14px 32px rgba(28,34,47,.14)"},receiptTrip:{color:"#1C2026",fontSize:13,fontWeight:"700",fontFamily:Platform.OS==="ios"?"Menlo":undefined,textAlign:"center"},receiptDash:{marginTop:10,borderTopWidth:1,borderStyle:"dashed",borderColor:"#51545A"},receiptSummary:{minHeight:42,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},receiptSummaryLabel:{color:"#4E5663",fontSize:10,fontWeight:"600"},receiptSummaryValue:{color:"#171A20",fontSize:12,fontWeight:"800"},receiptRule:{height:1,backgroundColor:"#E4E7EC",marginVertical:8},contributorRow:{minHeight:60,flexDirection:"row",alignItems:"center",gap:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#E8EBF0"},contributorAvatar:{width:36,height:36,borderRadius:18,overflow:"hidden",alignItems:"center",justifyContent:"center",backgroundColor:"#EAF0F8"},contributorInitial:{color:"#43516A",fontSize:11,fontWeight:"900"},contributorCopy:{flex:1,minWidth:0},contributorName:{color:"#1B1E24",fontSize:10,fontWeight:"800"},contributorAmount:{marginTop:2,color:"#737C8B",fontSize:8,fontWeight:"650"},statusPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:10,flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#EDF9F4",borderWidth:1,borderColor:"#D8F1E7"},statusPillUnpaid:{backgroundColor:"#FFF4E8",borderColor:"#F6E0C6"},statusText:{color:"#328D6B",fontSize:8,fontWeight:"800"},statusTextUnpaid:{color:"#B57526"},receiptTotalRow:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},receiptTotalLabel:{color:"#1B1E24",fontSize:10,fontWeight:"900"},receiptTotal:{color:"#111419",fontSize:16,fontWeight:"900"},paymentStatus:{marginTop:8,minHeight:48,paddingHorizontal:12,borderRadius:13,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#F7F8FA",borderWidth:1,borderColor:"#E5E8ED"},paymentStatusLabel:{color:"#505866",fontSize:9,fontWeight:"700"},paymentStatusValue:{color:"#171A20",fontSize:12,fontWeight:"900"},shareGrid:{marginTop:16,padding:8,borderRadius:30,flexDirection:"row",flexWrap:"wrap",justifyContent:"center",gap:8,backgroundColor:"rgba(246,246,247,.92)",borderWidth:1,borderColor:"#E1E2E5",boxShadow:"0 10px 24px rgba(31,35,43,.08)"},shareAction:{minWidth:94,minHeight:48,paddingHorizontal:13,borderRadius:24,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E0E1E4",boxShadow:"0 5px 12px rgba(31,35,43,.05)"},shareText:{color:"#252A32",fontSize:9,fontWeight:"900"},qrBlock:{width:"78%",marginTop:-6,marginBottom:20,padding:12,borderRadius:18,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"rgba(255,255,255,.92)",borderWidth:1,borderColor:"#E0E3E8"},qrGrid:{width:88,height:88,flexDirection:"row",flexWrap:"wrap",alignContent:"flex-start",padding:4,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#D8DCE3"},qrCell:{width:7,height:7,backgroundColor:"#FFFFFF"},qrCellDark:{backgroundColor:"#171A20"},qrTitle:{color:"#171A20",fontSize:10,fontWeight:"900",letterSpacing:.5},qrSub:{marginTop:4,maxWidth:160,color:"#7A818E",fontSize:7,lineHeight:10,fontWeight:"700"},
});
