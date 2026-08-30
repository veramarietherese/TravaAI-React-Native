import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

type OsmType = "node" | "way" | "relation";
type TravelMode = "driving" | "walking" | "cycling";

type OpenPlace = {
  id: string;
  provider: "osm";
  providerId: string;
  osmType: OsmType | null;
  osmId: number | null;
  name: string;
  displayName: string;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  category: string;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  sourceUrl: string | null;
  imageRefs: {
    wikimediaCommons?: string;
    wikidata?: string;
    wikipedia?: string;
  } | null;
};

type PlaceImage = {
  url: string;
  thumbnailUrl: string | null;
  source: "wikimedia";
  sourceEntityId: string | null;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  attributionText: string | null;
  sourceUrl: string | null;
  verifiedEntityMatch: true;
};

type CacheEntry<T> = { createdAt: number; ttlMs: number; data: T };

const APP_USER_AGENT = "TravaAI/1.0 (travel discovery; open-data client)";
const REQUEST_TIMEOUT_MS = 9_000;
const cache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_ENTRIES = 500;
const NORMAL_TTL = 10 * 60 * 1000;
const IMAGE_TTL = 24 * 60 * 60 * 1000;
const IMAGE_MISS_TTL = 6 * 60 * 60 * 1000;

const nearbySchema = z.object({
  category: z.string().trim().max(40).default("all"),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(500).max(25_000).default(8_000),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  quality: z.enum(["fast", "full"]).default("fast"),
});

const searchSchema = z.object({
  q: z.string().trim().min(2).max(140),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(12),
});

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const routeSchema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLon: z.coerce.number().min(-180).max(180),
  destinationLat: z.coerce.number().min(-90).max(90),
  destinationLon: z.coerce.number().min(-180).max(180),
  mode: z.enum(["driving", "walking", "cycling"]).default("driving"),
});

const imageInputSchema = z.object({
  id: z.string().min(1).max(120),
  provider: z.literal("osm").default("osm"),
  providerId: z.string().max(100).optional(),
  osmType: z.enum(["node", "way", "relation"]).nullable().optional(),
  osmId: z.number().int().positive().nullable().optional(),
  imageRefs: z.object({
    wikimediaCommons: z.string().max(300).optional(),
    wikidata: z.string().max(80).optional(),
    wikipedia: z.string().max(300).optional(),
  }).nullable().optional(),
});

const imagesSchema = z.object({ places: z.array(imageInputSchema).min(1).max(20) });

export const placesRouter = Router();
placesRouter.use(requireAuth, requireRole("traveler"));

placesRouter.get("/search", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = searchSchema.parse(request.query);
    const key = `search:${input.q.toLowerCase()}:${input.lat ?? ""}:${input.lon ?? ""}:${input.limit}`;
    const cached = getCached<OpenPlace[]>(key);
    if (cached) return response.json({ data: cached, source: "cache" });

    const data = await photonSearch(input.q, input.lat ?? null, input.lon ?? null, input.limit);
    setCached(key, data, NORMAL_TTL);
    response.setHeader("Cache-Control", "private, max-age=60");
    return response.json({ data, source: "photon" });
  } catch (error) {
    return next(error instanceof z.ZodError ? new HttpError(400, "Invalid place search.", "INVALID_SEARCH") : error);
  }
});

placesRouter.get("/nearby", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = nearbySchema.parse(request.query);
    const category = normalizeCategory(input.category);
    const key = `nearby:${input.quality}:${category}:${input.lat.toFixed(4)}:${input.lon.toFixed(4)}:${input.radius}:${input.limit}`;
    const cached = getCached<OpenPlace[]>(key);
    if (cached) return response.json({ data: cached, source: "cache", quality: input.quality });

    const data = input.quality === "fast"
      ? await photonNearbyFast(category, input.lat, input.lon, input.radius, input.limit)
      : await overpassNearby(category, input.lat, input.lon, input.radius, input.limit);
    setCached(key, data, input.quality === "fast" ? 5 * 60 * 1000 : NORMAL_TTL);
    response.setHeader("Cache-Control", "private, max-age=60");
    return response.json({ data, source: input.quality === "fast" ? "photon" : "openstreetmap", quality: input.quality });
  } catch (error) {
    return next(error instanceof z.ZodError ? new HttpError(400, "Invalid nearby-place request.", "INVALID_NEARBY") : error);
  }
});

placesRouter.get("/reverse", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = reverseSchema.parse(request.query);
    const key = `reverse:${input.lat.toFixed(4)}:${input.lon.toFixed(4)}`;
    const cached = getCached<{ label: string; city: string | null; country: string | null }>(key);
    if (cached) return response.json({ data: cached, source: "cache" });

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(input.lat));
    url.searchParams.set("lon", String(input.lon));
    url.searchParams.set("zoom", "12");
    url.searchParams.set("addressdetails", "1");
    const payload = await fetchJson<Record<string, unknown>>(url);
    const address = asRecord(payload.address);
    const city = firstText(address.city, address.town, address.village, address.municipality, address.county);
    const state = firstText(address.state, address.region);
    const country = text(address.country);
    const label = [city, state, country].filter(Boolean).filter(unique).join(", ") || text(payload.display_name) || "Selected area";
    const data = { label, city, country };
    setCached(key, data, NORMAL_TTL);
    return response.json({ data, source: "nominatim" });
  } catch (error) {
    return next(error instanceof z.ZodError ? new HttpError(400, "Invalid coordinates.", "INVALID_COORDINATES") : error);
  }
});

placesRouter.get("/route", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = routeSchema.parse(request.query);
    const key = `route:${input.mode}:${input.originLat.toFixed(5)},${input.originLon.toFixed(5)}:${input.destinationLat.toFixed(5)},${input.destinationLon.toFixed(5)}`;
    const cached = getCached<unknown>(key);
    if (cached) return response.json({ data: cached, source: "cache" });

    const data = await fetchRoute(input.mode, input.originLat, input.originLon, input.destinationLat, input.destinationLon);
    setCached(key, data, 3 * 60 * 1000);
    response.setHeader("Cache-Control", "private, max-age=30");
    return response.json({ data, source: "open-routing" });
  } catch (error) {
    return next(error instanceof z.ZodError ? new HttpError(400, "Invalid route request.", "INVALID_ROUTE") : error);
  }
});

placesRouter.post("/images", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = imagesSchema.parse(request.body);
    const results = await mapWithConcurrency(input.places, 4, async (place) => ({
      id: place.id,
      image: await resolveVerifiedPlaceImage(place),
    }));
    response.setHeader("Cache-Control", "private, max-age=300");
    return response.json({ data: results });
  } catch (error) {
    return next(error instanceof z.ZodError ? new HttpError(400, "Invalid image-resolution request.", "INVALID_IMAGE_REQUEST") : error);
  }
});

async function photonSearch(query: string, latitude: number | null, longitude: number | null, limit: number, timeoutMs = REQUEST_TIMEOUT_MS): Promise<OpenPlace[]> {
  const url = new URL(process.env.GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  if (latitude != null && longitude != null) {
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
  }
  const payload = await fetchJson<{ features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }> }>(url, {}, timeoutMs);
  return dedupe((payload.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return [];
    const [lon, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const p = feature.properties ?? {};
    const rawType = text(p.osm_type)?.toLowerCase();
    const osmType: OsmType | null = rawType === "n" || rawType === "node" ? "node" : rawType === "w" || rawType === "way" ? "way" : rawType === "r" || rawType === "relation" ? "relation" : null;
    const osmId = finiteNumber(p.osm_id);
    const name = firstText(p.name, p.street, p.city, p.state, p.country) || "Location";
    const city = firstText(p.city, p.district, p.county, p.state);
    const country = text(p.country);
    const address = [text(p.housenumber), text(p.street), city, text(p.state), country].filter(Boolean).filter(unique).join(", ") || null;
    const providerId = osmType && osmId ? `${osmType}:${osmId}` : `photon:${index}:${lat.toFixed(5)}:${lon.toFixed(5)}`;
    return [{
      id: `osm:${providerId}`,
      provider: "osm" as const,
      providerId,
      osmType,
      osmId,
      name,
      displayName: [name, address].filter(Boolean).filter(unique).join(", "),
      address,
      city,
      country,
      latitude: lat,
      longitude: lon,
      category: categoryFromTags({ [text(p.osm_key) || ""]: text(p.osm_value) || "" }),
      openingHours: null,
      website: null,
      phone: null,
      sourceUrl: osmType && osmId ? `https://www.openstreetmap.org/${osmType}/${osmId}` : null,
      imageRefs: null,
    } satisfies OpenPlace];
  })).slice(0, limit);
}

async function photonNearbyFast(category: string, latitude: number, longitude: number, radius: number, limit: number): Promise<OpenPlace[]> {
  const aliases = fastAliases(category);
  const eachLimit = Math.max(5, Math.min(9, Math.ceil(limit / Math.max(1, aliases.length)) + 3));
  const settled = await Promise.allSettled(aliases.map((query) => photonSearch(query, latitude, longitude, eachLimit, 3_200)));
  const combined = settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
  return dedupe(combined)
    .map((place) => ({ place, distance: haversineMeters(latitude, longitude, place.latitude, place.longitude) }))
    .filter(({ place, distance }) => distance <= radius * 1.05 && place.category !== "Place")
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ place }) => place);
}

function fastAliases(category: string) {
  const groups: Record<string, string[]> = {
    attractions: ["tourist attraction", "museum", "historic site", "viewpoint"],
    activities: ["park", "garden", "nature reserve", "sports centre"],
    food: ["restaurant", "food court", "fast food"],
    cafes: ["cafe", "coffee", "ice cream"],
    shopping: ["shopping mall", "marketplace", "shop"],
    hotels: ["hotel", "hostel", "resort"],
    transport: ["train station", "bus station", "ferry terminal"],
  };
  return groups[category] ?? ["tourist attraction", "museum", "park", "restaurant", "cafe"];
}

async function overpassNearby(category: string, latitude: number, longitude: number, radius: number, limit: number): Promise<OpenPlace[]> {
  const clauses = overpassClauses(category, radius, latitude, longitude);
  const query = `[out:json][timeout:7];(${clauses.join("")});out center tags ${Math.max(limit * 3, 60)};`;
  const endpoint = process.env.OVERPASS_BASE_URL?.trim() || "https://overpass-api.de/api/interpreter";
  const payload = await fetchJson<{ elements?: Array<Record<string, unknown>> }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ data: query }).toString(),
  }, 8_000);

  const places = (payload.elements ?? []).flatMap((element) => {
    const type = text(element.type) as OsmType | null;
    const osmId = finiteNumber(element.id);
    const tags = asRecord(element.tags);
    const name = firstText(tags.name, tags["name:en"], tags.brand);
    if (!name || !type || !osmId) return [];
    const center = asRecord(element.center);
    const lat = finiteNumber(element.lat) ?? finiteNumber(center.lat);
    const lon = finiteNumber(element.lon) ?? finiteNumber(center.lon);
    if (lat == null || lon == null) return [];
    const distanceMeters = haversineMeters(latitude, longitude, lat, lon);
    if (distanceMeters > radius * 1.03) return [];
    const address = buildOsmAddress(tags);
    const city = firstText(tags["addr:city"], tags["addr:place"], tags["addr:suburb"]);
    const country = firstText(tags["addr:country"]);
    const refs = compactImageRefs(tags);
    const providerId = `${type}:${osmId}`;
    return [{
      id: `osm:${providerId}`,
      provider: "osm" as const,
      providerId,
      osmType: type,
      osmId,
      name,
      displayName: [name, address, city, country].filter(Boolean).filter(unique).join(", "),
      address,
      city,
      country,
      latitude: lat,
      longitude: lon,
      category: categoryFromTags(tags),
      openingHours: text(tags.opening_hours),
      website: firstText(tags.website, tags["contact:website"]),
      phone: firstText(tags.phone, tags["contact:phone"]),
      sourceUrl: `https://www.openstreetmap.org/${type}/${osmId}`,
      imageRefs: refs,
      __distanceMeters: distanceMeters,
    }];
  });

  return dedupe(places)
    .sort((a, b) => (finiteNumber((a as Record<string, unknown>).__distanceMeters) ?? Infinity) - (finiteNumber((b as Record<string, unknown>).__distanceMeters) ?? Infinity))
    .slice(0, limit)
    .map(({ __distanceMeters: _distance, ...place }) => place as OpenPlace);
}

function overpassClauses(category: string, radius: number, lat: number, lon: number) {
  const around = `(around:${radius},${lat},${lon})`;
  const nwr = (filter: string) => `nwr["name"]${filter}${around};`;
  const groups: Record<string, string[]> = {
    attractions: [nwr('["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium"]'), nwr('["historic"]')],
    activities: [nwr('["leisure"~"park|garden|nature_reserve|sports_centre|water_park|marina"]'), nwr('["tourism"~"viewpoint|theme_park|zoo|aquarium"]')],
    food: [nwr('["amenity"~"restaurant|fast_food|food_court|bar|pub"]')],
    cafes: [nwr('["amenity"~"cafe|ice_cream"]')],
    shopping: [nwr('["shop"]'), nwr('["amenity"="marketplace"]')],
    hotels: [nwr('["tourism"~"hotel|hostel|guest_house|motel|apartment|resort"]')],
    transport: [nwr('["amenity"~"bus_station|ferry_terminal|taxi"]'), nwr('["railway"~"station|halt|tram_stop"]'), nwr('["aeroway"~"aerodrome|terminal"]')],
  };
  const selected = groups[category];
  if (selected) return selected;
  // "All" intentionally focuses on high-value discovery POIs so a 25 km browse
  // does not explode into every shop/hotel/transport stop in a city. Those remain
  // available through their dedicated filters.
  return [
    ...(groups.attractions ?? []),
    ...(groups.activities ?? []),
    ...(groups.food ?? []),
    ...(groups.cafes ?? []),
  ];
}

async function fetchRoute(mode: TravelMode, originLat: number, originLon: number, destinationLat: number, destinationLon: number) {
  const base = mode === "driving"
    ? "https://router.project-osrm.org/route/v1/driving/"
    : mode === "walking"
      ? "https://routing.openstreetmap.de/routed-foot/route/v1/driving/"
      : "https://routing.openstreetmap.de/routed-bike/route/v1/driving/";
  const url = new URL(`${base}${originLon},${originLat};${destinationLon},${destinationLat}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  const payload = await fetchJson<{ code?: string; routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: Array<[number, number]> } }> }>(url, {}, 12_000);
  const route = payload.routes?.[0];
  if (!route?.geometry?.coordinates?.length || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    throw new HttpError(502, "A route could not be calculated for these points.", "ROUTE_UNAVAILABLE");
  }
  return {
    mode,
    distanceMeters: Math.round(route.distance ?? 0),
    durationSeconds: Math.round(route.duration ?? 0),
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
  };
}

async function resolveVerifiedPlaceImage(place: z.infer<typeof imageInputSchema>): Promise<PlaceImage | null> {
  const stable = place.osmType && place.osmId ? `${place.osmType}:${place.osmId}` : place.providerId || place.id;
  const cacheKey = `image:${stable}`;
  const cached = getCached<PlaceImage | null>(cacheKey, true);
  if (cached !== undefined) return cached;

  try {
    const refs = { ...(place.imageRefs ?? {}) } as { wikimediaCommons?: string; wikidata?: string; wikipedia?: string };
    if ((!refs.wikimediaCommons && !refs.wikidata && !refs.wikipedia) && place.osmType && place.osmId) {
      Object.assign(refs, await fetchExactOsmImageRefs(place.osmType, place.osmId));
    }

    let fileName: string | null = null;
    let sourceEntityId: string | null = stable;

    const commons = refs.wikimediaCommons?.trim();
    if (commons && /^File:/i.test(commons)) fileName = commons.replace(/^File:/i, "").trim();

    if (!fileName && refs.wikidata && /^Q\d+$/i.test(refs.wikidata.trim())) {
      fileName = await wikidataP18(refs.wikidata.trim());
      sourceEntityId = refs.wikidata.trim();
    }

    if (!fileName && refs.wikipedia) {
      const parsed = parseWikipediaRef(refs.wikipedia);
      if (parsed) {
        fileName = await wikipediaPageImage(parsed.language, parsed.title);
        sourceEntityId = refs.wikipedia;
      }
    }

    if (!fileName) {
      setCached(cacheKey, null, IMAGE_MISS_TTL);
      return null;
    }

    const image = await commonsFileMetadata(fileName, sourceEntityId);
    setCached(cacheKey, image, image ? IMAGE_TTL : IMAGE_MISS_TTL);
    return image;
  } catch {
    setCached(cacheKey, null, IMAGE_MISS_TTL);
    return null;
  }
}

async function fetchExactOsmImageRefs(type: OsmType, id: number) {
  const payload = await fetchJson<{ elements?: Array<{ tags?: Record<string, unknown> }> }>(`https://api.openstreetmap.org/api/0.6/${type}/${id}.json`);
  const tags = payload.elements?.[0]?.tags ?? {};
  return compactImageRefs(tags) ?? {};
}

async function wikidataP18(entityId: string) {
  const payload = await fetchJson<{ entities?: Record<string, { claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: unknown } } }> } }> }>(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(entityId)}.json`);
  const value = payload.entities?.[entityId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function wikipediaPageImage(language: string, title: string) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "name");
  url.searchParams.set("titles", title);
  const payload = await fetchJson<{ query?: { pages?: Record<string, { pageimage?: string }> } }>(url);
  const page = Object.values(payload.query?.pages ?? {})[0];
  return page?.pageimage?.trim() || null;
}

async function commonsFileMetadata(fileName: string, sourceEntityId: string | null): Promise<PlaceImage | null> {
  const normalized = fileName.replace(/^File:/i, "").trim();
  if (!normalized) return null;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "900");
  url.searchParams.set("titles", `File:${normalized}`);
  const payload = await fetchJson<{ query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string; thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }> }> } }>(url);
  const info = Object.values(payload.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info?.url) return null;
  const meta = info.extmetadata ?? {};
  const author = stripHtml(meta.Artist?.value || meta.Credit?.value || "") || null;
  const license = stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || "") || null;
  const licenseUrl = text(meta.LicenseUrl?.value);
  const attributionText = [author, license].filter(Boolean).join(" · ") || "Wikimedia Commons";
  return {
    url: info.url,
    thumbnailUrl: info.thumburl || info.url,
    source: "wikimedia",
    sourceEntityId,
    author,
    license,
    licenseUrl,
    attributionText,
    sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(normalized.replace(/ /g, "_"))}`,
    verifiedEntityMatch: true,
  };
}

function compactImageRefs(tags: Record<string, unknown>) {
  const wikimediaCommons = text(tags.wikimedia_commons);
  const wikidata = text(tags.wikidata);
  const wikipedia = text(tags.wikipedia);
  return wikimediaCommons || wikidata || wikipedia ? { wikimediaCommons, wikidata, wikipedia } : null;
}

function parseWikipediaRef(value: string) {
  const match = value.trim().match(/^([a-z-]{2,12}):(.+)$/i);
  return match ? { language: match[1]!.toLowerCase(), title: match[2]!.trim() } : null;
}

function normalizeCategory(value: string) {
  const q = value.toLowerCase().replace(/[^a-z]/g, "");
  if (q === "attraction" || q === "attractions" || q === "sightseeing") return "attractions";
  if (q === "activity" || q === "activities" || q === "tourism") return "activities";
  if (q === "food" || q === "restaurant" || q === "restaurants") return "food";
  if (q === "cafe" || q === "cafes" || q === "coffee") return "cafes";
  if (q === "shop" || q === "shopping") return "shopping";
  if (q === "hotel" || q === "hotels" || q === "stay" || q === "stays") return "hotels";
  if (q === "transport" || q === "transportation") return "transport";
  return "all";
}

function categoryFromTags(tags: Record<string, unknown>) {
  const tourism = text(tags.tourism)?.toLowerCase();
  const amenity = text(tags.amenity)?.toLowerCase();
  const leisure = text(tags.leisure)?.toLowerCase();
  const shop = text(tags.shop)?.toLowerCase();
  const historic = text(tags.historic)?.toLowerCase();
  const railway = text(tags.railway)?.toLowerCase();
  const aeroway = text(tags.aeroway)?.toLowerCase();
  if (amenity === "cafe" || amenity === "ice_cream") return "Cafés";
  if (["restaurant", "fast_food", "food_court", "bar", "pub"].includes(amenity || "")) return "Food";
  if (shop || amenity === "marketplace") return "Shopping";
  if (["hotel", "hostel", "guest_house", "motel", "apartment", "resort"].includes(tourism || "")) return "Hotels";
  if (railway || aeroway || ["bus_station", "ferry_terminal", "taxi"].includes(amenity || "")) return "Transport";
  if (leisure || ["theme_park", "zoo", "aquarium"].includes(tourism || "")) return "Activities";
  if (historic || tourism) return "Attractions";
  return "Place";
}

function buildOsmAddress(tags: Record<string, unknown>) {
  const line = [text(tags["addr:housenumber"]), text(tags["addr:street"])].filter(Boolean).join(" ");
  const parts = [line, text(tags["addr:suburb"]), text(tags["addr:city"]), text(tags["addr:state"]), text(tags["addr:country"])].filter(Boolean).filter(unique);
  return parts.join(", ") || null;
}

async function fetchJson<T>(input: URL | string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    if (!headers.has("User-Agent")) headers.set("User-Agent", APP_USER_AGENT);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers,
    });
    if (!response.ok) throw new HttpError(502, "An open-data provider could not be reached.", "PLACE_PROVIDER_UNAVAILABLE");
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function getCached<T>(key: string, includeMiss = false): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > entry.ttlMs) {
    cache.delete(key);
    return undefined;
  }
  if (entry.data === null && !includeMiss) return undefined;
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, { createdAt: Date.now(), ttlMs, data });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function dedupe<T extends { providerId: string; latitude: number; longitude: number; name: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.providerId || `${item.name.toLowerCase()}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>) {
  const result = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return result;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function firstText(...values: unknown[]) { for (const value of values) { const result = text(value); if (result) return result; } return null; }
function finiteNumber(value: unknown): number | null { const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function unique(value: unknown, index: number, values: unknown[]) { return values.indexOf(value) === index; }
