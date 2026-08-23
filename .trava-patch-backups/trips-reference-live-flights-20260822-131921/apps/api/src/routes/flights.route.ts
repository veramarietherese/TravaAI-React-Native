import { Router, type NextFunction, type Request, type Response } from "express";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { HttpError } from "../lib/http-error.js";
import { loadTripAccess, requireRequestUserId } from "../lib/trip-access.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

interface CacheEntry {
  createdAt: number;
  data: Record<string, unknown>;
}

type Row = Record<string, unknown>;

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export const flightsRouter = Router();
flightsRouter.use(requireAuth, requireRole("traveler"));

function cleanFlightNumber(value: unknown): string {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
}

function cleanDate(value: unknown): string | null {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstText(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const result = text(row[key]);
    if (result) return result;
  }
  return null;
}

function unwrap(payload: unknown): Row[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Row;
  const candidate = root.response ?? root.data ?? root.result ?? payload;
  if (Array.isArray(candidate)) return candidate.filter((item): item is Row => Boolean(item) && typeof item === "object");
  return candidate && typeof candidate === "object" ? [candidate as Row] : [];
}

function rowDate(row: Row): string | null {
  const value = firstText(row, ["flight_date", "dep_time", "dep_scheduled", "arr_time"]);
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function normalize(row: Row, requestedFlightNumber: string, requestedDate: string | null) {
  return {
    source: "airlabs",
    checkedAt: new Date().toISOString(),
    flightNumber: firstText(row, ["flight_iata", "flight_icao"]) ?? requestedFlightNumber,
    flightDate: rowDate(row) ?? requestedDate,
    status: firstText(row, ["status", "flight_status"]) ?? "scheduled",
    airlineName: firstText(row, ["airline_name", "airline_iata", "airline_icao"]),
    aircraft: firstText(row, ["aircraft_icao", "aircraft_model", "reg_number"]),
    departure: {
      airportCode: firstText(row, ["dep_iata", "dep_icao"]),
      airportName: firstText(row, ["dep_name", "dep_airport", "departure_airport"]),
      terminal: firstText(row, ["dep_terminal", "departure_terminal"]),
      gate: firstText(row, ["dep_gate", "departure_gate"]),
      scheduledTime: firstText(row, ["dep_time", "dep_scheduled", "departure_scheduled"]),
      estimatedTime: firstText(row, ["dep_estimated", "departure_estimated"]),
      actualTime: firstText(row, ["dep_actual", "departure_actual"]),
    },
    arrival: {
      airportCode: firstText(row, ["arr_iata", "arr_icao"]),
      airportName: firstText(row, ["arr_name", "arr_airport", "arrival_airport"]),
      terminal: firstText(row, ["arr_terminal", "arrival_terminal"]),
      gate: firstText(row, ["arr_gate", "arrival_gate"]),
      scheduledTime: firstText(row, ["arr_time", "arr_scheduled", "arrival_scheduled"]),
      estimatedTime: firstText(row, ["arr_estimated", "arrival_estimated"]),
      actualTime: firstText(row, ["arr_actual", "arrival_actual"]),
    },
  };
}

async function airLabsRequest(endpoint: "flight" | "schedules", flightNumber: string, apiKey: string): Promise<Row[]> {
  const url = new URL(`https://airlabs.co/api/v9/${endpoint}`);
  url.searchParams.set("flight_iata", flightNumber);
  url.searchParams.set("api_key", apiKey);
  if (endpoint === "schedules") url.searchParams.set("limit", "50");
  const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message = payload && typeof payload === "object" ? text((payload as Row).message) : null;
    throw new HttpError(502, message ?? "The live flight provider could not complete the lookup.", "FLIGHT_PROVIDER_ERROR");
  }
  return unwrap(payload);
}

async function persistFlightSnapshot(tripId: string, userId: string, data: ReturnType<typeof normalize>) {
  const admin = getSupabaseAdmin();
  let existingQuery = admin.from("trip_flights")
    .select("flight_id")
    .eq("trip_id", tripId)
    .eq("flight_number", data.flightNumber);
  existingQuery = data.flightDate ? existingQuery.eq("flight_date", data.flightDate) : existingQuery.is("flight_date", null);
  const { data: existing, error: readError } = await existingQuery.maybeSingle();
  if (readError) throw readError;
  const snapshot = {
    trip_id: tripId,
    flight_number: data.flightNumber,
    flight_date: data.flightDate,
    provider: "airlabs",
    status: data.status,
    departure_airport_code: data.departure.airportCode,
    arrival_airport_code: data.arrival.airportCode,
    terminal: data.departure.terminal,
    gate: data.departure.gate,
    scheduled_departure: data.departure.scheduledTime,
    estimated_departure: data.departure.estimatedTime,
    scheduled_arrival: data.arrival.scheduledTime,
    estimated_arrival: data.arrival.estimatedTime,
    raw_snapshot: data,
    last_checked_at: data.checkedAt,
    created_by: userId,
  };
  const persisted = existing
    ? await admin.from("trip_flights").update(snapshot).eq("flight_id", existing.flight_id)
    : await admin.from("trip_flights").insert(snapshot);
  if (persisted.error) throw persisted.error;
}

flightsRouter.get("/status", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const flightNumber = cleanFlightNumber(request.query.flightNumber);
    const requestedDate = cleanDate(request.query.date);
    const tripId = typeof request.query.tripId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.query.tripId) ? request.query.tripId : null;
    const userId = requireRequestUserId(request.authUser?.id);
    if (request.query.tripId && !tripId) throw new HttpError(400, "Invalid trip identifier.", "INVALID_TRIP_ID");
    if (tripId) await loadTripAccess(userId, tripId);
    if (flightNumber.length < 2) throw new HttpError(400, "Enter a valid airline and flight number.", "INVALID_FLIGHT_NUMBER");

    const apiKey = process.env.AIRLABS_API_KEY?.trim() || process.env.FLIGHT_API_KEY?.trim();
    if (!apiKey) {
      throw new HttpError(503, "Live flight checking requires AIRLABS_API_KEY in apps/api/.env.", "FLIGHT_PROVIDER_NOT_CONFIGURED");
    }

    const cacheKey = `${flightNumber}:${requestedDate ?? "latest"}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      const cachedData = cached.data as ReturnType<typeof normalize>;
      if (tripId) await persistFlightSnapshot(tripId, userId, cachedData);
      response.json({ data: cachedData, cached: true });
      return;
    }

    let rows = await airLabsRequest("flight", flightNumber, apiKey);
    if (!rows.length || (requestedDate && !rows.some((row) => rowDate(row) === requestedDate))) {
      const schedules = await airLabsRequest("schedules", flightNumber, apiKey);
      rows = requestedDate ? schedules.filter((row) => rowDate(row) === requestedDate) : schedules;
    }
    const selected = rows.find((row) => !requestedDate || rowDate(row) === requestedDate) ?? rows[0];
    if (!selected) throw new HttpError(404, "No live or scheduled flight matched that number and date.", "FLIGHT_NOT_FOUND");

    const data = normalize(selected, flightNumber, requestedDate);
    if (tripId) await persistFlightSnapshot(tripId, userId, data);
    cache.set(cacheKey, { createdAt: Date.now(), data });
    if (cache.size > 200) cache.delete(cache.keys().next().value ?? cacheKey);
    response.json({ data, cached: false });
  } catch (error) {
    next(error);
  }
});
