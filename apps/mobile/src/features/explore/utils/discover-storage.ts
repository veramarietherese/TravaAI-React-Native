import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DiscoverPlace } from "../components/DiscoverMap.types";

const SAVED_PLACES_KEY = "trava:discover:saved-places:v4";
const CONTEXT_KEY = "trava:discover:context:v4";
const RECENTS_KEY = "trava:discover:recents:v4";
const LOCATION_PROMPT_KEY = "trava:discover:location-prompt:v4";

export type ExplorationContext = {
  label: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  country?: string | null;
  source: "manual" | "trip" | "persisted" | "fallback";
};

export async function readSavedPlaces(): Promise<DiscoverPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_PLACES_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter(isPlace).slice(0, 200) : [];
  } catch {
    return [];
  }
}

export async function writeSavedPlaces(places: DiscoverPlace[]) {
  const deduped = places.filter((place, index, values) => values.findIndex((other) => stablePlaceKey(other) === stablePlaceKey(place)) === index).slice(0, 200);
  await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(deduped));
}

export async function toggleSavedPlace(place: DiscoverPlace) {
  const current = await readSavedPlaces();
  const key = stablePlaceKey(place);
  const exists = current.some((item) => stablePlaceKey(item) === key);
  const next = exists ? current.filter((item) => stablePlaceKey(item) !== key) : [place, ...current];
  await writeSavedPlaces(next);
  return { saved: !exists, places: next };
}

// Compatibility for older callers.
export async function savePinnedPlace(place: DiscoverPlace) {
  const current = await readSavedPlaces();
  if (!current.some((item) => stablePlaceKey(item) === stablePlaceKey(place))) await writeSavedPlaces([place, ...current]);
}

export async function readSavedPlaceIds() {
  return (await readSavedPlaces()).map((place) => stablePlaceKey(place));
}

export async function readExplorationContext(): Promise<ExplorationContext | null> {
  try {
    const raw = await AsyncStorage.getItem(CONTEXT_KEY);
    const value = raw ? JSON.parse(raw) as unknown : null;
    return isContext(value) ? { ...value, source: "persisted" } : null;
  } catch {
    return null;
  }
}

export async function writeExplorationContext(context: ExplorationContext) {
  // Exploration context is a manually chosen/derived city center, not GPS history.
  await AsyncStorage.setItem(CONTEXT_KEY, JSON.stringify({ ...context, source: context.source === "manual" ? "manual" : "persisted" }));
  await addRecentExploration(context);
}

export async function readRecentExplorations(): Promise<ExplorationContext[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const value = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(value) ? value.filter(isContext).slice(0, 6) : [];
  } catch {
    return [];
  }
}

async function addRecentExploration(context: ExplorationContext) {
  const current = await readRecentExplorations();
  const normalized = context.label.trim().toLowerCase();
  const next = [{ ...context, source: "manual" as const }, ...current.filter((item) => item.label.trim().toLowerCase() !== normalized)].slice(0, 6);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export async function readLocationPromptDismissed() {
  return (await AsyncStorage.getItem(LOCATION_PROMPT_KEY)) === "dismissed";
}

export async function dismissLocationPrompt() {
  await AsyncStorage.setItem(LOCATION_PROMPT_KEY, "dismissed");
}

export function stablePlaceKey(place: Pick<DiscoverPlace, "provider" | "providerId" | "id">) {
  return `${place.provider || "osm"}:${place.providerId || place.id}`;
}

function isPlace(value: unknown): value is DiscoverPlace {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DiscoverPlace>;
  return (item.provider === "osm" || item.provider == null) && typeof item.name === "string" && typeof item.latitude === "number" && typeof item.longitude === "number";
}

function isContext(value: unknown): value is ExplorationContext {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ExplorationContext>;
  return typeof item.label === "string" && typeof item.latitude === "number" && Number.isFinite(item.latitude) && typeof item.longitude === "number" && Number.isFinite(item.longitude);
}
