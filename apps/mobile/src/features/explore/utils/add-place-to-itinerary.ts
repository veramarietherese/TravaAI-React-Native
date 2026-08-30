import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TripSummary } from "@trava/shared";

import { createActivity } from "@/features/itinerary/api/itinerary.api";
import type { DiscoverPlace } from "../components/DiscoverMap.types";

export async function addDiscoverPlaceToItinerary(input: {
  trip: TripSummary;
  place: DiscoverPlace;
  dayNumber: number;
  startTime: string;
}) {
  const dayNumber = Math.max(1, Math.floor(input.dayNumber));
  const startTime = normalizeTime(input.startTime);
  const activityDate = dateForDay(input.trip.startDate, dayNumber);
  const category = toActivityCategory(input.place.category);
  const localActivity = {
    id: `a-discover-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dayNumber,
    title: input.place.name,
    category,
    locationName: input.place.name,
    detail: input.place.subtitle,
    latitude: input.place.latitude,
    longitude: input.place.longitude,
    startTime,
    estimatedCost: 0,
    placeProvider: input.place.provider,
    placeProviderId: input.place.providerId,
  };

  await appendLocalWorkspace(input.trip, localActivity);

  let serverSynced = false;
  try {
    await createActivity(input.trip.id, {
      dayNumber,
      activityDate,
      title: input.place.name,
      category,
      locationName: input.place.subtitle || input.place.name,
      latitude: input.place.latitude,
      longitude: input.place.longitude,
      startTime,
      endTime: null,
      notes: null,
      estimatedCost: 0,
    });
    serverSynced = true;
  } catch {
    // Local-first workspace preserves the user's addition when the API is unavailable.
  }

  return { serverSynced };
}

async function appendLocalWorkspace(trip: TripSummary, activity: Record<string, unknown>) {
  const safeTripId = trip.id || "local-trip";
  const v2 = `trava:pixel-workspace:v2:${safeTripId}`;
  const v1 = `trava:pixel-workspace:v1:${safeTripId}`;
  const rawV2 = await AsyncStorage.getItem(v2);
  const rawV1 = rawV2 ? null : await AsyncStorage.getItem(v1);
  const raw = rawV2 ?? rawV1;
  const targetKey = rawV2 ? v2 : rawV1 ? v1 : v2;
  let state: Record<string, unknown>;
  try {
    state = raw ? JSON.parse(raw) as Record<string, unknown> : {
      totalBudget: Number(trip.totalBudget || 0), activities: [], expenses: [], checklist: [], documents: [],
    };
  } catch {
    state = { totalBudget: Number(trip.totalBudget || 0), activities: [], expenses: [], checklist: [], documents: [] };
  }
  const activities = Array.isArray(state.activities) ? state.activities : [];
  state.activities = [...activities, activity];
  await AsyncStorage.setItem(targetKey, JSON.stringify(state));
}

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "09:00";
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function dateForDay(startDate: string | null, dayNumber: number) {
  if (!startDate) return null;
  const date = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
}
function toActivityCategory(category: string): "flight" | "stay" | "food" | "sightseeing" | "transport" | "shopping" | "meeting" | "other" {
  const value = category.toLowerCase();
  if (value.includes("food") || value.includes("cafe") || value.includes("café") || value.includes("restaurant")) return "food";
  if (value.includes("hotel") || value.includes("hostel") || value.includes("stay")) return "stay";
  if (value.includes("transport") || value.includes("station") || value.includes("airport")) return "transport";
  if (value.includes("shop")) return "shopping";
  if (value.includes("park") || value.includes("activity") || value.includes("attraction") || value.includes("sight")) return "sightseeing";
  return "other";
}
