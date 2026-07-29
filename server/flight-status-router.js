import express from "express";

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function normalizeFlightNumber(value = "") {
  return String(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
}

function normalizeDate(value = "") {
  const candidate = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate)
    ? candidate
    : "";
}

function compactCache() {
  const now = Date.now();

  for (const [key, item] of cache.entries()) {
    if (now - item.createdAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }

  while (cache.size > 100) {
    cache.delete(cache.keys().next().value);
  }
}

function unwrapAirLabsPayload(payload) {
  const possibleData =
    payload?.response ??
    payload?.data ??
    payload?.result ??
    payload;

  if (Array.isArray(possibleData)) {
    return possibleData[0] || null;
  }

  return possibleData && typeof possibleData === "object"
    ? possibleData
    : null;
}

function toLocalDateTime(value) {
  if (!value) return null;

  const stringValue = String(value).trim();

  // AirLabs usually returns local airport time as YYYY-MM-DD HH:mm.
  // Preserve that local clock value instead of applying the server timezone.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(stringValue)) {
    return stringValue;
  }

  return stringValue;
}

function normalizeFlight(flight, requestedFlightNumber, requestedDate) {
  const departureScheduled = toLocalDateTime(flight?.dep_time);
  const departureEstimated = toLocalDateTime(
    flight?.dep_estimated || flight?.dep_actual,
  );
  const arrivalScheduled = toLocalDateTime(flight?.arr_time);
  const arrivalEstimated = toLocalDateTime(
    flight?.arr_estimated || flight?.arr_actual,
  );

  return {
    source: "airlabs",
    checkedAt: new Date().toISOString(),
    requestedDate: requestedDate || null,
    flightNumber:
      flight?.flight_iata ||
      `${flight?.airline_iata || ""}${flight?.flight_number || ""}` ||
      requestedFlightNumber,
    flightDate:
      String(departureScheduled || "").slice(0, 10) ||
      requestedDate ||
      null,
    status: flight?.status || "scheduled",
    airline: {
      name: flight?.airline_name || null,
      iata: flight?.airline_iata || null,
      icao: flight?.airline_icao || null,
    },
    departure: {
      airport: flight?.dep_name || null,
      timezone: flight?.dep_timezone || null,
      iata: flight?.dep_iata || null,
      icao: flight?.dep_icao || null,
      terminal: flight?.dep_terminal || null,
      gate: flight?.dep_gate || null,
      delay: flight?.dep_delayed ?? flight?.delayed ?? null,
      scheduled: departureScheduled,
      estimated: departureEstimated,
      actual: toLocalDateTime(flight?.dep_actual),
    },
    arrival: {
      airport: flight?.arr_name || null,
      timezone: flight?.arr_timezone || null,
      iata: flight?.arr_iata || null,
      icao: flight?.arr_icao || null,
      terminal: flight?.arr_terminal || null,
      gate: flight?.arr_gate || null,
      baggage: flight?.arr_baggage || null,
      delay: flight?.arr_delayed ?? null,
      scheduled: arrivalScheduled,
      estimated: arrivalEstimated,
      actual: toLocalDateTime(flight?.arr_actual),
    },
  };
}

router.get("/", async (request, response) => {
  const flightNumber = normalizeFlightNumber(
    request.query.flightNumber,
  );
  const date = normalizeDate(request.query.date);

  if (!flightNumber || !/[A-Z]/.test(flightNumber) || !/\d/.test(flightNumber)) {
    return response.status(400).json({
      error:
        "Enter a complete IATA flight number such as PR422 or 5J5062.",
    });
  }

  const apiKey = process.env.AIRLABS_API_KEY;

  if (!apiKey) {
    return response.status(503).json({
      error:
        "The AirLabs API key is missing. Add AIRLABS_API_KEY to the project-root .env file, then restart the backend.",
    });
  }

  compactCache();

  const cacheKey = `${flightNumber}:${date || "closest"}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return response.json({
      ...cached.payload,
      cached: true,
    });
  }

  const query = new URLSearchParams({
    flight_iata: flightNumber,
    api_key: apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const apiResponse = await fetch(
      `https://airlabs.co/api/v9/flight?${query.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    );

    const payload = await apiResponse.json().catch(() => null);

    if (!apiResponse.ok) {
      throw new Error(
        payload?.error?.message ||
          payload?.message ||
          `AirLabs returned HTTP ${apiResponse.status}.`,
      );
    }

    if (payload?.error) {
      throw new Error(
        payload.error.message ||
          payload.error.type ||
          "AirLabs rejected the request.",
      );
    }

    const flight = unwrapAirLabsPayload(payload);

    if (!flight || (!flight.flight_iata && !flight.flight_number)) {
      return response.status(404).json({
        error:
          "No matching flight was found. Check the airline code and flight number, then try again.",
      });
    }

    const normalized = normalizeFlight(
      flight,
      flightNumber,
      date,
    );

    cache.set(cacheKey, {
      payload: normalized,
      createdAt: Date.now(),
    });

    return response.json(normalized);
  } catch (error) {
    console.error("AirLabs flight lookup failed:", {
      flightNumber,
      date,
      message: error?.message,
    });

    if (error?.name === "AbortError") {
      return response.status(504).json({
        error: "AirLabs took too long to respond. Try again.",
      });
    }

    return response.status(502).json({
      error:
        error?.message ||
        "The flight status could not be checked.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
