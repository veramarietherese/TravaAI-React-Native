import type { PlaceSearchResult } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 3) return [];
  const result = await apiRequest<{ data: PlaceSearchResult[] }>(`/api/places/search?q=${encodeURIComponent(normalized)}`);
  return result.data;
}
