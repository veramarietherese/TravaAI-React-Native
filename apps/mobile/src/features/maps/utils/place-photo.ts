import type { DiscoverPlace, PlaceImage } from "@/features/explore/components/DiscoverMap.types";
import { resolveVerifiedPlaceImages, worldResultToDiscoverPlace, type WorldPlaceResult } from "./world-place-search";

const cache = new Map<string, PlaceImage | null>();

type PlaceLike = DiscoverPlace | WorldPlaceResult;

/**
 * Resolves images only when the backend can prove an entity relationship
 * through OSM -> Wikimedia/Wikidata/Wikipedia metadata. No fuzzy image search.
 */
export async function resolveFreePlaceImage(placeLike: PlaceLike): Promise<string | null> {
  const place = toDiscover(placeLike);
  if (place.image?.verifiedEntityMatch) return place.image.thumbnailUrl || place.image.url;
  if (cache.has(place.id)) {
    const cached = cache.get(place.id) ?? null;
    return cached?.thumbnailUrl || cached?.url || null;
  }
  const images = await resolveVerifiedPlaceImages([place]);
  const image = images.get(place.id) ?? null;
  cache.set(place.id, image);
  return image?.thumbnailUrl || image?.url || null;
}

export async function hydrateVerifiedPlaceImages(places: DiscoverPlace[], signal?: AbortSignal) {
  const unresolved = places.filter((place) => !cache.has(place.id) && !place.image?.verifiedEntityMatch);
  if (unresolved.length) {
    const images = await resolveVerifiedPlaceImages(unresolved, signal);
    images.forEach((image, id) => cache.set(id, image));
  }
  return places.map((place) => ({ ...place, image: place.image ?? cache.get(place.id) ?? null }));
}

/** Backward-compatible helper for older callers. A missing verified image returns an empty URL, never unrelated stock photography. */
export async function hydratePlacePhotos<T extends WorldPlaceResult>(items: T[], _concurrency = 4): Promise<Array<T & { imageUrl: string }>> {
  const places = items.map((item) => worldResultToDiscoverPlace(item, null));
  const hydrated = await hydrateVerifiedPlaceImages(places);
  const byId = new Map(hydrated.map((place) => [place.id, place.image?.thumbnailUrl || place.image?.url || ""]));
  return items.map((item) => ({ ...item, imageUrl: byId.get(item.id) || "" }));
}

function toDiscover(value: PlaceLike): DiscoverPlace {
  return "subtitle" in value ? value : worldResultToDiscoverPlace(value, null);
}
