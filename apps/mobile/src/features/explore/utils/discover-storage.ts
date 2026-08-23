import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DiscoverPlace } from "../components/DiscoverMap.types";

const SAVED_IDS_KEY = "trava:discover:saved-ids:v2";
const SAVED_PLACES_KEY = "trava:discover:saved-places:v2";

export async function readSavedPlaces(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function writeSavedPlaces(ids: string[]) {
  await AsyncStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...new Set(ids)]));
}

export async function savePinnedPlace(place: DiscoverPlace) {
  try {
    const raw = await AsyncStorage.getItem(SAVED_PLACES_KEY);
    const parsed = raw ? JSON.parse(raw) as DiscoverPlace[] : [];
    const next = [place, ...parsed.filter((item) => item.id !== place.id)].slice(0, 100);
    await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
  } catch {}
}
