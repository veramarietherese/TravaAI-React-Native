import { useEffect, useMemo, useRef, useState } from "react";

import { hydrateVerifiedPlaceImages } from "@/features/maps/utils/place-photo";
import { searchNearbyPlaces, worldResultToDiscoverPlace } from "@/features/maps/utils/world-place-search";
import type { Coordinates, DiscoverPlace } from "../components/DiscoverMap.types";
import { categoryApi, type ExploreCategory } from "../data/explore-categories";

type CachedNearby = { savedAt: number; places: DiscoverPlace[] };

const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map<string, CachedNearby>();

export function useExplorePlaces(center: Coordinates, category: ExploreCategory, radiusMeters: number, limit = 24) {
  const cacheKey = useMemo(
    () => `${categoryApi(category)}:${center.latitude.toFixed(4)}:${center.longitude.toFixed(4)}:${radiusMeters}:${limit}`,
    [category, center.latitude, center.longitude, radiusMeters, limit],
  );
  const cached = readCache(cacheKey);
  const [places, setPlaces] = useState<DiscoverPlace[]>(cached?.places ?? []);
  const [loading, setLoading] = useState(!cached?.places.length);
  const [refreshing, setRefreshing] = useState(Boolean(cached?.places.length));
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let live = true;
    let imageTimer: ReturnType<typeof setTimeout> | null = null;

    const freshCache = readCache(cacheKey);
    const cachedPlaces = freshCache?.places ?? [];
    if (cachedPlaces.length) {
      setPlaces(cachedPlaces);
      setLoading(false);
      setRefreshing(true);
    } else {
      setPlaces([]);
      setLoading(true);
      setRefreshing(false);
    }
    setRefining(false);
    setError(null);

    const updatePlaces = (incoming: DiscoverPlace[], preferIncoming = true) => {
      if (!live || !incoming.length) return;
      setPlaces((current) => {
        const merged = mergePlaces(current, incoming, limit, preferIncoming);
        writeCache(cacheKey, merged);
        return merged;
      });
    };

    const hydrateImagesLater = (items: DiscoverPlace[]) => {
      if (!items.length || !live) return;
      if (imageTimer) clearTimeout(imageTimer);
      imageTimer = setTimeout(() => {
        if (!live || controller.signal.aborted) return;
        void hydrateVerifiedPlaceImages(items.slice(0, 8), controller.signal)
          .then((hydrated) => {
            if (!live || controller.signal.aborted) return;
            updatePlaces(hydrated, true);
          })
          .catch(() => {});
      }, 650);
    };

    void (async () => {
      let fastSucceeded = false;
      try {
        const fast = await searchNearbyPlaces(categoryApi(category), center.latitude, center.longitude, limit, {
          radiusMeters,
          signal: controller.signal,
          quality: "fast",
        });
        if (!live || controller.signal.aborted) return;
        const mapped = fast.map((item) => worldResultToDiscoverPlace(item, center));
        fastSucceeded = mapped.length > 0;
        if (mapped.length) {
          setPlaces(mapped);
          writeCache(cacheKey, mapped);
          hydrateImagesLater(mapped);
        }
      } catch {
        // The fast pass is opportunistic. A full OSM refinement still runs below.
      } finally {
        if (live && !controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }

      if (!live || controller.signal.aborted) return;
      setRefining(true);

      try {
        const full = await searchNearbyPlaces(categoryApi(category), center.latitude, center.longitude, limit, {
          radiusMeters,
          signal: controller.signal,
          quality: "full",
        });
        if (!live || controller.signal.aborted) return;
        const mapped = full.map((item) => worldResultToDiscoverPlace(item, center));
        if (mapped.length) {
          updatePlaces(mapped, true);
          hydrateImagesLater(mapped);
        } else if (!fastSucceeded && !readCache(cacheKey)?.places.length) {
          setError(null);
        }
      } catch {
        if (!live || controller.signal.aborted) return;
        if (!fastSucceeded && !readCache(cacheKey)?.places.length) {
          setError("We couldn’t load places right now.");
        }
      } finally {
        if (live && !controller.signal.aborted) {
          setRefining(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      live = false;
      if (imageTimer) clearTimeout(imageTimer);
      controller.abort();
    };
  }, [cacheKey, center.latitude, center.longitude, category, radiusMeters, limit, version]);

  const retry = () => setVersion((value) => value + 1);
  const hasResults = places.length > 0;
  const selectedDefaultId = useMemo(() => places[0]?.id ?? null, [places]);

  return { places, setPlaces, loading, refreshing, refining, error, retry, hasResults, selectedDefaultId };
}

function readCache(key: string) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.savedAt > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item;
}

function writeCache(key: string, places: DiscoverPlace[]) {
  memoryCache.set(key, { savedAt: Date.now(), places });
  while (memoryCache.size > 30) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (!oldest) break;
    memoryCache.delete(oldest);
  }
}

function mergePlaces(current: DiscoverPlace[], incoming: DiscoverPlace[], limit: number, preferIncoming: boolean) {
  const byId = new Map<string, DiscoverPlace>();
  const add = (place: DiscoverPlace) => {
    const previous = byId.get(place.id);
    if (!previous) {
      byId.set(place.id, place);
      return;
    }
    const preferred = preferIncoming ? place : previous;
    const secondary = preferIncoming ? previous : place;
    byId.set(place.id, {
      ...secondary,
      ...preferred,
      image: preferred.image ?? secondary.image ?? null,
      imageRefs: preferred.imageRefs ?? secondary.imageRefs ?? null,
    });
  };
  current.forEach(add);
  incoming.forEach(add);
  return [...byId.values()]
    .sort((a, b) => (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY))
    .slice(0, limit);
}
