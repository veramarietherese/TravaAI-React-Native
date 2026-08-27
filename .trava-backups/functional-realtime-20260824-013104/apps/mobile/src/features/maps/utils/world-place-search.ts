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
    const anchors = await photonFallback(categorySearch.location, bias, 1);
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
    const data = dedupe(result.data).slice(0, limit);
    return data.length ? data : photonFallback(text, bias, limit);
  } catch {
    return photonFallback(text, bias, limit);
  }
}

export async function searchNearbyPlaces(
  category: string,
  latitude: number,
  longitude: number,
  limit = 18,
): Promise<WorldPlaceResult[]> {
  try {
    const result = await apiRequest<{ data: WorldPlaceResult[] }>(buildQuery("/api/places/nearby", {
      category,
      lat: latitude,
      lon: longitude,
      limit,
    }));
    return dedupe(result.data).slice(0, limit);
  } catch {
    return overpassFallback(category, latitude, longitude, limit);
  }
}

async function overpassFallback(category: string, latitude: number, longitude: number, limit: number): Promise<WorldPlaceResult[]> {
  try {
    const radius = category === "hiking" ? 12000 : category === "parks" ? 8000 : 6000;
    const around = `(around:${radius},${latitude},${longitude})`;
    const selectors: Record<string, string[]> = {
      cafes: [`node[amenity=cafe]${around};`,`way[amenity=cafe]${around};`],
      food: [`node[amenity=restaurant]${around};`,`node[amenity=fast_food]${around};`,`way[amenity=restaurant]${around};`],
      shopping: [`node[shop]${around};`,`way[shop]${around};`],
      hiking: [`node[tourism=viewpoint]${around};`,`node[information=trailhead]${around};`,`way[highway=path]${around};`],
      work: [`node[amenity=coworking_space]${around};`,`node[office]${around};`,`way[office]${around};`],
      parks: [`node[leisure=park]${around};`,`way[leisure=park]${around};`,`way[leisure=garden]${around};`],
    };
    const body = `[out:json][timeout:10];(${(selectors[category] ?? selectors.parks).join("")});out center ${Math.max(limit*3,24)};`;
    const res = await fetch("https://overpass-api.de/api/interpreter", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}, body:`data=${encodeURIComponent(body)}` });
    if (!res.ok) return [];
    const json = await res.json() as { elements?: Array<{ id?: number; type?: string; lat?: number; lon?: number; center?: {lat?:number;lon?:number}; tags?: Record<string,string> }> };
    const items = (json.elements ?? []).flatMap((e,index) => {
      const lat = Number(e.lat ?? e.center?.lat), lon = Number(e.lon ?? e.center?.lon); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return [];
      const tags=e.tags ?? {}; const name=(tags.name || tags.brand || tags.operator || categoryLabel(category)).trim();
      const city=tags["addr:city"] || tags["addr:suburb"] || null; const street=[tags["addr:housenumber"],tags["addr:street"]].filter(Boolean).join(" ");
      const display=[name,street,city].filter(Boolean).join(", ");
      return [{id:`overpass-${e.type??"node"}-${e.id??index}`,name,displayName:display||name,city,country:null,latitude:lat,longitude:lon,category} satisfies WorldPlaceResult];
    });
    return dedupe(items).slice(0,limit);
  } catch { return []; }
}
function categoryLabel(category:string){ return category === "cafes" ? "Cafe" : category === "food" ? "Restaurant" : category === "shopping" ? "Shop" : category === "hiking" ? "Trail" : category === "work" ? "Workplace" : "Park"; }

function parseCategorySearch(text: string): { category: string; location: string } | null {
  const normalized = text.trim();
  const match = normalized.match(/^(cafes?|coffee|restaurants?|food|shops?|shopping|malls?|hiking|trails?|coworking|work|parks?|gardens?)\s+(?:in|near|around)\s+(.+)$/i);
  if (!match) return null;
  const keyword = match[1].toLowerCase();
  const location = match[2].trim();
  if (!location) return null;
  const category = keyword.startsWith("cafe") || keyword === "coffee" ? "cafes"
    : keyword.startsWith("restaurant") || keyword === "food" ? "food"
    : keyword.startsWith("shop") || keyword.startsWith("mall") ? "shopping"
    : keyword.startsWith("hik") || keyword.startsWith("trail") ? "hiking"
    : keyword.startsWith("work") || keyword.startsWith("cowork") ? "work"
    : "parks";
  return { category, location };
}

async function photonFallback(text: string, bias: PlaceBias, limit: number): Promise<WorldPlaceResult[]> {
  try {
    const params = new URLSearchParams({ q: text, limit: String(limit) });
    if (bias) {
      params.set("lat", String(bias.latitude));
      params.set("lon", String(bias.longitude));
    }
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json() as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, unknown>;
      }>;
    };
    return dedupe((payload.features ?? []).flatMap((feature, index) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates) return [];
      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const p = feature.properties ?? {};
      const name = clean(p.name) || clean(p.street) || clean(p.city) || clean(p.state) || clean(p.country) || "Location";
      const city = clean(p.city) || clean(p.state);
      const country = clean(p.country);
      const displayName = [name, clean(p.street), city, clean(p.state), country]
        .filter(Boolean)
        .filter((value, position, values) => values.indexOf(value) === position)
        .join(", ");
      return [{
        id: `${clean(p.osm_type) ?? "place"}-${String(p.osm_id ?? `${latitude}-${longitude}-${index}`)}`,
        name,
        displayName: displayName || name,
        city,
        country,
        latitude,
        longitude,
      } satisfies WorldPlaceResult];
    })).slice(0, limit);
  } catch {
    return [];
  }
}

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dedupe(items: WorldPlaceResult[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}:${item.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
