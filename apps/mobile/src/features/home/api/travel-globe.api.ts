import { apiRequest } from "@/lib/api-client";
import { getSupabaseClient } from "@/lib/supabase";

import { GLOBE_COUNTRY_BY_CODE } from "../data/globe-country-data";
import type {
  HomeTravelRoute,
  HomeTravelRouteInput,
} from "../types/home.types";

interface TravelRoutesEnvelope {
  data: HomeTravelRoute[];
}

interface TravelRouteEnvelope {
  data: HomeTravelRoute;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRoute(row: Record<string, unknown>): HomeTravelRoute {
  return {
    id: String(row.id ?? ""),
    originCode: String(row.origin_code ?? ""),
    originName: String(row.origin_name ?? "Unknown country"),
    originLat: numberValue(row.origin_lat),
    originLng: numberValue(row.origin_lng),
    destinationCode: String(row.destination_code ?? ""),
    destinationName: String(row.destination_name ?? "Unknown country"),
    destinationLat: numberValue(row.destination_lat),
    destinationLng: numberValue(row.destination_lng),
    distanceKm: numberValue(row.distance_km),
    traveledAt: String(row.traveled_at ?? new Date().toISOString().slice(0, 10)),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

async function getSessionUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user.id) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return session.user.id;
}

export async function fetchTravelRoutes(): Promise<HomeTravelRoute[]> {
  try {
    const response = await apiRequest<TravelRoutesEnvelope>("/api/home/travel-routes");
    return response.data;
  } catch (apiError) {
    console.warn("Travel route API unavailable; using Supabase RLS fallback.", apiError);
    const supabase = getSupabaseClient();
    await getSessionUserId();
    const { data, error } = await supabase
      .from("travel_routes")
      .select("*")
      .order("traveled_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message || "Unable to load your travel routes.");
    return Array.isArray(data)
      ? data.map((row) => normalizeRoute(row as Record<string, unknown>))
      : [];
  }
}

export async function createTravelRoute(
  input: HomeTravelRouteInput,
): Promise<HomeTravelRoute> {
  const origin = GLOBE_COUNTRY_BY_CODE.get(input.originCode.toUpperCase());
  const destination = GLOBE_COUNTRY_BY_CODE.get(input.destinationCode.toUpperCase());

  if (!origin || !destination) throw new Error("Choose two valid countries.");
  if (origin.code === destination.code) {
    throw new Error("Origin and destination must be different countries.");
  }

  try {
    const response = await apiRequest<TravelRouteEnvelope>("/api/home/travel-routes", {
      method: "POST",
      body: JSON.stringify({
        originCode: origin.code,
        destinationCode: destination.code,
        traveledAt: input.traveledAt,
      }),
    });
    return response.data;
  } catch (apiError) {
    console.warn("Travel route API unavailable; using Supabase RLS fallback.", apiError);
    const supabase = getSupabaseClient();
    const userId = await getSessionUserId();
    const { data, error } = await supabase
      .from("travel_routes")
      .insert({
        user_id: userId,
        origin_code: origin.code,
        origin_name: origin.name,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_code: destination.code,
        destination_name: destination.name,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        traveled_at: input.traveledAt || new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to save this travel route.");
    }
    return normalizeRoute(data as Record<string, unknown>);
  }
}

export async function deleteTravelRoute(routeId: string): Promise<void> {
  if (!routeId) return;
  try {
    await apiRequest<{ data: { deleted: true } }>(
      `/api/home/travel-routes/${encodeURIComponent(routeId)}`,
      { method: "DELETE" },
    );
  } catch (apiError) {
    console.warn("Travel route API unavailable; using Supabase RLS fallback.", apiError);
    const supabase = getSupabaseClient();
    await getSessionUserId();
    const { error } = await supabase.from("travel_routes").delete().eq("id", routeId);
    if (error) throw new Error(error.message || "Unable to remove this travel route.");
  }
}
