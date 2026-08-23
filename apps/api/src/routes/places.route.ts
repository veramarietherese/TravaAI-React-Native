import { Router, type NextFunction, type Request, type Response } from "express";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}
interface OverpassElement {
  id?: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}
interface CacheEntry { createdAt: number; data: unknown[]; }

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;
export const placesRouter = Router();
placesRouter.use(requireAuth, requireRole("traveler"));

function cleanText(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberParam(value: unknown): number | null { const parsed = typeof value === "string" ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function limitParam(value: unknown, fallback = 12) { const parsed = numberParam(value); return Math.max(1, Math.min(25, parsed == null ? fallback : Math.floor(parsed))); }

placesRouter.get("/search", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const query = cleanText(request.query.q);
    if (!query || query.length < 2) { response.json({ data: [] }); return; }
    if (query.length > 140) throw new HttpError(400, "Search query is too long.", "QUERY_TOO_LONG");
    const latitude = numberParam(request.query.lat);
    const longitude = numberParam(request.query.lon);
    const limit = limitParam(request.query.limit, 12);
    const key = `search:${query.toLowerCase()}:${latitude ?? ""}:${longitude ?? ""}:${limit}`;
    const cached = getCached(key); if (cached) { response.json({ data: cached }); return; }

    const categoryRequest = parseCategorySearch(query);
    if (categoryRequest) {
      const anchor = await photonSearch(categoryRequest.location, latitude, longitude, 1);
      const first = anchor[0];
      if (first) {
        const data = await overpassNearby(categoryRequest.category, first.latitude, first.longitude, limit);
        setCached(key, data); response.json({ data }); return;
      }
    }

    const data = await photonSearch(query, latitude, longitude, limit);
    setCached(key, data);
    response.json({ data });
  } catch (error) { next(error); }
});

placesRouter.get("/nearby", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const category = normalizeCategory(cleanText(request.query.category));
    const latitude = numberParam(request.query.lat);
    const longitude = numberParam(request.query.lon);
    const limit = limitParam(request.query.limit, 18);
    if (!category) throw new HttpError(400, "A supported category is required.", "INVALID_CATEGORY");
    if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new HttpError(400, "Valid latitude and longitude are required.", "INVALID_COORDINATES");
    const key = `nearby:${category}:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${limit}`;
    const cached = getCached(key); if (cached) { response.json({ data: cached }); return; }
    const data = await overpassNearby(category, latitude, longitude, limit);
    setCached(key, data);
    response.json({ data });
  } catch (error) { next(error); }
});

async function photonSearch(query: string, latitude: number | null, longitude: number | null, limit: number) {
  const baseUrl = process.env.GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io/api/";
  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  if (latitude != null && longitude != null) { url.searchParams.set("lat", String(latitude)); url.searchParams.set("lon", String(longitude)); }
  const upstream = await fetch(url, { headers: { "User-Agent": "TravaAI/1.0 worldwide place search" }, signal: AbortSignal.timeout(8000) });
  if (!upstream.ok) throw new HttpError(502, "Location search is temporarily unavailable.", "GEOCODER_UNAVAILABLE");
  const payload = await upstream.json() as { features?: PhotonFeature[] };
  return (payload.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return [];
    const [longitudeValue, latitudeValue] = coordinates;
    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) return [];
    const props = feature.properties ?? {};
    const name = cleanText(props.name) || cleanText(props.street) || cleanText(props.city) || cleanText(props.state) || cleanText(props.country) || "Location";
    const city = cleanText(props.city) || cleanText(props.state);
    const country = cleanText(props.country);
    const displayName = [name, cleanText(props.street), city, cleanText(props.state), country].filter(Boolean).filter((value, position, values) => values.indexOf(value) === position).join(", ");
    return [{ id: `${cleanText(props.osm_type) ?? "place"}-${String(props.osm_id ?? index)}`, name, displayName: displayName || name, city, country, latitude: latitudeValue, longitude: longitudeValue }];
  });
}

async function overpassNearby(category: string, latitude: number, longitude: number, limit: number) {
  const radius = category === "hiking" ? 12000 : category === "parks" ? 8000 : 6000;
  const selectors = selectorsFor(category, radius, latitude, longitude);
  const query = `[out:json][timeout:12];(${selectors.join("")});out center ${Math.max(limit * 3, 30)};`;
  const endpoint = process.env.OVERPASS_BASE_URL?.trim() || "https://overpass-api.de/api/interpreter";
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "TravaAI/1.0 nearby place discovery" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(14000),
  });
  if (!upstream.ok) throw new HttpError(502, "Nearby place search is temporarily unavailable.", "NEARBY_UNAVAILABLE");
  const payload = await upstream.json() as { elements?: OverpassElement[] };
  const data = (payload.elements ?? []).flatMap((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const tags = element.tags ?? {};
    const name = cleanText(tags.name) || cleanText(tags.brand) || cleanText(tags.operator);
    if (!name) return [];
    const city = cleanText(tags["addr:city"]) || cleanText(tags["addr:suburb"]);
    const country = cleanText(tags["addr:country"]);
    const address = [cleanText(tags["addr:housenumber"]), cleanText(tags["addr:street"]), city, country].filter(Boolean).join(" ");
    return [{ id: `osm-${element.type ?? "nwr"}-${element.id ?? `${lat}-${lon}`}`, name, displayName: address ? `${name}, ${address}` : name, city, country, latitude: lat as number, longitude: lon as number, category }];
  });
  return dedupe(data).sort((a, b) => distanceSq(a.latitude, a.longitude, latitude, longitude) - distanceSq(b.latitude, b.longitude, latitude, longitude)).slice(0, limit);
}

function selectorsFor(category: string, radius: number, lat: number, lon: number) {
  const around = `(around:${radius},${lat},${lon})`;
  if (category === "cafes") return [`nwr["amenity"="cafe"]${around};`];
  if (category === "food") return [`nwr["amenity"~"restaurant|fast_food|food_court"]${around};`];
  if (category === "shopping") return [`nwr["shop"]${around};`, `nwr["amenity"="marketplace"]${around};`];
  if (category === "parks") return [`nwr["leisure"~"park|garden"]${around};`, `nwr["leisure"="nature_reserve"]${around};`];
  if (category === "hiking") return [`nwr["tourism"~"viewpoint|attraction"]${around};`, `nwr["natural"~"peak|waterfall"]${around};`, `nwr["leisure"="nature_reserve"]${around};`];
  return [`nwr["amenity"~"coworking_space|library"]${around};`, `nwr["office"="coworking"]${around};`];
}

function parseCategorySearch(query: string): { category: string; location: string } | null {
  const match = query.match(/^\s*(cafes?|coffee|restaurants?|food|shopping|shops?|malls?|hiking|trails?|parks?|work|coworking)\s+(?:in|near)\s+(.+)$/i);
  if (!match) return null;
  const category = normalizeCategory(match[1]);
  const location = match[2]?.trim();
  return category && location ? { category, location } : null;
}
function normalizeCategory(value: string | null) { if (!value) return null; const q = value.toLowerCase(); if (q.startsWith("cafe") || q === "coffee") return "cafes"; if (q.startsWith("restaurant") || q === "food") return "food"; if (q.startsWith("shop") || q.startsWith("mall")) return "shopping"; if (q.startsWith("hik") || q.startsWith("trail")) return "hiking"; if (q.startsWith("park")) return "parks"; if (q.startsWith("work") || q.startsWith("cowork")) return "work"; return null; }
function getCached(key: string) { const cached = cache.get(key); return cached && Date.now() - cached.createdAt < CACHE_TTL_MS ? cached.data : null; }
function setCached(key: string, data: unknown[]) { cache.set(key, { createdAt: Date.now(), data }); if (cache.size > 220) cache.delete(cache.keys().next().value ?? key); }
function dedupe<T extends { name: string; latitude: number; longitude: number }>(items: T[]) { const seen = new Set<string>(); return items.filter((item) => { const key = `${item.name.toLowerCase()}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function distanceSq(lat: number, lon: number, anchorLat: number, anchorLon: number) { return (lat - anchorLat) ** 2 + (lon - anchorLon) ** 2; }
