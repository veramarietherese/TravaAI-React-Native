import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getSupabaseClient } from "@/lib/supabase";

export const PASSPORT_BUCKET = "trip-passport";
export const MAX_TRIP_MEMORIES = 30;
export const MAX_USER_MEMORIES = 10;

export type PassportAlbum = {
  id: string;
  tripId: string;
  albumName: string;
  createdBy: string;
  createdAt: string;
};

export type PassportMemory = {
  id: string;
  albumId: string;
  tripId: string;
  uploadedBy: string;
  uploaderName: string;
  storagePath: string;
  imageUrl: string | null;
  caption: string | null;
  locationName: string | null;
  takenAt: string | null;
  isFavorite: boolean;
  createdAt: string;
};

export type PassportData = {
  albums: PassportAlbum[];
  memories: PassportMemory[];
};

export type MemoryUploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function albumRow(row: Record<string, unknown>): PassportAlbum {
  return {
    id: String(row.album_id ?? row.id ?? ""),
    tripId: String(row.trip_id ?? ""),
    albumName: String(row.album_name ?? "Trip Memories"),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function memoryRow(row: Record<string, unknown>, imageUrl: string | null): PassportMemory {
  return {
    id: String(row.memory_id ?? row.id ?? ""),
    albumId: String(row.album_id ?? ""),
    tripId: String(row.trip_id ?? ""),
    uploadedBy: String(row.uploaded_by ?? ""),
    uploaderName: String(row.uploader_name ?? "Traveler"),
    storagePath: String(row.storage_path ?? ""),
    imageUrl,
    caption: typeof row.caption === "string" ? row.caption : null,
    locationName: typeof row.location_name === "string" ? row.location_name : null,
    takenAt: typeof row.taken_at === "string" ? row.taken_at : null,
    isFavorite: Boolean(row.is_favorite),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function loadPassportData(tripIds: string[]): Promise<PassportData> {
  const remoteTripIds = tripIds.filter(isUuid);
  if (!remoteTripIds.length) return { albums: [], memories: [] };
  const supabase = getSupabaseClient();

  const [albumsResult, memoriesResult] = await Promise.all([
    supabase.from("trava_trip_memory_albums").select("*").in("trip_id", remoteTripIds),
    supabase.from("trava_trip_memories").select("*").in("trip_id", remoteTripIds).order("created_at", { ascending: false }),
  ]);

  if (albumsResult.error) throw friendlyPassportError(albumsResult.error);
  if (memoriesResult.error) throw friendlyPassportError(memoriesResult.error);

  const memories = await Promise.all(
    (memoriesResult.data ?? []).map(async (row) => {
      const path = String(row.storage_path ?? "");
      const signed = path
        ? await supabase.storage.from(PASSPORT_BUCKET).createSignedUrl(path, 60 * 60)
        : { data: null };
      return memoryRow(row, signed.data?.signedUrl ?? null);
    }),
  );

  return {
    albums: (albumsResult.data ?? []).map((row) => albumRow(row)),
    memories,
  };
}

export async function fetchPassportMemory(memoryId: string): Promise<PassportMemory> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("trava_trip_memories").select("*").eq("memory_id", memoryId).single();
  if (error) throw friendlyPassportError(error);
  const path = String(data.storage_path ?? "");
  const signed = path ? await supabase.storage.from(PASSPORT_BUCKET).createSignedUrl(path, 60 * 60) : { data: null };
  return memoryRow(data, signed.data?.signedUrl ?? null);
}

export async function ensurePassportAlbum(input: {
  tripId: string;
  tripName: string;
  userId: string;
}): Promise<PassportAlbum> {
  if (!isUuid(input.tripId)) throw new Error("This local fallback trip is not synced yet. Sync or create the trip online before adding shared passport memories.");
  const supabase = getSupabaseClient();
  const existing = await supabase.from("trava_trip_memory_albums").select("*").eq("trip_id", input.tripId).maybeSingle();
  if (existing.error) throw friendlyPassportError(existing.error);
  if (existing.data) return albumRow(existing.data);

  const created = await supabase
    .from("trava_trip_memory_albums")
    .insert({ trip_id: input.tripId, album_name: input.tripName || "Trip Memories", created_by: input.userId })
    .select("*")
    .single();

  if (created.error) {
    if (created.error.code === "23505") {
      const retry = await supabase.from("trava_trip_memory_albums").select("*").eq("trip_id", input.tripId).single();
      if (retry.error) throw friendlyPassportError(retry.error);
      return albumRow(retry.data);
    }
    throw friendlyPassportError(created.error);
  }
  return albumRow(created.data);
}

export async function uploadPassportMemories(input: {
  tripId: string;
  tripName: string;
  userId: string;
  uploaderName: string;
  assets: MemoryUploadAsset[];
  caption: string;
  locationName: string;
  takenAt: string | null;
}): Promise<PassportMemory[]> {
  const supabase = getSupabaseClient();
  const totalCount = await supabase.from("trava_trip_memories").select("memory_id", { count: "exact", head: true }).eq("trip_id", input.tripId);
  if (totalCount.error) throw friendlyPassportError(totalCount.error);
  const userCount = await supabase.from("trava_trip_memories").select("memory_id", { count: "exact", head: true }).eq("trip_id", input.tripId).eq("uploaded_by", input.userId);
  if (userCount.error) throw friendlyPassportError(userCount.error);

  if ((totalCount.count ?? 0) + input.assets.length > MAX_TRIP_MEMORIES) {
    throw new Error(`A trip can contain up to ${MAX_TRIP_MEMORIES} memories.`);
  }
  if ((userCount.count ?? 0) + input.assets.length > MAX_USER_MEMORIES) {
    throw new Error(`Each traveler can contribute up to ${MAX_USER_MEMORIES} memories per trip.`);
  }

  const album = await ensurePassportAlbum({ tripId: input.tripId, tripName: input.tripName, userId: input.userId });
  const inserted: PassportMemory[] = [];

  for (const asset of input.assets) {
    const id = createId();
    const extension = extensionFor(asset.fileName, asset.mimeType);
    const path = `${input.tripId}/${input.userId}/${id}.${extension}`;
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error("TRAVA could not read one of the selected photos.");
    const body = await response.arrayBuffer();

    const upload = await supabase.storage.from(PASSPORT_BUCKET).upload(path, body, {
      contentType: asset.mimeType || "image/jpeg",
      upsert: false,
    });
    if (upload.error) throw friendlyPassportError(upload.error);

    const created = await supabase
      .from("trava_trip_memories")
      .insert({
        memory_id: id,
        album_id: album.id,
        trip_id: input.tripId,
        uploaded_by: input.userId,
        uploader_name: input.uploaderName || "Traveler",
        storage_path: path,
        caption: input.caption.trim() || null,
        location_name: input.locationName.trim() || null,
        taken_at: input.takenAt || null,
      })
      .select("*")
      .single();

    if (created.error) {
      await supabase.storage.from(PASSPORT_BUCKET).remove([path]);
      throw friendlyPassportError(created.error);
    }

    const signed = await supabase.storage.from(PASSPORT_BUCKET).createSignedUrl(path, 60 * 60);
    inserted.push(memoryRow(created.data, signed.data?.signedUrl ?? null));
  }

  return inserted;
}

export async function setMemoryFavorite(memoryId: string, favorite: boolean) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("trava_trip_memories").update({ is_favorite: favorite }).eq("memory_id", memoryId);
  if (error) throw friendlyPassportError(error);
}

export async function deletePassportMemory(memory: PassportMemory) {
  const supabase = getSupabaseClient();
  const removed = await supabase.from("trava_trip_memories").delete().eq("memory_id", memory.id);
  if (removed.error) throw friendlyPassportError(removed.error);
  if (memory.storagePath) await supabase.storage.from(PASSPORT_BUCKET).remove([memory.storagePath]);
}

export async function shareMemoryRecap(input: { tripName: string; destination: string; memories: PassportMemory[] }) {
  const chosen = input.memories.filter((memory) => memory.imageUrl).slice(0, 6);
  const cards = chosen.map((memory) => `<article><img src="${escapeHtml(memory.imageUrl || "")}"/><div><strong>${escapeHtml(memory.caption || "Travel memory")}</strong><span>${escapeHtml(memory.locationName || input.destination)}</span></div></article>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fff8fc;color:#202642;padding:32px}h1{margin:0;font-size:34px}p{color:#7b8499}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}article{background:white;padding:10px;border-radius:20px;box-shadow:0 12px 28px rgba(44,50,83,.08)}img{width:100%;height:260px;object-fit:cover;border-radius:15px}article div{padding:10px 4px 4px;display:flex;flex-direction:column;gap:4px}span{color:#8a93a5;font-size:12px}</style></head><body><h1>${escapeHtml(input.tripName)}</h1><p>${escapeHtml(input.destination)} · TRAVA Memory Passport</p><div class="grid">${cards}</div></body></html>`;

  if (Platform.OS === "web") {
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Allow pop-ups to preview your memory recap.");
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 350);
    return;
  }

  const file = await Print.printToFileAsync({ html });
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error("Sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: `${input.tripName} Memory Passport` });
}

function extensionFor(fileName?: string | null, mimeType?: string | null) {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("heic")) return "heic";
  return "jpg";
}
function createId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char)); }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function friendlyPassportError(error: { message?: string; code?: string }) {
  const message = error.message || "Memory Passport could not complete this action.";
  if (error.code === "42P01" || /does not exist/i.test(message)) return new Error("Memory Passport database tables are not installed yet. Apply the included Supabase migration, then retry.");
  if (/bucket/i.test(message) && /not found|does not exist/i.test(message)) return new Error("The private trip-passport storage bucket is not installed yet. Apply the included Supabase migration.");
  return new Error(message);
}
