import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { createElement, useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PremiumBlueButton } from "@/components/ui/PremiumBlueButton";
import { TravaButton } from "@/components/ui/TravaButton";
import { Glass, PX, ScreenShell, type TravaIconName } from "@/features/trips/components/TravaPixelUI";
import { useLocalTripWorkspace, type LocalDocument } from "@/features/trips/hooks/useLocalTripWorkspace";
import { useTripLite } from "@/features/trips/hooks/useTripLite";
import { DocumentsHero } from "../components/DocumentsHero";

const TYPES = ["Identity", "Flight", "Hotel", "Insurance", "Document"] as const;
const TYPE_META: Record<string, { icon: TravaIconName; bg: string; fg: string }> = {
  Identity: { icon: "person-circle-outline", bg: "#EEF2FF", fg: "#788ADA" },
  Flight: { icon: "airplane-outline", bg: "#EAF7FF", fg: "#609ED8" },
  Hotel: { icon: "bed-outline", bg: "#FFF2E8", fg: "#D89564" },
  Insurance: { icon: "shield-checkmark-outline", bg: "#EEF8F5", fg: "#65A38F" },
  Document: { icon: "document-text-outline", bg: "#FFF0F6", fg: "#D978A4" },
};

export function DocumentsScreen() {
  const { tripId: raw } = useLocalSearchParams<{ tripId: string }>();
  const tripId = String(raw ?? "local-japan");
  const { trip } = useTripLite(tripId);
  const { state, addDocument, updateDocument, deleteDocument } = useLocalTripWorkspace(tripId);
  const [addOpen, setAddOpen] = useState(false);
  const [active, setActive] = useState<LocalDocument | null>(null);

  return <SafeAreaView style={s.safe} edges={["top"]}><StatusBar style="dark"/><ScreenShell tripId={tripId} title={trip.name || "Trip"}>
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}><View style={s.max}>
      <DocumentsHero documentCount={state.documents.length}/>
      <View style={s.topRow}><View><Text style={s.sectionTitle}>Files</Text><Text style={s.sectionSub}>Tap anywhere on a file card to preview it.</Text></View>
        <TravaButton label="Add file" iconName="add" tone="pink" variant="compact" onPress={() => setAddOpen(true)} />
      </View>

      <View style={s.grid}>{state.documents.map((doc) => {
        const meta = TYPE_META[doc.type] ?? TYPE_META.Document;
        return <Pressable key={doc.id} accessibilityRole="button" accessibilityLabel={`Open ${doc.title}`} onPress={() => setActive(doc)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
          <View style={[s.icon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={24} color={meta.fg}/></View>
          <View style={s.copy}><Text numberOfLines={1} style={s.fileTitle}>{doc.title}</Text><Text style={s.meta}>{doc.type} · {doc.size}</Text><Text style={s.updated}>Updated {doc.updated}</Text></View>
          <View style={s.openPill}><Ionicons name="eye-outline" size={16} color="#6686C9"/><Text style={s.openPillText}>Open</Text></View>
        </Pressable>;
      })}{state.documents.length === 0 ? <View style={s.empty}><Ionicons name="folder-open-outline" size={34} color="#8AABD9"/><Text style={s.emptyTitle}>No documents yet</Text><Text style={s.emptyBody}>Upload a PDF, image, ticket, booking file, or other travel document.</Text></View> : null}</View>

      <Glass style={s.note}><Ionicons name="resize-outline" size={20} color="#6B8FD0"/><View style={{ flex: 1 }}><Text style={s.noteTitle}>Storage-aware</Text><Text style={s.noteText}>Large images are compressed automatically before local persistence. Other formats keep the original file reference and metadata.</Text></View></Glass>
    </View></ScrollView>

    <AddDocumentModal visible={addOpen} onClose={() => setAddOpen(false)} onAdd={(doc) => { addDocument(doc); setAddOpen(false); }}/>
    <DocumentPreview key={active?.id ?? "document-preview-closed"} document={active} onClose={() => setActive(null)} onType={(type) => { if (active) updateDocument(active.id, { type }); setActive((current) => current ? { ...current, type } : current); }} onDelete={() => { if (active?.blobKey) void deleteStoredBlob(active.blobKey); if (active) deleteDocument(active.id); setActive(null); }}/>
  </ScreenShell></SafeAreaView>;
}

function AddDocumentModal({ visible, onClose, onAdd }: { visible: boolean; onClose(): void; onAdd(value: Omit<LocalDocument, "id" | "updated">): void }) {
  const [busy, setBusy] = useState(false);
  async function chooseFile() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      const asset = !result.canceled ? result.assets?.[0] : null;
      if (!asset) return;
      const mimeType = asset.mimeType || guessMime(asset.name);
      const prepared = await prepareStoredDocument(asset.uri, mimeType, asset.size);
      onAdd({ title: asset.name || "Travel Document", type: inferDocumentType(asset.name, mimeType), size: formatBytes(prepared.byteSize ?? asset.size), mimeType, uri: prepared.uri, dataUrl: prepared.dataUrl, blobKey: prepared.blobKey });
    } finally { setBusy(false); }
  }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={s.modal}>
    <View style={s.modalHead}><View><Text style={s.modalTitle}>Add document</Text><Text style={s.modalSub}>TRAVA keeps the original filename and format metadata.</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#66748A"/></Pressable></View>
    <View style={s.uploadVisual}><LinearGradient colors={["#EEF8FF", "#F5F1FF", "#FFF1F6"]} style={StyleSheet.absoluteFill}/><Ionicons name="document-attach-outline" size={46} color="#7597D9"/><Text style={s.uploadTitle}>Choose a travel file</Text><Text style={s.uploadBody}>PDF, image, ticket, booking confirmation, office document, and more.</Text></View>
    <PremiumBlueButton label={busy ? "Preparing file..." : "Choose file"} icon="cloud-upload-outline" loading={busy} onPress={() => void chooseFile()}/>
  </View></View></Modal>;
}

function DocumentPreview({ document: doc, onClose, onType, onDelete }: { document: LocalDocument | null; onClose(): void; onType(type: string): void; onDelete(): void }) {
  const [edit, setEdit] = useState(false);
  const [type, setType] = useState(doc?.type ?? "Document");
  const [resolvedSource, setResolvedSource] = useState<string | null>(() => doc?.dataUrl || doc?.uri || null);
  const blobKey = doc?.blobKey ?? null;

  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;
    if (Platform.OS === "web" && blobKey) {
      void readStoredBlob(blobKey).then((blob) => {
        if (!live || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSource(objectUrl);
      });
    }
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [blobKey]);

  if (!doc) return null;

  const mime = doc.mimeType || guessMime(doc.title);
  const source = resolvedSource;
  const isImage = Boolean(source && mime.startsWith("image/"));
  const isPdf = Boolean(source && mime === "application/pdf");

  async function openFull() {
    if (!source) return;
    if (Platform.OS === "web") { window.open(source, "_blank", "noopener,noreferrer"); return; }
    await Linking.openURL(source).catch(() => undefined);
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop}><View style={[s.modal, s.previewModal]}>
    <View style={s.modalHead}><View style={{ flex: 1 }}><Text numberOfLines={1} style={s.modalTitle}>{doc.title}</Text><Text style={s.modalSub}>{doc.type} · {doc.size}</Text></View><Pressable onPress={onClose} style={s.close}><Ionicons name="close" size={20} color="#66748A"/></Pressable></View>
    <View style={s.preview}>
      {isImage && source ? <Image source={{ uri: source }} contentFit="contain" style={StyleSheet.absoluteFill}/>
        : isPdf && source && Platform.OS === "web" ? createElement("object", { data: source, type: "application/pdf", style: { width: "100%", height: "100%", border: 0, display: "block" } } as never)
        : <View style={s.genericPreview}><LinearGradient colors={["#EEF8FF", "#F6F2FF", "#FFF2F7"]} style={s.genericIcon}><Ionicons name={mime.includes("pdf") ? "document-text-outline" : "document-attach-outline"} size={50} color="#7695D5"/></LinearGradient><Text style={s.genericTitle}>{doc.title}</Text><Text style={s.genericBody}>{source ? "This format is stored and accessible. Use Open full document to launch it with the browser or device viewer." : "The original file reference is unavailable on this device. Re-attach the file to restore preview access."}</Text></View>}
    </View>

    {edit ? <View style={s.editPanel}><Text style={s.label}>Document type</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>{TYPES.map((value) => <Pressable key={value} onPress={() => setType(value)} style={[s.typeChip, type === value && s.typeChipOn]}><Text style={[s.typeChipText, type === value && s.typeChipTextOn]}>{value}</Text></Pressable>)}</ScrollView><PremiumBlueButton label="Save metadata" icon="checkmark" onPress={() => { onType(type); setEdit(false); }}/></View> : null}

    <View style={s.previewActions}><Pressable onPress={() => setEdit((value) => !value)} style={s.secondaryButton}><Ionicons name="create-outline" size={18} color="#657792"/><Text style={s.secondaryText}>{edit ? "Done" : "Edit"}</Text></Pressable><Pressable onPress={onDelete} style={s.secondaryButton}><Ionicons name="trash-outline" size={18} color="#D56E87"/><Text style={[s.secondaryText, { color: "#C8667D" }]}>Delete</Text></Pressable><PremiumBlueButton label="Open full document" icon="open-outline" disabled={!source} onPress={() => void openFull()} style={{ flex: 1 }}/></View>
  </View></View></Modal>;
}

async function prepareStoredDocument(uri: string, mimeType: string, originalSize?: number | null) {
  if (Platform.OS !== "web") return { uri, dataUrl: null as string | null, blobKey: null as string | null, byteSize: originalSize ?? null };
  try {
    const response = await fetch(uri);
    const original = await response.blob();
    const blob = mimeType.startsWith("image/") && original.size > 260_000 ? await compressImage(original, 1600, 0.76) : original;
    const blobKey = await persistBlob(blob);
    const dataUrl = blob.size <= 550_000 ? await blobToDataUrl(blob) : null;
    return { uri: URL.createObjectURL(blob), dataUrl, blobKey, byteSize: blob.size };
  } catch { return { uri, dataUrl: null as string | null, blobKey: null as string | null, byteSize: originalSize ?? null }; }
}

const DOC_DB = "trava-documents-v1";
const DOC_STORE = "files";

function openDocDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DOC_DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DOC_STORE)) request.result.createObjectStore(DOC_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistBlob(blob: Blob) {
  const db = await openDocDb();
  const key = `trava-doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, "readwrite");
    tx.objectStore(DOC_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return key;
}

async function readStoredBlob(key: string): Promise<Blob | null> {
  if (Platform.OS !== "web" || typeof indexedDB === "undefined") return null;
  try {
    const db = await openDocDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction(DOC_STORE, "readonly").objectStore(DOC_STORE).get(key);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return blob;
  } catch { return null; }
}

async function deleteStoredBlob(key: string) {
  if (Platform.OS !== "web" || typeof indexedDB === "undefined") return;
  try {
    const db = await openDocDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DOC_STORE, "readwrite");
      tx.objectStore(DOC_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch { /* best effort */ }
}

async function compressImage(blob: Blob, maxDimension: number, quality: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio)); const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = window.document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) return blob;
    context.drawImage(bitmap, 0, 0, width, height);
    const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    bitmap.close(); return output ?? blob;
  } catch { return blob; }
}
function blobToDataUrl(blob: Blob) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); }); }
function inferDocumentType(name: string, mime: string) { const lower = `${name} ${mime}`.toLowerCase(); if (lower.includes("passport") || lower.includes("id")) return "Identity"; if (lower.includes("flight") || lower.includes("boarding") || lower.includes("airline")) return "Flight"; if (lower.includes("hotel") || lower.includes("booking") || lower.includes("accommodation")) return "Hotel"; if (lower.includes("insurance")) return "Insurance"; return "Document"; }
function guessMime(name: string) { const lower = name.toLowerCase(); if (lower.endsWith(".pdf")) return "application/pdf"; if (/\.(png|jpg|jpeg|webp|gif)$/i.test(lower)) return lower.endsWith(".png") ? "image/png" : "image/jpeg"; if (lower.endsWith(".txt")) return "text/plain"; if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; return "application/octet-stream"; }
function formatBytes(value: number | undefined | null) { if (!value || value <= 0) return "Local"; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" }, scroll: { padding: 22, paddingBottom: 130 }, max: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 18 }, topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, sectionTitle: { color: PX.ink, fontSize: 24, fontWeight: "900" }, sectionSub: { marginTop: 4, color: PX.muted, fontSize: 10, fontWeight: "600" },
  addButton: { borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 24px rgba(91,135,208,.18)" }, addGradient: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, addText: { color: "#FFF", fontSize: 10, fontWeight: "900" }, grid: { gap: 10 }, card: { minHeight: 96, borderRadius: 25, padding: 14, flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E9EF", boxShadow: "0 10px 26px rgba(41,54,82,.055)" }, copy: { flex: 1, minWidth: 0 }, icon: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center" }, fileTitle: { color: PX.ink, fontSize: 14, fontWeight: "900" }, meta: { marginTop: 5, color: "#68758B", fontSize: 9.5, fontWeight: "700" }, updated: { marginTop: 4, color: "#98A1AE", fontSize: 8.5, fontWeight: "700" }, openPill: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF4FF" }, openPillText: { color: "#6686C9", fontSize: 8.5, fontWeight: "900" }, pressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  empty: { minHeight: 180, borderRadius: 28, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#F8FAFD", borderWidth: 1, borderColor: "#E9ECF1" }, emptyTitle: { marginTop: 10, color: PX.ink, fontSize: 15, fontWeight: "900" }, emptyBody: { marginTop: 6, maxWidth: 330, color: "#7E899B", fontSize: 10, lineHeight: 15, fontWeight: "600", textAlign: "center" }, note: { minHeight: 82, padding: 15, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8FAFF" }, noteTitle: { color: "#51647F", fontSize: 10, fontWeight: "900" }, noteText: { marginTop: 4, color: "#7C899B", fontSize: 9, lineHeight: 14, fontWeight: "600" },
  backdrop: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(13,20,36,.44)" }, modal: { width: "100%", maxWidth: 560, borderRadius: 29, padding: 20, backgroundColor: "#FFFFFF", boxShadow: "0 24px 70px rgba(25,35,58,.22)" }, previewModal: { maxWidth: 780, maxHeight: "92%" }, modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 15 }, modalTitle: { color: PX.ink, fontSize: 20, fontWeight: "900" }, modalSub: { marginTop: 4, color: "#7C8798", fontSize: 9, fontWeight: "600" }, close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F6F9" }, uploadVisual: { minHeight: 210, marginBottom: 16, borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center", padding: 20 }, uploadTitle: { marginTop: 12, color: PX.ink, fontSize: 16, fontWeight: "900" }, uploadBody: { marginTop: 6, maxWidth: 340, color: "#768398", fontSize: 9.5, lineHeight: 14, fontWeight: "600", textAlign: "center" },
  preview: { height: 440, borderRadius: 23, overflow: "hidden", backgroundColor: "#F2F5F9", borderWidth: 1, borderColor: "#E5E9EF" }, genericPreview: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26 }, genericIcon: { width: 112, height: 112, borderRadius: 34, alignItems: "center", justifyContent: "center" }, genericTitle: { marginTop: 15, maxWidth: 420, color: PX.ink, fontSize: 16, fontWeight: "900", textAlign: "center" }, genericBody: { marginTop: 8, maxWidth: 460, color: "#7A8699", fontSize: 10, lineHeight: 15, fontWeight: "600", textAlign: "center" }, previewActions: { marginTop: 15, flexDirection: "row", alignItems: "center", gap: 8 }, secondaryButton: { height: 50, paddingHorizontal: 13, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F4F6F9" }, secondaryText: { color: "#657792", fontSize: 9.5, fontWeight: "900" }, editPanel: { marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: "#F8FAFD" }, label: { marginBottom: 7, color: "#65728A", fontSize: 9, fontWeight: "900" }, typeRow: { paddingBottom: 12, gap: 7 }, typeChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, justifyContent: "center", backgroundColor: "#F1F3F7" }, typeChipOn: { backgroundColor: "#EAF1FF" }, typeChipText: { color: "#7C8798", fontSize: 8.5, fontWeight: "800" }, typeChipTextOn: { color: "#6083C9" },
});
