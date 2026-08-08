import { Router, type NextFunction, type Request, type Response } from "express";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

interface CacheEntry {
  createdAt: number;
  data: unknown[];
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export const placesRouter = Router();
placesRouter.use(requireAuth, requireRole("traveler"));

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

placesRouter.get("/search", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const query = cleanText(request.query.q);
    if (!query || query.length < 3) {
      response.json({ data: [] });
      return;
    }
    if (query.length > 120) throw new HttpError(400, "Search query is too long.", "QUERY_TOO_LONG");

    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      response.json({ data: cached.data });
      return;
    }

    const baseUrl = process.env.GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io/api/";
    const url = new URL(baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");

    const upstream = await fetch(url, {
      headers: { "User-Agent": "TravaAI/1.0 travel itinerary geocoder" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new HttpError(502, "Location search is temporarily unavailable.", "GEOCODER_UNAVAILABLE");
    const payload = (await upstream.json()) as { features?: PhotonFeature[] };
    const data = (payload.features ?? []).flatMap((feature, index) => {
      const coordinates = feature.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) return [];
      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const props = feature.properties ?? {};
      const name = cleanText(props.name) || cleanText(props.city) || cleanText(props.country) || "Unnamed place";
      const city = cleanText(props.city) || cleanText(props.state);
      const country = cleanText(props.country);
      return [{
        id: `${cleanText(props.osm_type) ?? "place"}-${String(props.osm_id ?? index)}`,
        name,
        displayName: [name, city, cleanText(props.state), country].filter(Boolean).filter((value, position, values) => values.indexOf(value) === position).join(", "),
        city,
        country,
        latitude,
        longitude,
      }];
    });
    cache.set(key, { createdAt: Date.now(), data });
    if (cache.size > 150) cache.delete(cache.keys().next().value ?? key);
    response.json({ data });
  } catch (error) {
    next(error);
  }
});
