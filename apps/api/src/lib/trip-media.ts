import { getSupabaseAdmin } from "./supabase-admin.js";

export async function createTripMediaSignedUrl(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !path.trim()) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("trip-media")
    .createSignedUrl(path, 60 * 60);
  if (error) {
    console.warn(`[trip-media] unable to sign ${path}: ${error.message}`);
    return null;
  }
  return data.signedUrl;
}

export async function removeTripMedia(paths: unknown[]): Promise<void> {
  const normalized = paths.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  if (!normalized.length) return;
  const { error } = await getSupabaseAdmin().storage.from("trip-media").remove(normalized);
  if (error) console.warn(`[trip-media] cleanup failed: ${error.message}`);
}
