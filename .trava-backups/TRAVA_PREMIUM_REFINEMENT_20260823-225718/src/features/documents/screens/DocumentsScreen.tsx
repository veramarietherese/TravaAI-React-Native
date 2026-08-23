import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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
const TYPE_META: Record<string, { icon: TravaIconName }> = {
  Identity: { icon: "person-circle-outline" },
  Flight: { icon: "airplane" },
  Hotel: { icon: "bed" },
  Insurance: { icon: "shield-checkmark" },
  Document: { icon: "document-text" },
};

export function DocumentsScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, addDocument, updateDocument, deleteDocument } = useLocalTripWorkspace(tripId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceDoc, setReplaceDoc] = useState<LocalDocument | null>(null);
  const [active, setActive] = useState<LocalDocument | null>(null);

  async function removeDocument(doc: LocalDocument) {
    try { await deleteStoredDocument(doc); } catch { /* metadata may still be removed */ }
    deleteDocument(doc.id);
  }

  function startUpload(doc?: LocalDocument | null) {
    setReplaceDoc(doc ?? null);
    setPickerOpen(true);
  }

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Trip"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <View style={s.hero}>
        <View style={s.heroCopy}><Text style={s.heroEyebrow}>TRIP DOCUMENTS</Text><Text style={s.heroTitle}>Keep tickets and files together.</Text><Text style={s.heroSub}>{state.documents.length ? `${state.documents.length} document${state.documents.length === 1 ? "" : "s"} in this device vault.` : "Upload your passport copy, ticket, hotel booking or insurance file."}</Text></View>
        <View style={s.folder}><Ionicons name="folder-open" size={57} color="#30343A"/></View>
      </View>

      <View style={s.topRow}><View><Text style={s.sectionTitle}>Files</Text><Text style={s.sectionSub}>Open, replace, share or remove actual local files.</Text></View><Pressable accessibilityRole="button" onPress={() => startUpload()} style={({ pressed }) => [s.add, pressed && s.pressed]}><Ionicons name="cloud-upload-outline" size={17} color="#FFFFFF"/><Text style={s.addText}>Upload</Text></Pressable></View>

      <View style={s.grid}>{state.documents.map((doc) => { const meta = TYPE_META[doc.type] ?? TYPE_META.Document; const attached = Boolean(doc.blobKey || doc.uri || doc.dataUrl); return <Glass key={`doc-${doc.id}`} style={s.card}>
        <View style={s.icon}><Ionicons name={meta.icon} size={25} color="#34383E"/></View>
        <Pressable accessibilityRole="button" accessibilityLabel={attached ? `Open ${doc.title}` : `Replace missing file for ${doc.title}`} onPress={() => attached ? void openDocument(doc) : startUpload(doc)} style={s.copy}><Text style={s.title}>{doc.title}</Text><Text style={s.meta}>{doc.type} · {doc.size}</Text><View style={s.fileState}><Ionicons name={attached ? "checkmark-circle" : "alert-circle"} size={13} color={attached ? "#4F765F" : "#8A5B54"}/><Text style={[s.updated, !attached && s.missing]}>{attached ? "Stored locally · tap to open" : "File missing · tap to attach it again"}</Text></View></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${doc.title}`} onPress={() => setActive(doc)} style={s.more}><Ionicons name="ellipsis-horizontal" size={20} color="#555B64"/></Pressable>
      </Glass>; })}</View>
      {!state.documents.length ? <View style={s.empty}><View style={s.emptyIcon}><Ionicons name="document-attach-outline" size={31} color="#34383E"/></View><Text style={s.emptyTitle}>No documents yet</Text><Text style={s.emptySub}>Choose the actual file. TRAVA keeps a local copy so the file can be reopened later.</Text><Pressable onPress={() => startUpload()} style={s.emptyButton}><Text style={s.emptyButtonText}>Choose a file</Text></Pressable></View> : null}
    </View></ScrollView>

    <AddDoc key={`${pickerOpen}-${replaceDoc?.id ?? "new"}`} tripId={tripId} visible={pickerOpen} replace={replaceDoc} onClose={() => { setPickerOpen(false); setReplaceDoc(null); }} onSave={(doc) => { if (replaceDoc) updateDocument(replaceDoc.id, doc); else addDocument(doc); setPickerOpen(false); setReplaceDoc(null); }}/>
    <DocumentActions key={`doc-actions-${active?.id ?? "idle"}`} document={active} onClose={() => setActive(null)} onReplace={() => { const doc = active; setActive(null); startUpload(doc); }} onRename={(title, type) => { if (active) updateDocument(active.id, { title, type }); setActive(null); }} onDelete={() => { if (!active) return; const doc = active; setActive(null); Alert.alert("Delete document?", `${doc.title} will be removed from this device.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void removeDocument(doc) }]); }}/>
  </ScreenShell></SafeAreaView>;
}

function AddDoc({ tripId, visible, replace, onClose, onSave }: { tripId: string; visible: boolean; replace: LocalDocument | null; onClose(): void; onSave(doc: Omit<LocalDocument, "id" | "updated">): void }) {
  const [title, setTitle] = useState(replace?.title ?? "");
  const [type, setType] = useState<string>(replace?.type ?? "Document");
  const [size, setSize] = useState(replace?.size ?? "Local");
  const [typeOpen, setTypeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<DocumentPicker.DocumentPickerAsset | null>(null);


  async function chooseFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSelected(asset); setTitle(replace?.title || asset.name || "Travel document"); setSize(formatBytes(asset.size));
      if (!replace) {
        const lower = (asset.name || "").toLowerCase();
        if (lower.includes("passport") || lower.includes("visa")) setType("Identity");
        else if (lower.includes("flight") || lower.includes("ticket") || lower.includes("boarding")) setType("Flight");
        else if (lower.includes("hotel") || lower.includes("booking")) setType("Hotel");
        else if (lower.includes("insurance")) setType("Insurance");
      }
    } catch { Alert.alert("Upload document", "The file picker could not be opened."); }
  }

  async function save() {
    if (!selected) { Alert.alert("Choose a file", "Select the actual document you want to store."); return; }
    setSaving(true);
    try {
      let uri: string | null = null; let dataUrl: string | null = null; let blobKey: string | null = null;
      if (Platform.OS === "web") {
        const webFile = (selected as unknown as { file?: File }).file;
        if (webFile) blobKey = await putWebBlob(webFile, tripId);
        else if (selected.uri?.startsWith("data:")) dataUrl = selected.uri;
        else if (selected.uri) {
          const blob = await fetch(selected.uri).then((response) => { if (!response.ok) throw new Error("Browser could not read the selected file."); return response.blob(); });
          blobKey = await putWebBlob(blob, tripId);
        } else throw new Error("Browser did not provide the selected file bytes.");
      } else {
        const base = FileSystem.documentDirectory;
        if (!base) throw new Error("TRAVA cannot access its document directory on this device.");
        const dir = `${base}trava-documents/${safeName(tripId)}/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const destination = `${dir}${Date.now()}-${safeName(selected.name || "document")}`;
        await FileSystem.copyAsync({ from: selected.uri, to: destination });
        uri = destination;
      }
      if (replace) { try { await deleteStoredDocument(replace); } catch { /* replace can continue */ } }
      onSave({ title: title.trim() || selected.name || "Travel document", type, size, mimeType: selected.mimeType || null, uri, dataUrl, blobKey });
    } catch (error) { Alert.alert("Save document", error instanceof Error ? error.message : "The file could not be stored."); }
    finally { setSaving(false); }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><View style={{ flex: 1 }}><Text style={s.modalTitle}>{replace ? "Replace document" : "Upload a document"}</Text><Text style={s.modalSub}>The selected file is stored locally, not just its filename.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#5E646C"/></Pressable></View>
    <Pressable onPress={() => void chooseFile()} style={s.chooseFile}><View style={s.chooseIcon}><Ionicons name={selected ? "document-text-outline" : "document-attach-outline"} size={23} color="#33373D"/></View><View style={s.chooseCopy}><Text style={s.chooseTitle}>{selected ? selected.name : "Choose a PDF, image or ticket"}</Text><Text style={s.chooseSub}>{selected ? `${formatBytes(selected.size)} · ready to store` : "Browse files on this device"}</Text></View><Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} size={20} color={selected ? "#4F765F" : "#70767E"}/></Pressable>
    {selected ? <><Text style={s.label}>Display name</Text><TextInput style={s.input} value={title} onChangeText={setTitle}/><Text style={s.label}>Type</Text><Pressable onPress={() => setTypeOpen((v) => !v)} style={s.select}><Text style={s.selectText}>{type}</Text><Ionicons name={typeOpen ? "chevron-up" : "chevron-down"} size={17} color="#6C727A"/></Pressable>{typeOpen ? <View style={s.selectMenu}>{TYPES.map((item) => <Pressable key={`doctype-${item}`} onPress={() => { setType(item); setTypeOpen(false); }} style={[s.selectOption, item === type && s.selectOptionOn]}><Text style={s.selectOptionText}>{item}</Text>{item === type ? <Ionicons name="checkmark" size={16} color="#31343A"/> : null}</Pressable>)}</View> : null}</> : null}
    <View style={s.modalBtns}><Pressable disabled={saving} onPress={onClose} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving || !selected} onPress={() => void save()} style={[s.save, !selected && s.disabled]}>{saving ? <Text style={s.saveText}>Saving…</Text> : <><Ionicons name="archive-outline" size={16} color="#FFF"/><Text style={s.saveText}>{replace ? "Replace file" : "Store file"}</Text></>}</Pressable></View>
  </View></View></Modal>;
}

function DocumentActions({ document, onClose, onReplace, onRename, onDelete }: { document: LocalDocument | null; onClose(): void; onReplace(): void; onRename(title: string, type: string): void; onDelete(): void }) {
  const [title, setTitle] = useState(document?.title ?? ""); const [type, setType] = useState(document?.type ?? "Document"); if (!document) return null;
  const attached = Boolean(document.blobKey || document.uri || document.dataUrl);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}><View style={s.modalHead}><View><Text style={s.modalTitle}>Document options</Text><Text style={s.modalSub}>{document.size} · {attached ? "available locally" : "file needs to be attached again"}</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#5E646C"/></Pressable></View><Text style={s.label}>Name</Text><TextInput style={s.input} value={title} onChangeText={setTitle}/><Text style={s.label}>Type</Text><View style={s.typeChips}>{TYPES.map((item) => <Pressable key={`action-type-${item}`} onPress={() => setType(item)} style={[s.typeChip, type === item && s.typeChipOn]}><Text style={[s.typeChipText, type === item && s.typeChipTextOn]}>{item}</Text></Pressable>)}</View><View style={s.actionsStack}><Pressable onPress={() => attached ? void openDocument(document) : onReplace()} style={s.actionWide}><Ionicons name={attached ? "open-outline" : "refresh-outline"} size={18} color="#2D3136"/><Text style={s.actionWideText}>{attached ? "Open / share file" : "Attach file again"}</Text></Pressable><View style={s.modalBtns}><Pressable onPress={onDelete} style={s.delete}><Ionicons name="trash-outline" size={18} color="#7B3F3F"/></Pressable><Pressable onPress={() => onRename(title.trim() || document.title, type)} style={s.save}><Text style={s.saveText}>Save details</Text></Pressable></View></View></View></View></Modal>;
}

async function openDocument(doc: LocalDocument) {
  try {
    if (Platform.OS === "web") {
      let blob: Blob | null = null;
      if (doc.blobKey) blob = await getWebFile(doc.blobKey);
      if (!blob && doc.dataUrl) blob = await fetch(doc.dataUrl).then((r) => r.blob());
      if (!blob && doc.uri) blob = await fetch(doc.uri).then((r) => r.blob()).catch(() => null);
      if (!blob) throw new Error("The local file is missing. Attach it again.");
      const file = new File([blob], safeName(doc.title || "document"), { type: doc.mimeType || blob.type || "application/octet-stream" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], title: doc.title }); return; } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
      }
      const target = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a"); anchor.href = target; anchor.target = "_blank"; anchor.rel = "noopener"; anchor.download = safeName(doc.title || "document"); window.document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(target), 60_000); return;
    }
    if (!doc.uri) throw new Error("The local file is missing. Attach it again.");
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(doc.uri, { mimeType: doc.mimeType || undefined, dialogTitle: doc.title });
    else throw new Error("No file viewer or share service is available on this device.");
  } catch (error) { Alert.alert("Open document", error instanceof Error ? error.message : "This file could not be opened."); }
}
async function deleteStoredDocument(doc: LocalDocument) { if (Platform.OS === "web") { if (doc.blobKey) await deleteWebFile(doc.blobKey); return; } if (doc.uri && doc.uri.startsWith(FileSystem.documentDirectory || "file://never")) await FileSystem.deleteAsync(doc.uri, { idempotent: true }); }

const DB_NAME = "trava-local-files"; const STORE = "documents";
function openWebDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function putWebBlob(file: Blob, tripId: string) { const db = await openWebDb(); const key = `${safeName(tripId)}-${Date.now()}-${Math.random().toString(36).slice(2)}`; await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(file, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close(); return key; }
async function getWebFile(key: string): Promise<Blob | null> { const db = await openWebDb(); const result = await new Promise<Blob | null>((resolve, reject) => { const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key); request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null); request.onerror = () => reject(request.error); }); db.close(); return result; }
async function deleteWebFile(key: string) { const db = await openWebDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close(); }
function safeName(value: string) { return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "file"; }
function formatBytes(value: number | undefined | null) { if (!value || value <= 0) return "Local"; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFF"},scroll:{padding:22,paddingBottom:130},max:{width:"100%",maxWidth:680,alignSelf:"center",gap:18},hero:{minHeight:174,borderRadius:31,padding:25,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:18,backgroundColor:"#F8F8F8",borderWidth:1,borderColor:"#E2E2E2",boxShadow:"0 16px 38px rgba(25,27,31,.055)"},heroCopy:{flex:1},heroEyebrow:{color:"#74787E",fontSize:9,fontWeight:"900",letterSpacing:1.2},heroTitle:{marginTop:9,maxWidth:410,color:PX.ink,fontSize:25,lineHeight:31,fontWeight:"900"},heroSub:{marginTop:8,maxWidth:390,color:"#72777F",fontSize:10,lineHeight:15,fontWeight:"600"},folder:{width:112,height:102,borderRadius:31,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E3E3E3"},topRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},sectionTitle:{color:PX.ink,fontSize:21,fontWeight:"900"},sectionSub:{marginTop:3,color:PX.muted,fontSize:9,fontWeight:"600"},add:{height:44,paddingHorizontal:15,borderRadius:17,flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center",backgroundColor:"#272A2F"},addText:{color:"#FFF",fontSize:10,fontWeight:"900"},grid:{gap:9},card:{minHeight:86,borderRadius:22,padding:12,flexDirection:"row",alignItems:"center",gap:12},icon:{width:56,height:56,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"#F0F0F1",borderWidth:1,borderColor:"#E1E2E4"},copy:{flex:1,minWidth:0},title:{color:PX.ink,fontSize:13,fontWeight:"900"},meta:{marginTop:4,color:"#666C75",fontSize:9,fontWeight:"700"},fileState:{marginTop:5,flexDirection:"row",alignItems:"center",gap:4},updated:{color:"#4F765F",fontSize:8,fontWeight:"700"},missing:{color:"#8A5B54"},more:{width:40,height:40,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#F4F4F5"},empty:{minHeight:220,borderRadius:28,alignItems:"center",justifyContent:"center",padding:26,backgroundColor:"#F8F8F8",borderWidth:1,borderColor:"#E2E2E2"},emptyIcon:{width:62,height:62,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E1E1E1"},emptyTitle:{marginTop:12,color:PX.ink,fontSize:16,fontWeight:"900"},emptySub:{marginTop:5,maxWidth:330,textAlign:"center",color:PX.muted,fontSize:9,lineHeight:15,fontWeight:"600"},emptyButton:{marginTop:13,paddingHorizontal:16,paddingVertical:10,borderRadius:15,backgroundColor:"#272A2F"},emptyButtonText:{color:"#FFF",fontSize:9,fontWeight:"900"},
  backdrop:{flex:1,alignItems:"center",justifyContent:"center",padding:22,backgroundColor:"rgba(10,11,13,.46)"},modal:{width:"100%",maxWidth:460,maxHeight:"88%",padding:20,borderRadius:28,backgroundColor:"#FFF",borderWidth:1,borderColor:"#E4E4E5"},modalHead:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},modalTitle:{color:PX.ink,fontSize:18,fontWeight:"900"},modalSub:{marginTop:4,color:PX.muted,fontSize:9,lineHeight:14,fontWeight:"600"},close:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center",backgroundColor:"#F4F4F5"},chooseFile:{marginTop:15,minHeight:74,padding:11,borderRadius:20,flexDirection:"row",gap:11,alignItems:"center",backgroundColor:"#F7F7F8",borderWidth:1,borderColor:"#E2E3E5"},chooseIcon:{width:46,height:46,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF",borderWidth:1,borderColor:"#E0E1E3"},chooseCopy:{flex:1},chooseTitle:{color:PX.ink,fontSize:11,fontWeight:"900"},chooseSub:{marginTop:3,color:PX.muted,fontSize:8,fontWeight:"600"},label:{marginTop:13,marginBottom:6,color:"#565B63",fontSize:9,fontWeight:"900"},input:{height:49,paddingHorizontal:14,borderRadius:16,backgroundColor:"#F6F6F7",borderWidth:1,borderColor:"#E2E3E5",color:PX.ink,fontSize:11,fontWeight:"700"},select:{height:49,paddingHorizontal:14,borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#F6F6F7",borderWidth:1,borderColor:"#E2E3E5"},selectText:{color:PX.ink,fontSize:10,fontWeight:"800"},selectMenu:{marginTop:6,overflow:"hidden",borderRadius:15,borderWidth:1,borderColor:"#E3E4E6",backgroundColor:"#FFF"},selectOption:{minHeight:39,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},selectOptionOn:{backgroundColor:"#F1F1F2"},selectOptionText:{color:"#5E636B",fontSize:10,fontWeight:"700"},typeChips:{flexDirection:"row",flexWrap:"wrap",gap:7},typeChip:{paddingHorizontal:10,paddingVertical:8,borderRadius:14,backgroundColor:"#F6F6F7",borderWidth:1,borderColor:"#E2E3E5"},typeChipOn:{backgroundColor:"#ECECED",borderColor:"#BFC1C5"},typeChipText:{color:"#70747B",fontSize:9,fontWeight:"800"},typeChipTextOn:{color:"#22252A"},actionsStack:{marginTop:16,gap:9},actionWide:{height:48,borderRadius:15,flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center",backgroundColor:"#F3F3F4",borderWidth:1,borderColor:"#DFE0E2"},actionWideText:{color:"#2D3136",fontSize:9,fontWeight:"900"},modalBtns:{flexDirection:"row",gap:8},delete:{width:46,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#F5EFEF"},cancel:{flex:1,height:46,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EFEFF0"},cancelText:{color:PX.muted,fontWeight:"900",fontSize:9},save:{flex:1.5,height:46,borderRadius:14,flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center",backgroundColor:"#26292E"},saveText:{color:"#FFF",fontWeight:"900",fontSize:9},disabled:{opacity:.45},pressed:{opacity:.72,transform:[{scale:.985}]}
});
