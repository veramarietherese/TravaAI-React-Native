import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "trava-discover-saved-v1";
export async function readSavedPlaces(): Promise<string[]> {
  try { const raw = await AsyncStorage.getItem(KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []; } catch { return []; }
}
export async function writeSavedPlaces(ids: string[]): Promise<void> { try { await AsyncStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* local save is best-effort */ } }
