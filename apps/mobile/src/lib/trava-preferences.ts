import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type TravaPreferences = {
  realtimeNotifications: boolean;
  discoverLocation: boolean;
  placePhotos: boolean;
};

const STORAGE_KEY = "trava:preferences:v1";
const DEFAULTS: TravaPreferences = {
  realtimeNotifications: true,
  discoverLocation: true,
  placePhotos: true,
};

let memory: TravaPreferences = DEFAULTS;
let hydrated = false;
const listeners = new Set<(value: TravaPreferences) => void>();

function publish(next: TravaPreferences) {
  memory = next;
  listeners.forEach((listener) => listener(next));
}

export async function readTravaPreferences(): Promise<TravaPreferences> {
  if (hydrated) return memory;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as Partial<TravaPreferences>;
    memory = {
      realtimeNotifications: parsed.realtimeNotifications !== false,
      discoverLocation: parsed.discoverLocation !== false,
      placePhotos: parsed.placePhotos !== false,
    };
  } catch {
    memory = DEFAULTS;
  }
  return memory;
}

export async function setTravaPreference<K extends keyof TravaPreferences>(
  key: K,
  value: TravaPreferences[K],
) {
  const next = { ...memory, [key]: value };
  publish(next);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function useTravaPreferences() {
  const [preferences, setPreferences] = useState(memory);
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    let active = true;
    const listener = (value: TravaPreferences) => { if (active) setPreferences(value); };
    listeners.add(listener);
    void readTravaPreferences().then((value) => {
      if (!active) return;
      setPreferences(value);
      setReady(true);
    });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback(<K extends keyof TravaPreferences>(key: K, value: TravaPreferences[K]) => {
    void setTravaPreference(key, value);
  }, []);

  return { preferences, ready, update };
}
