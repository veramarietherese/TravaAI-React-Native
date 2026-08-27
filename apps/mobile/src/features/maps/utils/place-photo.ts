import type { WorldPlaceResult } from "./world-place-search";

const cache = new Map<string, string>();

type ExactPlace = Pick<
  WorldPlaceResult,
  "id" | "name" | "city" | "country" | "latitude" | "longitude" | "category" | "imageUrl"
>;

export async function resolveFreePlaceImage(place: ExactPlace) {
  const key = `${place.id}:${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached) return cached;


  const commons = await commonsExactImage(place);
  if (commons) {
    cache.set(key, commons);
    return commons;
  }

  const map = exactStaticMap(place.latitude, place.longitude);
  cache.set(key, map);
  return map;
}

export async function hydratePlacePhotos<T extends WorldPlaceResult>(
  items: T[],
  concurrency = 4,
): Promise<(T & { imageUrl: string })[]> {
  const output: (T & { imageUrl: string })[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (!item) continue;
      const imageUrl = await resolveFreePlaceImage(item);
      output[index] = { ...item, imageUrl };
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) },
      () => worker(),
    ),
  );
  return output.filter(Boolean);
}

async function commonsExactImage(place: ExactPlace) {
  if (!place.name.trim()) return null;

  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `"${place.name}" ${place.city ?? ""} ${place.country ?? ""}`.trim(),
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "1100",
      format: "json",
      origin: "*",
    });
    const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, 4200);
    if (!response.ok) return null;
    const payload = await response.json() as {
      query?: {
        pages?: Record<string, {
          title?: string;
          imageinfo?: { thumburl?: string; url?: string; mime?: string }[];
        }>;
      };
    };

    const candidates = Object.values(payload.query?.pages ?? {})
      .map((page) => ({
        title: page.title ?? "",
        url: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || "",
        mime: page.imageinfo?.[0]?.mime || "",
      }))
      .filter((item) => item.url && (!item.mime || item.mime.startsWith("image/")))
      .map((item) => ({ ...item, score: similarity(place.name, item.title) }))
      .sort((a, b) => b.score - a.score);

    return candidates[0] && candidates[0].score >= 0.62 ? candidates[0].url : null;
  } catch {
    return null;
  }
}

function commonsRedirect(value: string) {
  const file = value.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=1100`;
}

function exactStaticMap(latitude: number, longitude: number) {
  const center = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=17&size=640x420&maptype=mapnik&markers=${center},red-pushpin`;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(aRaw: string, bRaw: string) {
  const a = new Set(normalize(aRaw).split(" ").filter((token) => token.length > 1));
  const b = new Set(normalize(bRaw).split(" ").filter((token) => token.length > 1));
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / Math.max(a.size, b.size);
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "Accept-Language": "en" },
    });
  } finally {
    clearTimeout(timer);
  }
}
