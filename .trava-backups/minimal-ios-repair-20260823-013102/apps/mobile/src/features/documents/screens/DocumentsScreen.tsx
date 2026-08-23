import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Glass, PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalDocument } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";

const TYPES = ["Identity", "Flight", "Hotel", "Insurance", "Document"] as const;
const TYPE_META: Record<string, { icon: TravaIconName; bg: string; fg: string }> = {
  Identity: { icon: "person-circle-outline", bg: "#E9EEFF", fg: "#626BC4" },
  Flight: { icon: "airplane", bg: "#E3F2FF", fg: "#3E88C9" },
  Hotel: { icon: "bed", bg: "#FFF0E5", fg: "#C87942" },
  Insurance: { icon: "shield-checkmark", bg: "#E7F8F1", fg: "#3F9B7A" },
  Document: { icon: "document-text", bg: "#EAF0F6", fg: "#536C89" },
};

export function DocumentsScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, addDocument, updateDocument, deleteDocument } = useLocalTripWorkspace(tripId);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<LocalDocument | null>(null);

  async function removeDocument(doc: LocalDocument) {
    try { await deleteStoredDocument(doc); } catch { /* metadata still removable */ }
    deleteDocument(doc.id);
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Trip"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <LinearGradient colors={["#EEF7FF", "#F5F3FF", "#FFF3F8"]} style={s.hero}>
        <View><Text style={s.heroEyebrow}>TRIP DOCUMENTS</Text><Text style={s.heroTitle}>Keep tickets and files together.</Text><Text style={s.heroSub}>{state.documents.length ? `${state.documents.length} file${state.documents.length === 1 ? "" : "s"} stored on this device.` : "Upload a passport copy, ticket, hotel booking or insurance file."}</Text></View>
        <View style={s.folder}><Ionicons name="folder-open" size={62} color="#7198CB"/><Ionicons name="sparkles" size={22} color="#D988AE" style={s.folderStar}/></View>
      </LinearGradient>

      <View style={s.topRow}><View><Text style={s.sectionTitle}>Files</Text><Text style={s.sectionSub}>Tap any uploaded file to open or share it</Text></View><Pressable onPress={() => setOpen(true)} style={s.addPress}><LinearGradient colors={["#75AFE9", "#A8B1ED", "#EC9DBF"]} style={s.add}><Ionicons name="cloud-upload" size={17} color="#FFFFFF"/><Text style={s.addText}>Upload</Text></LinearGradient></Pressable></View>

      <View style={s.grid}>{state.documents.map((doc) => { const meta = TYPE_META[doc.type] ?? TYPE_META.Document; const attached = Boolean(doc.blobKey || doc.uri || doc.dataUrl); return <Glass key={`doc-${doc.id}`} style={s.card}>
        <View style={[s.icon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={26} color={meta.fg}/></View>
        <Pressable onPress={() => void openDocument(doc)} style={s.copy}><Text style={s.title}>{doc.title}</Text><Text style={s.meta}>{doc.type} · {doc.size}</Text><View style={s.fileState}><Ionicons name={attached ? "checkmark-circle" : "alert-circle"} size={13} color={attached ? "#46A07D" : "#C78165"}/><Text style={[s.updated, !attached && s.missing]}>{attached ? "Stored locally · tap to open" : "File missing · upload again"}</Text></View></Pressable>
        <Pressable accessibilityLabel={`Options for ${doc.title}`} onPress={() => setActive(doc)} style={s.more}><Ionicons name="ellipsis-horizontal" size={20} color="#53657F"/></Pressable>
      </Glass>; })}</View>
      {!state.documents.length ? <View style={s.empty}><View style={s.emptyIcon}><Ionicons name="document-attach" size={30} color="#5C88BE"/></View><Text style={s.emptyTitle}>No files yet</Text><Text style={s.emptySub}>Upload the actual file — not just its name — and TRAVA will keep a local copy.</Text><Pressable onPress={() => setOpen(true)} style={s.emptyButton}><Text style={s.emptyButtonText}>Choose a file</Text></Pressable></View> : null}
    </View></ScrollView>

    <AddDoc key={open ? "add-doc-open" : "add-doc-idle"} tripId={tripId} visible={open} onClose={() => setOpen(false)} onAdd={(doc) => { addDocument(doc); setOpen(false); }}/>
    <DocumentActions key={`doc-actions-${active?.id ?? "idle"}`} document={active} onClose={() => setActive(null)} onRename={(title, type) => { if (active) updateDocument(active.id, { title, type }); setActive(null); }} onDelete={() => { if (!active) return; const doc = active; setActive(null); Alert.alert("Delete file?", `${doc.title} will be removed from this device.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void removeDocument(doc) }]); }}/>
  </ScreenShell></SafeAreaView>;
}

function AddDoc({ tripId, visible, onClose, onAdd }: { tripId: string; visible: boolean; onClose(): void; onAdd(doc: Omit<LocalDocument, "id" | "updated">): void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("Document");
  const [size, setSize] = useState("Local");
  const [typeOpen, setTypeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  async function chooseFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSelected(asset); setTitle(asset.name || "Travel document"); setSize(formatBytes(asset.size));
      const lower = (asset.name || "").toLowerCase();
      if (lower.includes("passport") || lower.includes("visa")) setType("Identity");
      else if (lower.includes("flight") || lower.includes("ticket") || lower.includes("boarding")) setType("Flight");
      else if (lower.includes("hotel") || lower.includes("booking")) setType("Hotel");
      else if (lower.includes("insurance")) setType("Insurance");
    } catch { Alert.alert("Upload document", "The file picker could not be opened."); }
  }

  async function save() {
    if (!selected) { Alert.alert("Choose a file", "Select the actual document you want to store."); return; }
    setSaving(true);
    try {
      let uri: string | null = null; let dataUrl: string | null = null; let blobKey: string | null = null;
      if (Platform.OS === "web") {
        const webFile = (selected as unknown as { file?: File }).file;
        if (webFile) blobKey = await putWebFile(webFile, tripId);
        else if (selected.uri?.startsWith("data:")) dataUrl = selected.uri;
        else throw new Error("Browser did not provide the selected file bytes.");
      } else {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("TRAVA cannot access its document directory on this device.");
        const dir = `${base}trava-documents/${safeName(tripId)}/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const destination = `${dir}${Date.now()}-${safeName(selected.name || "document")}`;
        await FileSystem.copyAsync({ from: selected.uri, to: destination });
        uri = destination;
      }
      onAdd({ title: title.trim() || selected.name || "Travel document", type, size, mimeType: selected.mimeType || null, uri, dataUrl, blobKey });
    } catch (error) { Alert.alert("Save document", error instanceof Error ? error.message : "The file could not be stored."); }
    finally { setSaving(false); }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>Upload a document</Text><Text style={s.modalSub}>TRAVA stores a real local copy so you can reopen it later.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View>
    <Pressable onPress={() => void chooseFile()} style={[s.chooseFile, selected && s.chooseFileReady]}><View style={s.chooseIcon}><Ionicons name={selected ? "document-text" : "document-attach"} size={23} color="#4F83BB"/></View><View style={s.chooseCopy}><Text style={s.chooseTitle}>{selected ? selected.name : "Choose PDF, image or ticket"}</Text><Text style={s.chooseSub}>{selected ? `${formatBytes(selected.size)} · ready to store` : "Browse files on this device"}</Text></View><Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} size={20} color={selected ? "#48A17F" : "#7688A2"}/></Pressable>
    {selected ? <><Text style={s.label}>Display name</Text><TextInput style={s.input} value={title} onChangeText={setTitle}/><Text style={s.label}>Type</Text><Pressable onPress={() => setTypeOpen((v) => !v)} style={s.select}><Text style={s.selectText}>{type}</Text><Ionicons name={typeOpen ? "chevron-up" : "chevron-down"} size={17} color="#72809A"/></Pressable>{typeOpen ? <View style={s.selectMenu}>{TYPES.map((item) => <Pressable key={`doctype-${item}`} onPress={() => { setType(item); setTypeOpen(false); }} style={[s.selectOption, item === type && s.selectOptionOn]}><Text style={s.selectOptionText}>{item}</Text>{item === type ? <Ionicons name="checkmark" size={16} color="#5F8AC2"/> : null}</Pressable>)}</View> : null}</> : null}
    <View style={s.modalBtns}><Pressable disabled={saving} onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving || !selected} onPress={() => void save()} style={[s.savePress, !selected && s.disabled]}><LinearGradient colors={["#75AFE9", "#A8B1ED", "#EC9DBF"]} style={s.save}>{saving ? <ActivityIndicatorShim/> : <><Ionicons name="cloud-upload" size={16} color="#FFF"/><Text style={s.saveText}>Store file</Text></>}</LinearGradient></Pressable></View>
  </View></View></Modal>;
}

function ActivityIndicatorShim() { return <Text style={s.saveText}>Saving…</Text>; }
function DocumentActions({ document, onClose, onRename, onDelete }: { document: LocalDocument | null; onClose(): void; onRename(title: string, type: string): void; onDelete(): void }) {
  const [title, setTitle] = useState(document?.title ?? ""); const [type, setType] = useState(document?.type ?? "Document"); if (!document) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>File options</Text><Text style={s.modalSub}>{document.size} · stored locally</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#65748E"/></Pressable></View><Text style={s.label}>Name</Text><TextInput style={s.input} value={title} onChangeText={setTitle}/><Text style={s.label}>Type</Text><View style={s.typeChips}>{TYPES.map((item) => <Pressable key={`action-type-${item}`} onPress={() => setType(item)} style={[s.typeChip, type === item && s.typeChipOn]}><Text style={[s.typeChipText, type === item && s.typeChipTextOn]}>{item}</Text></Pressable>)}</View><View style={s.modalBtns}><Pressable onPress={() => void openDocument(document)} style={s.openBtn}><Ionicons name="open" size={17} color="#4F7FB8"/><Text style={s.openText}>Open</Text></Pressable><Pressable onPress={onDelete} style={s.delete}><Ionicons name="trash" size={17} color="#C95E73"/></Pressable><Pressable onPress={() => onRename(title.trim() || document.title, type)} style={s.savePress}><LinearGradient colors={["#75AFE9", "#A8B1ED", "#EC9DBF"]} style={s.save}><Text style={s.saveText}>Save</Text></LinearGradient></Pressable></View></View></View></Modal>;
}

async function openDocument(doc: LocalDocument) {
  try {
    if (Platform.OS === "web") {
      let target = doc.dataUrl || null;
      let revoke: string | null = null;
      if (!target && doc.blobKey) { const blob = await getWebFile(doc.blobKey); if (blob) { target = URL.createObjectURL(blob); revoke = target; } }
      if (!target && doc.uri) target = doc.uri;
      if (!target) throw new Error("The local file is missing. Upload it again.");
      window.open(target, "_blank", "noopener,noreferrer");
      if (revoke) window.setTimeout(() => URL.revokeObjectURL(revoke as string), 60_000);
      return;
    }
    if (!doc.uri) throw new Error("The local file is missing. Upload it again.");
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(doc.uri, { mimeType: doc.mimeType || undefined, dialogTitle: doc.title });
    else throw new Error("No file viewer or share service is available on this device.");
  } catch (error) { Alert.alert("Open document", error instanceof Error ? error.message : "This file could not be opened."); }
}
async function deleteStoredDocument(doc: LocalDocument) {
  if (Platform.OS === "web") { if (doc.blobKey) await deleteWebFile(doc.blobKey); return; }
  if (doc.uri && doc.uri.startsWith(FileSystem.documentDirectory || "file://never")) await FileSystem.deleteAsync(doc.uri, { idempotent: true });
}

const DB_NAME = "trava-local-files"; const STORE = "documents";
function openWebDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function putWebFile(file: File, tripId: string) { const db = await openWebDb(); const key = `${safeName(tripId)}-${Date.now()}-${Math.random().toString(36).slice(2)}`; await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(file, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close(); return key; }
async function getWebFile(key: string): Promise<Blob | null> { const db = await openWebDb(); const result = await new Promise<Blob | null>((resolve, reject) => { const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key); request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null); request.onerror = () => reject(request.error); }); db.close(); return result; }
async function deleteWebFile(key: string) { const db = await openWebDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close(); }
function safeName(value: string) { return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "file"; }
function formatBytes(value: number | undefined | null) { if (!value || value <= 0) return "Local"; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:22,paddingBottom:130},max:{width:"100%",maxWidth:640,alignSelf:"center",gap:18},hero:{height:190,borderRadius:29,padding:25,justifyContent:"center",overflow:"hidden",borderWidth:1,borderColor:"#E5EDF6",boxShadow:"0 16px 38px rgba(78,93,126,.09)"},heroEyebrow:{color:"#557FB5",fontSize:9,fontWeight:"900",letterSpacing:1.1},heroTitle:{marginTop:9,maxWidth:390,color:PX.ink,fontSize:25,lineHeight:31,fontWeight:"900"},heroSub:{marginTop:8,maxWidth:380,color:"#647391",fontSize:10,lineHeight:15,fontWeight:"600"},folder:{position:"absolute",right:25,bottom:22,width:118,height:102,borderRadius:30,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.72)"},folderStar:{position:"absolute",right:12,top:9},topRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},sectionTitle:{color:PX.ink,fontSize:21,fontWeight:"900"},sectionSub:{marginTop:3,color:PX.muted,fontSize:9,fontWeight:"600"},addPress:{borderRadius:16},add:{height:44,paddingHorizontal:14,borderRadius:16,flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center"},addText:{color:"#FFF",fontSize:10,fontWeight:"900"},grid:{gap:9},card:{minHeight:86,borderRadius:22,padding:12,flexDirection:"row",alignItems:"center",gap:12},icon:{width:56,height:56,borderRadius:18,alignItems:"center",justifyContent:"center"},copy:{flex:1,minWidth:0},title:{color:PX.ink,fontSize:13,fontWeight:"900"},meta:{marginTop:4,color:"#60708D",fontSize:9,fontWeight:"700"},fileState:{marginTop:5,flexDirection:"row",alignItems:"center",gap:4},updated:{color:"#5C8877",fontSize:8,fontWeight:"700"},missing:{color:"#A87561"},more:{width:40,height:40,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F7FA"},empty:{minHeight:220,borderRadius:28,alignItems:"center",justifyContent:"center",padding:26,backgroundColor:"#F8FBFF",borderWidth:1,borderColor:"#E3EDF7"},emptyIcon:{width:62,height:62,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#E7F2FF"},emptyTitle:{marginTop:12,color:PX.ink,fontSize:16,fontWeight:"900"},emptySub:{marginTop:5,maxWidth:330,textAlign:"center",color:PX.muted,fontSize:9,lineHeight:15,fontWeight:"600"},emptyButton:{marginTop:13,paddingHorizontal:16,paddingVertical:10,borderRadius:15,backgroundColor:"#E6F2FF"},emptyButtonText:{color:"#4F7FB8",fontSize:9,fontWeight:"900"},
  backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:22,backgroundColor:"rgba(12,17,34,.42)"},modal:{width:"100%",maxWidth:460,maxHeight:"88%",padding:20,borderRadius:26,backgroundColor:"#FFF"},modalHead:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},modalTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},modalSub:{marginTop:4,color:PX.muted,fontSize:9,lineHeight:14,fontWeight:"600"},close:{width:36,height:36,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F7FA"},chooseFile:{marginTop:15,minHeight:74,padding:11,borderRadius:19,flexDirection:"row",gap:11,alignItems:"center",backgroundColor:"#F3F8FE",borderWidth:1,borderColor:"#DCE8F5"},chooseFileReady:{backgroundColor:"#F0FAF6",borderColor:"#D0EDE1"},chooseIcon:{width:46,height:46,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"#E4F1FF"},chooseCopy:{flex:1},chooseTitle:{color:PX.ink,fontSize:11,fontWeight:"900"},chooseSub:{marginTop:3,color:PX.muted,fontSize:8,fontWeight:"600"},label:{marginTop:13,marginBottom:6,color:"#526079",fontSize:9,fontWeight:"900"},input:{height:49,paddingHorizontal:14,borderRadius:15,backgroundColor:"#F5F7FA",borderWidth:1,borderColor:"#E8ECF2",color:PX.ink,fontSize:11,fontWeight:"700"},select:{height:49,paddingHorizontal:14,borderRadius:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#F5F7FA",borderWidth:1,borderColor:"#E8ECF2"},selectText:{color:PX.ink,fontSize:10,fontWeight:"800"},selectMenu:{marginTop:6,overflow:"hidden",borderRadius:15,borderWidth:1,borderColor:"#E6EBF2",backgroundColor:"#FFF"},selectOption:{minHeight:39,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},selectOptionOn:{backgroundColor:"#EFF7FF"},selectOptionText:{color:"#56657D",fontSize:10,fontWeight:"700"},typeChips:{flexDirection:"row",flexWrap:"wrap",gap:7},typeChip:{paddingHorizontal:10,paddingVertical:8,borderRadius:14,backgroundColor:"#F5F7FA",borderWidth:1,borderColor:"#E8ECF2"},typeChipOn:{backgroundColor:"#EAF4FF",borderColor:"#BED5EF"},typeChipText:{color:"#707C91",fontSize:9,fontWeight:"800"},typeChipTextOn:{color:"#4E78AD"},modalBtns:{marginTop:16,flexDirection:"row",gap:8},openBtn:{height:46,paddingHorizontal:12,borderRadius:14,flexDirection:"row",gap:5,alignItems:"center",justifyContent:"center",backgroundColor:"#EAF4FF"},openText:{color:"#4F7FB8",fontSize:9,fontWeight:"900"},delete:{width:46,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0F3"},cancel:{flex:1,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EEF0F5"},cancelText:{color:PX.muted,fontWeight:"900",fontSize:9},savePress:{flex:1.5},save:{height:46,borderRadius:14,flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center"},saveText:{color:"#FFF",fontWeight:"900",fontSize:9},disabled:{opacity:.5},
});
