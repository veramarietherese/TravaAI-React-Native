import type { WorldPlaceResult } from "./world-place-search";

const cache = new Map<string, string | null>();

const FALLBACKS: Record<string, string> = {
  cafes: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=78",
  food: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=78",
  shopping: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=78",
  hiking: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1000&q=78",
  work: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=78",
  parks: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=78",
  default: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=78",
};

export function fallbackPlaceImage(category?: string | null) {
  const key = String(category || "").toLowerCase();
  if (key.includes("cafe")) return FALLBACKS.cafes;
  if (key.includes("food") || key.includes("restaurant")) return FALLBACKS.food;
  if (key.includes("shop")) return FALLBACKS.shopping;
  if (key.includes("hik") || key.includes("trail")) return FALLBACKS.hiking;
  if (key.includes("work")) return FALLBACKS.work;
  if (key.includes("park") || key.includes("garden")) return FALLBACKS.parks;
  return FALLBACKS.default;
}

export async function resolveFreePlaceImage(place: Pick<WorldPlaceResult, "id" | "name" | "city" | "country" | "latitude" | "longitude" | "category" | "imageUrl">) {
  if (place.imageUrl) return place.imageUrl;
  const key = `${place.id}:${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key) ?? fallbackPlaceImage(place.category);

  const exact = await commonsSearchImage([place.name, place.city, place.country].filter(Boolean).join(" "));
  if (exact) {
    cache.set(key, exact);
    return exact;
  }

  const nearby = await commonsGeoImage(place.latitude, place.longitude);
  cache.set(key, nearby);
  return nearby ?? fallbackPlaceImage(place.category);
}

async function commonsSearchImage(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "4",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "1000",
      format: "json",
      origin: "*",
    });
    const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, 2800);
    if (!response.ok) return null;
    const json = await response.json() as CommonsPayload;
    return firstImage(json);
  } catch {
    return null;
  }
}

async function commonsGeoImage(latitude: number, longitude: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggsprimary: "all",
      ggsnamespace: "6",
      ggsradius: "1200",
      ggscoord: `${latitude}|${longitude}`,
      ggslimit: "8",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "1000",
      format: "json",
      origin: "*",
    });
    const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, 2800);
    if (!response.ok) return null;
    return firstImage(await response.json() as CommonsPayload);
  } catch {
    return null;
  }
}

type CommonsPayload = {
  query?: {
    pages?: Record<string, {
      title?: string;
      imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
    }>;
  };
};

function firstImage(payload: CommonsPayload) {
  const pages = Object.values(payload.query?.pages ?? {});
  const candidates = pages
    .filter((page) => !/\.(svg|pdf|djvu)$/i.test(page.title || ""))
    .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
    .filter((url): url is string => Boolean(url));
  return candidates[0] ?? null;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
