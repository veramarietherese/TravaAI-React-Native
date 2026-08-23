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
  try {
    const result = await apiRequest<{ data: WorldPlaceResult[] }>(buildQuery("/api/places/search", {
      q: text,
      lat: bias?.latitude,
      lon: bias?.longitude,
      limit,
    }));
    return dedupe(result.data).slice(0, limit);
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
    return [];
  }
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
