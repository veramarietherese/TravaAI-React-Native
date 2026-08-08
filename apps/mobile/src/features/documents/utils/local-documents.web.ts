import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";

import type { LocalTripDocument } from "@trava/shared";

const MAX_LOCAL_DOCUMENT_BYTES = 25 * 1024 * 1024;
const DATABASE_NAME = "trava-local-documents";
const STORE_NAME = "files";

function metadataKey(tripId: string, userId: string): string {
  return `trava:local-documents:${userId}:${tripId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local document storage."));
  });
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(blob, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to store the local document."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local document storage was cancelled."));
    });
  } finally {
    database.close();
  }
}

async function getBlob(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read the local document."));
    });
  } finally {
    database.close();
  }
}

async function deleteBlob(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to delete the local document."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local document deletion was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function listLocalDocuments(tripId: string, userId: string): Promise<LocalTripDocument[]> {
  const raw = await AsyncStorage.getItem(metadataKey(tripId, userId));
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as LocalTripDocument[]) : [];
  } catch {
    return [];
  }
}

async function saveDocuments(
  tripId: string,
  userId: string,
  documents: LocalTripDocument[],
): Promise<LocalTripDocument[]> {
  await AsyncStorage.setItem(metadataKey(tripId, userId), JSON.stringify(documents));
  return documents;
}

export async function pickAndStoreDocument(
  tripId: string,
  userId: string,
  category: LocalTripDocument["category"],
): Promise<LocalTripDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.assets?.[0] as (DocumentPicker.DocumentPickerAsset & { file?: File }) | undefined;
  if (result.canceled || !asset) return null;

  let blob: Blob | undefined = asset.file;
  if (!blob) {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error("Unable to read the selected document.");
    blob = await response.blob();
  }

  if (blob.size > MAX_LOCAL_DOCUMENT_BYTES) {
    throw new Error("Choose a document smaller than 25 MB.");
  }

  const id = Crypto.randomUUID();
  await putBlob(id, blob);

  const document: LocalTripDocument = {
    id,
    name: asset.name,
    mimeType: asset.mimeType || blob.type || "application/octet-stream",
    size: asset.size ?? blob.size,
    localUri: `indexeddb:${id}`,
    category,
    createdAt: new Date().toISOString(),
  };
  const current = await listLocalDocuments(tripId, userId);
  await saveDocuments(tripId, userId, [document, ...current]);
  return document;
}

export async function deleteLocalDocument(
  tripId: string,
  userId: string,
  id: string,
): Promise<LocalTripDocument[]> {
  await deleteBlob(id);
  const current = await listLocalDocuments(tripId, userId);
  return saveDocuments(
    tripId,
    userId,
    current.filter((document) => document.id !== id),
  );
}

export async function openLocalDocument(document: LocalTripDocument): Promise<void> {
  const blob = await getBlob(document.id);
  if (!blob) throw new Error("This local file is no longer available.");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
