import { Linking } from "react-native";

import { apiRequest } from "@/lib/api-client";

export type TravaTravelMode = "drive" | "walk" | "transit";
export type MapCoordinate = { latitude: number; longitude: number };

export type TravaRoute = {
  mode: Exclude<TravaTravelMode, "transit">;
  coordinates: MapCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  source: "openstreetmap-routing";
};

const cache = new Map<string, { at: number; route: TravaRoute }>();
const CACHE_TTL = 5 * 60 * 1000;

function buildQuery(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

export async function fetchTravaRoute(
  origin: MapCoordinate,
  destination: MapCoordinate,
  mode: Exclude<TravaTravelMode, "transit">,
): Promise<TravaRoute | null> {
  const key = [
    mode,
    origin.latitude.toFixed(4),
    origin.longitude.toFixed(4),
    destination.latitude.toFixed(4),
    destination.longitude.toFixed(4),
  ].join(":");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.route;

  try {
    const result = await apiRequest<{ data: TravaRoute }>(
      `/api/places/route?${buildQuery({
        fromLat: origin.latitude,
        fromLon: origin.longitude,
        toLat: destination.latitude,
        toLon: destination.longitude,
        mode,
      })}`,
    );
    const route = result.data;
    if (!route?.coordinates?.length || route.coordinates.length < 2) return null;
    cache.set(key, { at: Date.now(), route });
    if (cache.size > 60) cache.delete(cache.keys().next().value ?? key);
    return route;
  } catch {
    return null;
  }
}

export async function openAppleMapsDirections(
  destination: MapCoordinate,
  mode: TravaTravelMode,
  origin?: MapCoordinate | null,
  destinationName?: string,
) {
  const flag = mode === "walk" ? "w" : mode === "transit" ? "r" : "d";
  const params = new URLSearchParams();
  if (origin) params.set("saddr", `${origin.latitude},${origin.longitude}`);
  params.set("daddr", `${destination.latitude},${destination.longitude}`);
  params.set("dirflg", flag);
  if (destinationName) params.set("q", destinationName);
  const url = `https://maps.apple.com/?${params.toString()}`;
  await Linking.openURL(url);
}

export function formatRouteDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatRouteDistance(meters: number) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function arrivalTime(seconds: number) {
  const date = new Date(Date.now() + Math.max(0, seconds) * 1000);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
