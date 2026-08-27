import type { WorldPlaceResult } from "./world-place-search";

const cache = new Map<string, string>();

const FALLBACKS: Record<string, string> = {
  cafes: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=76",
  food: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=76",
  shopping: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=76",
  hiking: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=76",
  work: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=76",
  parks: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=76",
  default: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=76",
};

export function fallbackPlaceImage(category?: string | null) {
  const value = String(category ?? "").toLowerCase();
  if (value.includes("cafe") || value.includes("coffee")) return FALLBACKS.cafes;
  if (value.includes("food") || value.includes("restaurant")) return FALLBACKS.food;
  if (value.includes("shop") || value.includes("mall")) return FALLBACKS.shopping;
  if (value.includes("hik") || value.includes("trail")) return FALLBACKS.hiking;
  if (value.includes("work") || value.includes("office")) return FALLBACKS.work;
  if (value.includes("park") || value.includes("garden")) return FALLBACKS.parks;
  return FALLBACKS.default;
}

export async function resolveFreePlaceImage(
  place: Pick<WorldPlaceResult, "id" | "name" | "city" | "country" | "latitude" | "longitude" | "category" | "imageUrl">,
) {
  if (place.imageUrl) return place.imageUrl;
  const key = `${place.id}:${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const exactQuery = [place.name, place.city, place.country].filter(Boolean).join(" ");
  const exact = await commonsTextImage(exactQuery);
  if (exact) {
    cache.set(key, exact);
    return exact;
  }

  const nearby = await commonsGeoImage(place.latitude, place.longitude);
  const resolved = nearby ?? fallbackPlaceImage(place.category);
  cache.set(key, resolved);
  return resolved;
}

export async function hydratePlacePhotos<T extends WorldPlaceResult>(items: T[], concurrency = 4): Promise<Array<T & { imageUrl: string }>> {
  const output: Array<T & { imageUrl: string }> = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (!item) continue;
      output[index] = { ...item, imageUrl: await resolveFreePlaceImage(item) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()));
  return output.filter(Boolean);
}

type CommonsPayload = {
  query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }> };
};

async function commonsTextImage(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  try {
    const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: "5", prop: "imageinfo", iiprop: "url|mime", iiurlwidth: "1200", format: "json", origin: "*" });
    const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, 3200);
    return response.ok ? firstUsableImage(await response.json() as CommonsPayload) : null;
  } catch { return null; }
}

async function commonsGeoImage(latitude: number, longitude: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({ action: "query", generator: "geosearch", ggsprimary: "all", ggsnamespace: "6", ggsradius: "1400", ggscoord: `${latitude}|${longitude}`, ggslimit: "10", prop: "imageinfo", iiprop: "url|mime", iiurlwidth: "1200", format: "json", origin: "*" });
    const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, 3200);
    return response.ok ? firstUsableImage(await response.json() as CommonsPayload) : null;
  } catch { return null; }
}

function firstUsableImage(payload: CommonsPayload) {
  for (const page of Object.values(payload.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (/\.(svg|pdf|djvu|webm|ogv)$/i.test(page.title ?? "")) continue;
    if (info?.mime && !info.mime.startsWith("image/")) continue;
    const url = info?.thumburl || info?.url;
    if (url) return url;
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}
