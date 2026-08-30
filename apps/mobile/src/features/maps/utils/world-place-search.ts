import { apiRequest } from "@/lib/api-client";
import type { Coordinates, DiscoverPlace, MapRoute, PlaceImage, TravelMode } from "@/features/explore/components/DiscoverMap.types";

export type PlaceBias = Coordinates | null | undefined;

export interface WorldPlaceResult {
  id: string;
  provider?: "osm";
  providerId?: string;
  osmType?: "node" | "way" | "relation" | null;
  osmId?: number | null;
  name: string;
  displayName: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
  category?: string | null;
  openingHours?: string | null;
  website?: string | null;
  phone?: string | null;
  sourceUrl?: string | null;
  imageRefs?: DiscoverPlace["imageRefs"];
  imageUrl?: string | null;
}

export async function searchWorldPlaces(
  query: string,
  origin?: PlaceBias,
  limit = 10,
  signal?: AbortSignal,
): Promise<WorldPlaceResult[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const params = new URLSearchParams({ q: text, limit: String(Math.max(1, Math.min(25, limit))) });
  if (origin) {
    params.set("lat", String(origin.latitude));
    params.set("lon", String(origin.longitude));
  }
  const result = await apiRequest<{ data: WorldPlaceResult[] }>(`/api/places/search?${params.toString()}`, { signal });
  return result.data;
}

export async function searchNearbyPlaces(
  category: string,
  latitude: number,
  longitude: number,
  limit = 24,
  options?: { radiusMeters?: number; signal?: AbortSignal; quality?: "fast" | "full" },
): Promise<WorldPlaceResult[]> {
  const params = new URLSearchParams({
    category,
    lat: String(latitude),
    lon: String(longitude),
    radius: String(options?.radiusMeters ?? 8_000),
    limit: String(Math.max(1, Math.min(50, limit))),
    quality: options?.quality ?? "fast",
  });
  const timeoutMs = (options?.quality ?? "fast") === "fast" ? 4_500 : 8_500;
  const result = await apiRequest<{ data: WorldPlaceResult[] }>(`/api/places/nearby?${params.toString()}`, { signal: options?.signal }, timeoutMs);
  return result.data;
}

export async function reversePlaceLabel(coordinate: Coordinates, signal?: AbortSignal) {
  const params = new URLSearchParams({ lat: String(coordinate.latitude), lon: String(coordinate.longitude) });
  const result = await apiRequest<{ data: { label: string; city: string | null; country: string | null } }>(`/api/places/reverse?${params.toString()}`, { signal });
  return result.data;
}

export async function fetchMapRoute(origin: Coordinates, destination: Coordinates, mode: TravelMode, signal?: AbortSignal): Promise<MapRoute> {
  const params = new URLSearchParams({
    originLat: String(origin.latitude),
    originLon: String(origin.longitude),
    destinationLat: String(destination.latitude),
    destinationLon: String(destination.longitude),
    mode,
  });
  const result = await apiRequest<{ data: MapRoute }>(`/api/places/route?${params.toString()}`, { signal });
  return result.data;
}

export async function resolveVerifiedPlaceImages(places: DiscoverPlace[], signal?: AbortSignal) {
  if (!places.length) return new Map<string, PlaceImage | null>();
  const result = await apiRequest<{ data: Array<{ id: string; image: PlaceImage | null }> }>("/api/places/images", {
    method: "POST",
    signal,
    body: JSON.stringify({
      places: places.slice(0, 20).map((place) => ({
        id: place.id,
        provider: place.provider,
        providerId: place.providerId,
        osmType: place.osmType ?? null,
        osmId: place.osmId ?? null,
        imageRefs: place.imageRefs ?? null,
      })),
    }),
  }, 20_000);
  return new Map(result.data.map((item) => [item.id, item.image]));
}

export function worldResultToDiscoverPlace(item: WorldPlaceResult, origin?: Coordinates | null): DiscoverPlace {
  return {
    id: item.id,
    provider: item.provider ?? "osm",
    providerId: item.providerId ?? item.id,
    osmType: item.osmType ?? null,
    osmId: item.osmId ?? null,
    name: item.name,
    subtitle: item.displayName || item.address || [item.city, item.country].filter(Boolean).join(", ") || "Mapped place",
    address: item.address ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
    category: item.category || "Place",
    city: item.city ?? null,
    country: item.country ?? null,
    distanceMeters: origin ? haversineMeters(origin.latitude, origin.longitude, item.latitude, item.longitude) : null,
    openingHours: item.openingHours ?? null,
    website: item.website ?? null,
    phone: item.phone ?? null,
    sourceUrl: item.sourceUrl ?? null,
    imageRefs: item.imageRefs ?? null,
    image: null,
  };
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
