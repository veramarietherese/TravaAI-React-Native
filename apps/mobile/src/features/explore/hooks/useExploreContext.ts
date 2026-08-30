import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

import { searchWorldPlaces, reversePlaceLabel } from "@/features/maps/utils/world-place-search";
import { listTrips } from "@/features/trips/api/trips.api";
import { DEFAULT_EXPLORATION } from "../data/explore-categories";
import {
  dismissLocationPrompt,
  readExplorationContext,
  readLocationPromptDismissed,
  readRecentExplorations,
  writeExplorationContext,
  type ExplorationContext,
} from "../utils/discover-storage";

export type DeviceLocationStatus = "unknown" | "requesting" | "granted" | "denied" | "blocked" | "unavailable" | "timeout" | "error";

type DeviceLocation = { latitude: number; longitude: number; accuracy?: number | null };

const FALLBACK: ExplorationContext = {
  ...DEFAULT_EXPLORATION,
  city: "Cebu City",
  country: "Philippines",
  source: "fallback",
};

export function useExploreContext() {
  const [context, setContext] = useState<ExplorationContext>(FALLBACK);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<DeviceLocationStatus>("unknown");
  const [recent, setRecent] = useState<ExplorationContext[]>([]);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const bootstrap = useRef(false);

  useEffect(() => {
    if (bootstrap.current) return;
    bootstrap.current = true;
    let live = true;
    void (async () => {
      const [stored, recents, dismissed] = await Promise.all([
        readExplorationContext(),
        readRecentExplorations(),
        readLocationPromptDismissed(),
      ]);
      if (!live) return;
      setRecent(recents);
      setPromptDismissed(dismissed);
      if (stored) {
        setContext(stored);
        setHydrated(true);
        return;
      }

      // GPS is deliberately NOT part of bootstrap. Prefer an active trip destination,
      // then the safe exploration fallback so Discover always renders.
      try {
        const trips = await listTrips();
        const active = trips.find((trip) => trip.status === "ongoing") ?? trips.find((trip) => trip.status === "upcoming");
        if (active?.destination) {
          const matches = await searchWorldPlaces(active.destination, null, 3);
          const match = matches[0];
          if (match && live) {
            setContext({
              label: [match.name, match.city, match.country].filter(Boolean).filter(unique).join(", "),
              latitude: match.latitude,
              longitude: match.longitude,
              city: match.city ?? null,
              country: match.country ?? null,
              source: "trip",
            });
          }
        }
      } catch {
        // The fallback remains a valid manual exploration context.
      } finally {
        if (live) setHydrated(true);
      }
    })();
    return () => { live = false; };
  }, []);

  const selectExploration = useCallback(async (next: ExplorationContext) => {
    const normalized = { ...next, source: "manual" as const };
    setContext(normalized);
    await writeExplorationContext(normalized);
    setRecent(await readRecentExplorations());
  }, []);

  const useCurrentLocation = useCallback(async () => {
    setLocationStatus("requesting");
    try {
      const services = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!services) {
        setLocationStatus("unavailable");
        return { ok: false as const, reason: "unavailable" as const };
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationStatus(permission.canAskAgain === false ? "blocked" : "denied");
        return { ok: false as const, reason: permission.canAskAgain === false ? "blocked" as const : "denied" as const };
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "timeout" })), 10_000)),
      ]);
      const coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setDeviceLocation(coordinate);
      setLocationStatus("granted");
      const label = await reversePlaceLabel(coordinate).catch(() => ({ label: "Current area", city: null, country: null }));
      const next: ExplorationContext = {
        label: label.label,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        city: label.city,
        country: label.country,
        source: "manual",
      };
      await selectExploration(next);
      return { ok: true as const, coordinate, context: next };
    } catch (error) {
      const timedOut = error instanceof Error && ((error as Error & { code?: string }).code === "timeout" || /timeout/i.test(error.message));
      setLocationStatus(timedOut ? "timeout" : "error");
      return { ok: false as const, reason: timedOut ? "timeout" as const : "error" as const };
    }
  }, [selectExploration]);

  const dismissPrompt = useCallback(async () => {
    setPromptDismissed(true);
    await dismissLocationPrompt();
  }, []);

  return {
    context,
    hydrated,
    deviceLocation,
    locationStatus,
    recent,
    promptDismissed,
    selectExploration,
    useCurrentLocation,
    dismissPrompt,
  };
}

function unique(value: unknown, index: number, values: unknown[]) {
  return values.indexOf(value) === index;
}
