import { Router, type NextFunction, type Request, type Response } from "express";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

interface PhotonFeature { geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown>; }
type Place = { id: string; name: string; displayName: string; city: string | null; country: string | null; latitude: number; longitude: number; category?: string | null; };
interface CacheEntry { createdAt: number; data: Place[]; }

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;
export const placesRouter = Router();
placesRouter.use(requireAuth, requireRole("traveler"));

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
      const anchor = (await safePhoton(categoryRequest.location, latitude, longitude, 1))[0];
      if (anchor) {
        const data = await photonNearby(categoryRequest.category, anchor.latitude, anchor.longitude, limit);
        setCached(key, data); response.json({ data }); return;
      }
    }

    const data = await safePhoton(query, latitude, longitude, limit);
    setCached(key, data); response.json({ data });
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
    const data = await photonNearby(category, latitude, longitude, limit);
    setCached(key, data); response.json({ data });
  } catch (error) { next(error); }
});

async function photonNearby(category: string, latitude: number, longitude: number, limit: number) {
  const aliases: Record<string, string[]> = {
    cafes: ["cafe", "coffee"], food: ["restaurant", "food"], shopping: ["shopping mall", "shop"],
    hiking: ["trail", "viewpoint", "park"], work: ["coworking", "library", "office"], parks: ["park", "garden"],
  };
  const groups = await Promise.all((aliases[category] ?? [category]).map((query) => safePhoton(query, latitude, longitude, Math.min(limit, 12))));
  return dedupe(groups.flat()).map((item) => ({ ...item, category }))
    .sort((a, b) => distanceSq(a.latitude, a.longitude, latitude, longitude) - distanceSq(b.latitude, b.longitude, latitude, longitude))
    .slice(0, limit);
}

async function safePhoton(query: string, latitude: number | null, longitude: number | null, limit: number): Promise<Place[]> {
  try { return await photonSearch(query, latitude, longitude, limit); }
  catch { return []; }
}

async function photonSearch(query: string, latitude: number | null, longitude: number | null, limit: number): Promise<Place[]> {
  const url = new URL(process.env.GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io/api/");
  url.searchParams.set("q", query); url.searchParams.set("limit", String(limit));
  if (latitude != null && longitude != null) { url.searchParams.set("lat", String(latitude)); url.searchParams.set("lon", String(longitude)); }
  const upstream = await fetch(url, { headers: { "User-Agent": "TravaAI/1.0 no-key place discovery" }, signal: AbortSignal.timeout(7000) });
  if (!upstream.ok) return [];
  const payload = await upstream.json() as { features?: PhotonFeature[] };
  return dedupe((payload.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return [];
    const [longitudeValue, latitudeValue] = coordinates;
    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) return [];
    const p = feature.properties ?? {};
    const name = cleanText(p.name) || cleanText(p.street) || cleanText(p.city) || cleanText(p.state) || cleanText(p.country) || "Location";
    const city = cleanText(p.city) || cleanText(p.state); const country = cleanText(p.country);
    const displayName = [name, cleanText(p.street), city, cleanText(p.state), country].filter(Boolean).filter((value, position, values) => values.indexOf(value) === position).join(", ");
    return [{ id: `${cleanText(p.osm_type) ?? "place"}-${String(p.osm_id ?? index)}`, name, displayName: displayName || name, city, country, latitude: latitudeValue, longitude: longitudeValue, category: cleanText(p.osm_value) || cleanText(p.type) }];
  })).slice(0, limit);
}

function parseCategorySearch(query: string): { category: string; location: string } | null {
  const match = query.match(/^\s*(cafes?|coffee|restaurants?|food|shopping|shops?|malls?|hiking|trails?|parks?|work|coworking)\s+(?:in|near|around)\s+(.+)$/i);
  if (!match) return null;
  const category = normalizeCategory(match[1] ?? null); const location = match[2]?.trim();
  return category && location ? { category, location } : null;
}
function normalizeCategory(value: string | null) {
  if (!value) return null; const q = value.toLowerCase();
  if (q.startsWith("cafe") || q === "coffee") return "cafes";
  if (q.startsWith("restaurant") || q === "food") return "food";
  if (q.startsWith("shop") || q.startsWith("mall")) return "shopping";
  if (q.startsWith("hik") || q.startsWith("trail")) return "hiking";
  if (q.startsWith("park") || q.startsWith("garden")) return "parks";
  if (q.startsWith("work") || q.startsWith("cowork")) return "work";
  return null;
}
function cleanText(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberParam(value: unknown): number | null { const parsed = typeof value === "string" ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function limitParam(value: unknown, fallback = 12) { const parsed = numberParam(value); return Math.max(1, Math.min(25, parsed == null ? fallback : Math.floor(parsed))); }
function getCached(key: string) { const cached = cache.get(key); return cached && Date.now() - cached.createdAt < CACHE_TTL_MS ? cached.data : null; }
function setCached(key: string, data: Place[]) { cache.set(key, { createdAt: Date.now(), data }); if (cache.size > 220) cache.delete(cache.keys().next().value ?? key); }
function dedupe<T extends { name: string; latitude: number; longitude: number }>(items: T[]) { const seen = new Set<string>(); return items.filter((item) => { const key = `${item.name.toLowerCase()}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function distanceSq(lat: number, lon: number, anchorLat: number, anchorLon: number) { return (lat - anchorLat) ** 2 + (lon - anchorLon) ** 2; }
