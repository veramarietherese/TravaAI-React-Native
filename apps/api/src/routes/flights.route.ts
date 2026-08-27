import { Router, type NextFunction, type Request, type Response } from "express";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { HttpError } from "../lib/http-error.js";
import { loadTripAccess, requireRequestUserId } from "../lib/trip-access.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

type Row = Record<string, unknown>;

interface FlightCacheEntry {
  createdAt: number;
  data: ReturnType<typeof normalizeBase> & {
    departure: ReturnType<typeof normalizeBase>["departure"] & { airportName: string | null };
    arrival: ReturnType<typeof normalizeBase>["arrival"] & { airportName: string | null };
  };
}

interface AirportCacheEntry {
  createdAt: number;
  name: string | null;
}

const flightCache = new Map<string, FlightCacheEntry>();
const airportCache = new Map<string, AirportCacheEntry>();
const LIVE_CACHE_TTL_MS = 90 * 1000;
const AIRPORT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 10_000;

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

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
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
  if (Array.isArray(candidate)) {
    return candidate.filter((item): item is Row => Boolean(item) && typeof item === "object");
  }
  return candidate && typeof candidate === "object" ? [candidate as Row] : [];
}

function providerMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Row;
  const direct = text(root.message);
  if (direct) return direct;
  const error = root.error;
  if (error && typeof error === "object") {
    return text((error as Row).message) ?? text((error as Row).text);
  }
  return null;
}

function rowDate(row: Row): string | null {
  const explicit = firstText(row, ["flight_date"]);
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const value = firstText(row, ["dep_time", "dep_scheduled", "dep_estimated", "dep_actual", "arr_time", "arr_scheduled"]);
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function normalizeStatus(value: string | null): string {
  const status = String(value ?? "scheduled").trim().toLowerCase();
  if (status === "active") return "en-route";
  if (status === "en_route") return "en-route";
  if (status === "canceled") return "cancelled";
  return status || "scheduled";
}

function normalizeBase(row: Row, requestedFlightNumber: string, requestedDate: string | null) {
  const delay = numberValue(row.delayed ?? row.delay);
  const rawStatus = firstText(row, ["status", "flight_status"]);
  const status = delay && delay > 0 && (!rawStatus || rawStatus === "scheduled") ? "delayed" : normalizeStatus(rawStatus);

  return {
    source: "airlabs" as const,
    checkedAt: new Date().toISOString(),
    flightNumber: firstText(row, ["flight_iata", "flight_icao", "cs_flight_iata"]) ?? requestedFlightNumber,
    flightDate: rowDate(row) ?? requestedDate,
    status,
    airlineName: firstText(row, ["airline_name", "airline_iata", "airline_icao"]),
    aircraft: firstText(row, ["aircraft_model", "aircraft_icao", "reg_number"]),
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

async function airLabsRequest(endpoint: "flight" | "flights" | "schedules" | "airports", params: Record<string, string>, apiKey: string): Promise<Row[]> {
  const url = new URL(`https://airlabs.co/api/v9/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("api_key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, { signal: controller.signal });
    const payload = await upstream.json().catch(() => null);
    if (upstream.status === 404) return [];
    if (!upstream.ok) {
      throw new HttpError(
        upstream.status === 429 ? 429 : 502,
        providerMessage(payload) ?? (upstream.status === 429 ? "The live flight provider rate limit was reached. Try again shortly." : "The live flight provider could not complete the lookup."),
        upstream.status === 429 ? "FLIGHT_PROVIDER_RATE_LIMIT" : "FLIGHT_PROVIDER_ERROR",
      );
    }
    // AirLabs can represent a clean no-match as an empty response payload.
    // Let the caller fall through to the next live/schedule source instead of failing early.
    return unwrap(payload);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "The live flight provider timed out. Try again.", "FLIGHT_PROVIDER_TIMEOUT");
    }
    throw new HttpError(502, "The live flight provider is temporarily unavailable.", "FLIGHT_PROVIDER_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

async function airportName(iata: string | null, apiKey: string): Promise<string | null> {
  if (!iata || iata.length !== 3) return null;
  const code = iata.toUpperCase();
  const cached = airportCache.get(code);
  if (cached && Date.now() - cached.createdAt < AIRPORT_CACHE_TTL_MS) return cached.name;

  try {
    const rows = await airLabsRequest("airports", {
      iata_code: code,
      _fields: "name,iata_code",
      limit: "1",
    }, apiKey);
    const firstRow = rows[0];
    const name = firstRow ? firstText(firstRow, ["name", "airport_name"]) : null;
    airportCache.set(code, { createdAt: Date.now(), name });
    if (airportCache.size > 400) airportCache.delete(airportCache.keys().next().value ?? code);
    return name;
  } catch {
    // Airport enrichment must never make an otherwise valid flight lookup fail.
    airportCache.set(code, { createdAt: Date.now(), name: null });
    return null;
  }
}

async function normalize(row: Row, requestedFlightNumber: string, requestedDate: string | null, apiKey: string) {
  const base = normalizeBase(row, requestedFlightNumber, requestedDate);
  const [departureName, arrivalName] = await Promise.all([
    base.departure.airportName ? Promise.resolve(base.departure.airportName) : airportName(base.departure.airportCode, apiKey),
    base.arrival.airportName ? Promise.resolve(base.arrival.airportName) : airportName(base.arrival.airportCode, apiKey),
  ]);
  return {
    ...base,
    departure: { ...base.departure, airportName: departureName },
    arrival: { ...base.arrival, airportName: arrivalName },
  };
}

function sameDate(row: Row, requestedDate: string | null) {
  return !requestedDate || rowDate(row) === requestedDate;
}

async function lookupFlight(flightNumber: string, requestedDate: string | null, apiKey: string): Promise<Row | null> {
  const fields = [
    "flight_iata", "flight_icao", "flight_date", "status", "flight_status", "airline_name", "airline_iata", "airline_icao",
    "aircraft_model", "aircraft_icao", "reg_number", "dep_iata", "dep_icao", "dep_name", "dep_airport", "dep_terminal", "dep_gate",
    "dep_time", "dep_scheduled", "dep_estimated", "dep_actual", "arr_iata", "arr_icao", "arr_name", "arr_airport", "arr_terminal",
    "arr_gate", "arr_time", "arr_scheduled", "arr_estimated", "arr_actual", "delayed", "cs_flight_iata",
  ].join(",");

  const flightRows = await airLabsRequest("flight", { flight_iata: flightNumber, _fields: fields }, apiKey);
  const exactFlight = flightRows.find((row) => sameDate(row, requestedDate));
  if (exactFlight) return exactFlight;

  // If the Flight Info endpoint has no matching date, check the real-time airborne feed.
  if (!requestedDate) {
    const liveRows = await airLabsRequest("flights", { flight_iata: flightNumber, _fields: fields, limit: "5" }, apiKey);
    if (liveRows[0]) return liveRows[0];
  }

  // Schedules is the authoritative fallback for current/upcoming airport schedule data.
  const scheduleRows = await airLabsRequest("schedules", { flight_iata: flightNumber, _fields: fields, limit: "50" }, apiKey);
  return scheduleRows.find((row) => sameDate(row, requestedDate)) ?? (!requestedDate ? scheduleRows[0] ?? null : null);
}

async function persistFlightSnapshot(tripId: string, userId: string, data: Awaited<ReturnType<typeof normalize>>) {
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
    updated_at: data.checkedAt,
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
    const forceFresh = request.query.fresh === "1" || request.query.fresh === "true";
    const tripId = typeof request.query.tripId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.query.tripId)
      ? request.query.tripId
      : null;
    const userId = requireRequestUserId(request.authUser?.id);

    if (request.query.tripId && !tripId) throw new HttpError(400, "Invalid trip identifier.", "INVALID_TRIP_ID");
    if (tripId) await loadTripAccess(userId, tripId);
    if (flightNumber.length < 2) throw new HttpError(400, "Enter a valid airline and flight number.", "INVALID_FLIGHT_NUMBER");
    if (request.query.date && !requestedDate) throw new HttpError(400, "Flight date must use YYYY-MM-DD.", "INVALID_FLIGHT_DATE");

    const apiKey = process.env.AIRLABS_API_KEY?.trim() || process.env.FLIGHT_API_KEY?.trim();
    if (!apiKey) {
      throw new HttpError(
        503,
        "Live flight checking requires AIRLABS_API_KEY in apps/api/.env.",
        "FLIGHT_PROVIDER_NOT_CONFIGURED",
      );
    }

    const cacheKey = `${flightNumber}:${requestedDate ?? "latest"}`;
    const cached = flightCache.get(cacheKey);
    if (!forceFresh && cached && Date.now() - cached.createdAt < LIVE_CACHE_TTL_MS) {
      if (tripId) await persistFlightSnapshot(tripId, userId, cached.data);
      response.json({ data: cached.data, cached: true });
      return;
    }

    const selected = await lookupFlight(flightNumber, requestedDate, apiKey);
    if (!selected) {
      throw new HttpError(
        404,
        requestedDate
          ? "No live or currently published schedule matched that flight number and date. AirLabs schedule results are limited to its current live schedule window."
          : "No live or scheduled flight matched that flight number.",
        "FLIGHT_NOT_FOUND",
      );
    }

    const data = await normalize(selected, flightNumber, requestedDate, apiKey);
    flightCache.set(cacheKey, { createdAt: Date.now(), data });
    if (flightCache.size > 250) flightCache.delete(flightCache.keys().next().value ?? cacheKey);
    if (tripId) await persistFlightSnapshot(tripId, userId, data);

    response.setHeader("Cache-Control", "private, no-store");
    response.json({ data, cached: false });
  } catch (error) {
    next(error);
  }
});
