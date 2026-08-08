import * as Crypto from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";

import { getSupabaseClient } from "@/lib/supabase";

const MAX_TRIP_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadTripImage(options: { userId: string; tripId: string; kind: "cover" | "receipts"; asset: ImagePickerAsset }) {
  if ((options.asset.fileSize ?? 0) > MAX_TRIP_IMAGE_BYTES) throw new Error("Choose an image smaller than 10 MB.");
  const extension = (options.asset.fileName?.split(".").pop() || options.asset.mimeType?.split("/").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const path = `${options.userId}/trips/${options.tripId}/${options.kind}/${Crypto.randomUUID()}.${extension || "jpg"}`;
  const webAsset = options.asset as ImagePickerAsset & { file?: Blob };
  const body = webAsset.file ?? (await fetch(options.asset.uri).then((response) => response.blob()));
  const { error } = await getSupabaseClient().storage.from("trip-media").upload(path, body, {
    contentType: options.asset.mimeType || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}


export async function removeTripImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await getSupabaseClient().storage.from("trip-media").remove([path]);
  if (error) throw error;
}
