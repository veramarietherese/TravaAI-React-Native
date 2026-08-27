import { apiRequest } from "@/lib/api-client";

export type WorldPlaceResult = {
  id: string;
  name: string;
  displayName: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  category?: string | null;
  imageUrl?: string | null;
};

export type PlaceBias = { latitude: number; longitude: number } | null | undefined;

function buildQuery(path: string, params: Record<string, string | number | null | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && String(value).length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${path}?${query}` : path;
}

export async function searchWorldPlaces(query: string, bias?: PlaceBias, limit = 12): Promise<WorldPlaceResult[]> {
  const text = query.trim();
  if (text.length < 2) return [];

  const categorySearch = parseCategorySearch(text);
  if (categorySearch) {
    const anchors = await photonSearch(categorySearch.location, bias, 1);
    const anchor = anchors[0];
    if (anchor) {
      const nearby = await searchNearbyPlaces(categorySearch.category, anchor.latitude, anchor.longitude, limit);
      if (nearby.length) return nearby;
    }
  }

  try {
    const result = await apiRequest<{ data: WorldPlaceResult[] }>(buildQuery("/api/places/search", {
      q: text,
      lat: bias?.latitude,
      lon: bias?.longitude,
      limit,
    }));
    const data = dedupe(result.data ?? []).slice(0, limit);
    if (data.length) return data;
  } catch {
    // Public no-key API may be unavailable locally; Photon fallback below keeps search working.
  }
  return photonSearch(text, bias, limit);
}

export async function searchNearbyPlaces(category: string, latitude: number, longitude: number, limit = 18): Promise<WorldPlaceResult[]> {
  try {
    const result = await apiRequest<{ data: WorldPlaceResult[] }>(buildQuery("/api/places/nearby", { category, lat: latitude, lon: longitude, limit }));
    const data = dedupe(result.data ?? []).slice(0, limit);
    if (data.length) return data;
  } catch {
    // Deliberately do not hit Overpass from the browser. It caused 429/refused loops.
  }
  return photonNearby(category, latitude, longitude, limit);
}

async function photonNearby(category: string, latitude: number, longitude: number, limit: number) {
  const aliases: Record<string, string[]> = {
    cafes: ["cafe", "coffee"],
    food: ["restaurant", "food"],
    shopping: ["shopping mall", "shop"],
    hiking: ["trail", "viewpoint", "park"],
    work: ["coworking", "library", "office"],
    parks: ["park", "garden"],
  };
  const normalized = normalizeCategory(category);
  const groups = await Promise.all((aliases[normalized] ?? [category]).map((q) => photonSearch(q, { latitude, longitude }, Math.min(12, limit))));
  return dedupe(groups.flat())
    .map((item) => ({ ...item, category: normalized }))
    .sort((a, b) => distanceSq(a.latitude, a.longitude, latitude, longitude) - distanceSq(b.latitude, b.longitude, latitude, longitude))
    .slice(0, limit);
}

async function photonSearch(text: string, bias: PlaceBias, limit: number): Promise<WorldPlaceResult[]> {
  try {
    const params = new URLSearchParams({ q: text, limit: String(limit) });
    if (bias) {
      params.set("lat", String(bias.latitude));
      params.set("lon", String(bias.longitude));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal: controller.signal }).finally(() => clearTimeout(timeout));
    if (!response.ok) return [];
    const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }> };
    return dedupe((payload.features ?? []).flatMap((feature, index) => {
      const coords = feature.geometry?.coordinates;
      if (!coords) return [];
      const [longitude, latitude] = coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const p = feature.properties ?? {};
      const name = clean(p.name) || clean(p.street) || clean(p.city) || clean(p.state) || clean(p.country) || "Location";
      const city = clean(p.city) || clean(p.state);
      const country = clean(p.country);
      const displayName = [name, clean(p.street), city, clean(p.state), country].filter(Boolean).filter((value, position, values) => values.indexOf(value) === position).join(", ");
      return [{
        id: `${clean(p.osm_type) ?? "place"}-${String(p.osm_id ?? `${latitude}-${longitude}-${index}`)}`,
        name,
        displayName: displayName || name,
        city,
        country,
        latitude,
        longitude,
        category: clean(p.osm_value) || clean(p.type),
      } satisfies WorldPlaceResult];
    })).slice(0, limit);
  } catch { return []; }
}

function parseCategorySearch(text: string): { category: string; location: string } | null {
  const match = text.trim().match(/^(cafes?|coffee|restaurants?|food|shops?|shopping|malls?|hiking|trails?|coworking|work|parks?|gardens?)\s+(?:in|near|around)\s+(.+)$/i);
  if (!match) return null;
  const location = match[2]?.trim();
  if (!location) return null;
  return { category: normalizeCategory(match[1] ?? ""), location };
}

function normalizeCategory(value: string) {
  const q = value.toLowerCase();
  if (q.startsWith("cafe") || q === "coffee") return "cafes";
  if (q.startsWith("restaurant") || q === "food") return "food";
  if (q.startsWith("shop") || q.startsWith("mall")) return "shopping";
  if (q.startsWith("hik") || q.startsWith("trail")) return "hiking";
  if (q.startsWith("work") || q.startsWith("cowork")) return "work";
  return "parks";
}

function clean(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function dedupe(items: WorldPlaceResult[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name.toLowerCase()}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function distanceSq(lat: number, lon: number, anchorLat: number, anchorLon: number) { return (lat - anchorLat) ** 2 + (lon - anchorLon) ** 2; }
