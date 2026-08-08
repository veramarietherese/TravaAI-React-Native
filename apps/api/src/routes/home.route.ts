import { Router, type NextFunction, type Request, type Response } from "express";

import { COUNTRY_CENTROIDS } from "../data/country-centroids.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";

export const homeRouter = Router();

type Row = Record<string, unknown>;
type EntityId = string | number;

type QueryResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

function rowsFrom(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstText(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(row: Row, keys: string[]): number {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== "") {
      return numberValue(row[key]);
    }
  }
  return 0;
}

function idValue(value: unknown, fallback: EntityId): EntityId {
  return typeof value === "string" || typeof value === "number" ? value : fallback;
}

function rowId(row: Row): EntityId | null {
  const value = row.trip_id ?? row.id;
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function parseSpecialties(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(text).filter((item): item is string => Boolean(item));
  }

  const raw = text(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(text).filter((item): item is string => Boolean(item));
    }
  } catch {
    // Comma-delimited legacy values are handled below.
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function dateValue(row: Row, kind: "start" | "end"): string | null {
  return firstText(
    row,
    kind === "start"
      ? ["start_date", "departure_date", "date_from"]
      : ["end_date", "return_date", "date_to"],
  );
}

function daysBetween(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function formatTripDate(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "soon";
  const start = new Date(`${startDate}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return "soon";
  const startText = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!endDate) return `${startText}, ${start.getFullYear()}`;
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(end.getTime())) return `${startText}, ${start.getFullYear()}`;
  const endText = end.toLocaleDateString("en-US", {
    month: start.getMonth() === end.getMonth() ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startText} – ${endText}`;
}

interface NormalizedTravelRoute {
  id: string;
  originCode: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationCode: string;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  distanceKm: number;
  traveledAt: string;
  createdAt: string;
}

function normalizeTravelRoute(row: Row): NormalizedTravelRoute {
  return {
    id: String(row.id ?? ""),
    originCode: String(row.origin_code ?? ""),
    originName: String(row.origin_name ?? "Unknown country"),
    originLat: numberValue(row.origin_lat),
    originLng: numberValue(row.origin_lng),
    destinationCode: String(row.destination_code ?? ""),
    destinationName: String(row.destination_name ?? "Unknown country"),
    destinationLat: numberValue(row.destination_lat),
    destinationLng: numberValue(row.destination_lng),
    distanceKm: numberValue(row.distance_km),
    traveledAt: String(row.traveled_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function haversineKm(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(destinationLat - originLat);
  const longitudeDelta = radians(destinationLng - originLng);
  const firstLatitude = radians(originLat);
  const secondLatitude = radians(destinationLat);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, a));
  return Math.round(
    6371.0088 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped)) * 100,
  ) / 100;
}

function validTravelDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

async function runQuery(label: string, query: PromiseLike<QueryResult>): Promise<{ rows: Row[]; failed: boolean }> {
  try {
    const result = await query;
    if (result.error) {
      console.warn(`[home] ${label}: ${result.error.message ?? "query failed"}`);
      return { rows: [], failed: true };
    }
    return { rows: rowsFrom(result.data), failed: false };
  } catch (error) {
    console.warn(`[home] ${label}:`, error);
    return { rows: [], failed: true };
  }
}

async function selectActive(table: string, limit = 12): Promise<{ rows: Row[]; failed: boolean }> {
  const admin = getSupabaseAdmin();
  const active = await runQuery(
    `${table} active`,
    admin.from(table).select("*").eq("is_active", true).limit(limit),
  );
  if (!active.failed) return active;
  return runQuery(`${table} fallback`, admin.from(table).select("*").limit(limit));
}

async function selectOwnedTrips(userId: string): Promise<{ rows: Row[]; failed: boolean }> {
  const admin = getSupabaseAdmin();
  const ownerColumns = ["user_id", "owner_id", "created_by", "created_by_user_id"];
  const results = await Promise.all(
    ownerColumns.map((column) =>
      runQuery(`trips by ${column}`, admin.from("trips").select("*").eq(column, userId)),
    ),
  );

  const byKey = new Map<string, Row>();
  results.flatMap((result) => result.rows).forEach((row) => {
    const id = rowId(row);
    if (id !== null) byKey.set(String(id), row);
  });

  return {
    rows: [...byKey.values()],
    failed: results.every((result) => result.failed),
  };
}

async function selectRelevantDashboardRows(userId: string) {
  const admin = getSupabaseAdmin();
  const [membershipResult, ownedTripResult] = await Promise.all([
    runQuery("user trip memberships", admin.from("trip_members").select("*").eq("user_id", userId)),
    selectOwnedTrips(userId),
  ]);

  const memberTripIds = membershipResult.rows
    .map((row) => row.trip_id)
    .filter((value): value is EntityId => typeof value === "string" || typeof value === "number");

  const memberTrips = memberTripIds.length
    ? await runQuery("member trips", admin.from("trips").select("*").in("trip_id", memberTripIds))
    : { rows: [] as Row[], failed: false };

  const tripMap = new Map<string, Row>();
  [...ownedTripResult.rows, ...memberTrips.rows].forEach((row) => {
    const id = rowId(row);
    if (id !== null) tripMap.set(String(id), row);
  });
  const trips = [...tripMap.values()];
  const tripIds = trips
    .map(rowId)
    .filter((value): value is EntityId => value !== null);

  const [members, expenses, flights, routes, tours, agencies, notifications] = await Promise.all([
    tripIds.length
      ? runQuery("trip members", admin.from("trip_members").select("*").in("trip_id", tripIds))
      : Promise.resolve({ rows: [] as Row[], failed: false }),
    tripIds.length
      ? runQuery("trip expenses", admin.from("expense_tracking").select("*").in("trip_id", tripIds))
      : Promise.resolve({ rows: [] as Row[], failed: false }),
    tripIds.length
      ? runQuery("trip flights", admin.from("trip_flights").select("*").in("trip_id", tripIds))
      : Promise.resolve({ rows: [] as Row[], failed: false }),
    runQuery(
      "travel routes",
      admin
        .from("travel_routes")
        .select("*")
        .eq("user_id", userId)
        .order("traveled_at", { ascending: true })
        .order("created_at", { ascending: true }),
    ),
    selectActive("tour_packages"),
    selectActive("travel_agencies"),
    runQuery(
      "notifications",
      admin.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
    ),
  ]);

  return {
    trips,
    members: members.rows,
    expenses: expenses.rows,
    flights: flights.rows,
    routes: routes.rows,
    tours: tours.rows,
    agencies: agencies.rows,
    notifications: notifications.rows,
    partial: [
      membershipResult.failed,
      ownedTripResult.failed && memberTrips.failed,
      members.failed,
      expenses.failed,
      flights.failed,
      routes.failed,
      tours.failed,
      agencies.failed,
    ].some(Boolean),
  };
}

function normalizeDashboard(input: {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  trips: Row[];
  members: Row[];
  expenses: Row[];
  flights: Row[];
  routes: Row[];
  tours: Row[];
  agencies: Row[];
  notifications: Row[];
  partial: boolean;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingRaw =
    input.trips
      .filter((trip) => {
        const endDate = dateValue(trip, "end") ?? dateValue(trip, "start");
        if (!endDate) return false;
        const end = new Date(`${endDate}T23:59:59`);
        return Number.isFinite(end.getTime()) && end >= today;
      })
      .sort((a, b) => (dateValue(a, "start") ?? "9999-12-31").localeCompare(dateValue(b, "start") ?? "9999-12-31"))[0] ?? null;

  const upcomingId = upcomingRaw ? rowId(upcomingRaw) : null;
  const upcomingMembers = upcomingId
    ? input.members.filter((row) => {
        const status = String(row.status ?? "").toLowerCase();
        return String(row.trip_id) === String(upcomingId) && ["accepted", "joined", "active"].includes(status);
      })
    : [];
  const upcomingSpent = upcomingId
    ? input.expenses
        .filter((row) => String(row.trip_id) === String(upcomingId) && row.is_deleted !== true)
        .reduce((sum, row) => sum + firstNumber(row, ["amount", "total", "cost"]), 0)
    : 0;

  const upcomingTrip = upcomingRaw && upcomingId !== null
    ? {
        id: upcomingId,
        name: firstText(upcomingRaw, ["trip_name", "name", "title", "destination"]) ?? "Upcoming trip",
        destination: firstText(upcomingRaw, ["destination", "city", "country"]),
        startDate: dateValue(upcomingRaw, "start"),
        endDate: dateValue(upcomingRaw, "end"),
        imageUrl: firstText(upcomingRaw, ["cover_image_url", "image_url", "destination_image_url", "photo_url"]),
        currencyCode: firstText(upcomingRaw, ["currency_code", "currency"]) ?? "PHP",
        totalBudget: firstNumber(upcomingRaw, ["total_budget", "budget", "budget_amount"]),
        spent: upcomingSpent,
        memberCount: upcomingMembers.length,
      }
    : null;

  const travelRows = input.routes.length ? input.routes : input.flights;
  const countries = new Set<string>();
  travelRows.forEach((row) => {
    [
      "origin_code",
      "destination_code",
      "origin_country",
      "destination_country",
      "country",
    ].forEach((key) => {
      const value = text(row[key]);
      if (value) countries.add(value.toUpperCase());
    });
  });

  const now = new Date();
  const routeTravelDays = new Set(
    input.routes
      .map((row) => firstText(row, ["traveled_at", "travel_date", "date"]))
      .filter((value): value is string => Boolean(value)),
  ).size;
  const stats = {
    totalDistanceKm: travelRows.reduce((sum, row) => sum + firstNumber(row, ["distance_km", "distance"]), 0),
    flights: travelRows.length,
    countries: countries.size,
    daysTraveled: input.routes.length
      ? routeTravelDays
      : input.trips
          .filter((row) => {
            const endDate = dateValue(row, "end");
            if (!endDate) return false;
            const end = new Date(`${endDate}T23:59:59`);
            return Number.isFinite(end.getTime()) && end < now;
          })
          .reduce((sum, row) => sum + daysBetween(dateValue(row, "start"), dateValue(row, "end")), 0),
  };

  const notifications = [] as Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string | null;
    tripId: EntityId | null;
  }>;

  if (upcomingTrip) {
    notifications.push({
      id: `upcoming-${String(upcomingTrip.id)}`,
      title: upcomingTrip.name,
      message: upcomingTrip.startDate
        ? `Your trip starts ${formatTripDate(upcomingTrip.startDate, upcomingTrip.endDate)}.`
        : "Your upcoming trip is ready to continue planning.",
      createdAt: null,
      tripId: upcomingTrip.id,
    });
  }

  input.notifications.forEach((row, index) => {
    notifications.push({
      id: String(row.notification_id ?? row.id ?? `notification-${index}`),
      title: firstText(row, ["title", "subject"]) ?? "TRAVA AI update",
      message: firstText(row, ["message", "body", "description"]) ?? "You have a new update.",
      createdAt: firstText(row, ["created_at", "sent_at"]),
      tripId:
        typeof row.trip_id === "string" || typeof row.trip_id === "number"
          ? row.trip_id
          : null,
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    profile: { id: input.userId, fullName: input.fullName || "Explorer", avatarUrl: input.avatarUrl },
    upcomingTrip,
    stats,
    tours: input.tours.map((row, index) => ({
      id: idValue(row.package_id ?? row.id, `tour-${index}`),
      agencyId:
        typeof (row.agency_id ?? row.provider_id) === "string" || typeof (row.agency_id ?? row.provider_id) === "number"
          ? (row.agency_id ?? row.provider_id)
          : null,
      title: firstText(row, ["title", "name", "package_name"]) ?? "Tour package",
      destination: firstText(row, ["destination", "city", "location"]),
      country: firstText(row, ["country", "destination_country"]),
      category: firstText(row, ["category", "tour_type"]),
      description: firstText(row, ["description", "overview"]),
      imageUrl: firstText(row, ["image_url", "cover_image_url", "photo_url"]),
      durationDays: firstNumber(row, ["duration_days", "days"]),
      durationNights: firstNumber(row, ["duration_nights", "nights"]),
      price: firstNumber(row, ["price", "package_price", "base_price"]),
      currencyCode: firstText(row, ["currency_code", "currency"]) ?? "PHP",
    })),
    agencies: input.agencies.map((row, index) => ({
      id: idValue(row.agency_id ?? row.id, `agency-${index}`),
      name: firstText(row, ["name", "agency_name", "business_name"]) ?? "Travel agency",
      subtitle: firstText(row, ["subtitle", "tagline", "location"]),
      description: firstText(row, ["description", "about", "bio"]),
      logoUrl: firstText(row, ["logo_url", "avatar_url", "image_url"]),
      coverImageUrl: firstText(row, ["cover_image_url", "banner_url", "image_url"]),
      specialties: parseSpecialties(row.specialties ?? row.services ?? row.categories),
      rating: firstNumber(row, ["rating", "average_rating"]),
    })),
    notifications,
    partial: input.partial,
  };
}

async function userCanManageTrip(userId: string, tripId: EntityId): Promise<boolean> {
  const admin = getSupabaseAdmin();

  const membership = await runQuery(
    "invite permission membership",
    admin.from("trip_members").select("*").eq("trip_id", tripId).eq("user_id", userId).limit(1),
  );
  if (membership.rows.some((row) => ["accepted", "joined", "active", "owner"].includes(String(row.status ?? "").toLowerCase()))) {
    return true;
  }

  for (const column of ["user_id", "owner_id", "created_by", "created_by_user_id"]) {
    const owned = await runQuery(
      `invite permission ${column}`,
      admin.from("trips").select("*").eq("trip_id", tripId).eq(column, userId).limit(1),
    );
    if (owned.rows.length) return true;
  }

  return false;
}

homeRouter.get("/dashboard", requireAuth, requireRole("traveler"), async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = request.authUser?.id;
    if (!userId) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
      return;
    }

    const rows = await selectRelevantDashboardRows(userId);
    const profile = request.authProfile as
      | { full_name?: string | null; avatar_url?: string | null }
      | undefined;

    const data = normalizeDashboard({
      userId,
      fullName:
        text(profile?.full_name) ||
        text(request.authUser?.user_metadata?.full_name) ||
        text(request.authUser?.user_metadata?.name) ||
        text(request.authUser?.email?.split("@")[0]) ||
        "Explorer",
      avatarUrl:
        profile?.avatar_url ||
        (typeof request.authUser?.user_metadata?.avatar_url === "string"
          ? request.authUser.user_metadata.avatar_url
          : null),
      ...rows,
    });

    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

homeRouter.get("/travel-routes", requireAuth, requireRole("traveler"), async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = request.authUser?.id;
    if (!userId) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("travel_routes")
      .select("*")
      .eq("user_id", userId)
      .order("traveled_at", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;

    response.status(200).json({ data: rowsFrom(data).map(normalizeTravelRoute) });
  } catch (error) {
    next(error);
  }
});

homeRouter.post("/travel-routes", requireAuth, requireRole("traveler"), async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = request.authUser?.id;
    const originCode = typeof request.body?.originCode === "string"
      ? request.body.originCode.trim().toUpperCase()
      : "";
    const destinationCode = typeof request.body?.destinationCode === "string"
      ? request.body.destinationCode.trim().toUpperCase()
      : "";
    const origin = COUNTRY_CENTROIDS[originCode];
    const destination = COUNTRY_CENTROIDS[destinationCode];
    const requestedDate = request.body?.traveledAt;
    const traveledAt = requestedDate === undefined || requestedDate === null || requestedDate === ""
      ? new Date().toISOString().slice(0, 10)
      : validTravelDate(requestedDate);

    if (!userId) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
      return;
    }
    if (!origin || !destination) {
      response.status(400).json({ error: { code: "INVALID_COUNTRY", message: "Choose two valid countries." } });
      return;
    }
    if (originCode === destinationCode) {
      response.status(400).json({ error: { code: "SAME_COUNTRY", message: "Origin and destination must be different countries." } });
      return;
    }
    if (!traveledAt) {
      response.status(400).json({ error: { code: "INVALID_DATE", message: "Travel date must use YYYY-MM-DD." } });
      return;
    }

    const distanceKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("travel_routes")
      .insert({
        user_id: userId,
        origin_code: originCode,
        origin_name: origin.name,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_code: destinationCode,
        destination_name: destination.name,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        distance_km: distanceKm,
        traveled_at: traveledAt,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Travel route was not created.");

    response.status(201).json({ data: normalizeTravelRoute(data as Row) });
  } catch (error) {
    next(error);
  }
});

homeRouter.delete("/travel-routes/:routeId", requireAuth, requireRole("traveler"), async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = request.authUser?.id;
    const routeId = request.params.routeId;
    if (!userId) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
      return;
    }
    if (!routeId) {
      response.status(400).json({ error: { code: "INVALID_ROUTE", message: "A valid route is required." } });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("travel_routes")
      .delete()
      .eq("id", routeId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) {
      response.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "That travel route was not found." } });
      return;
    }

    response.status(200).json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

homeRouter.post("/invitations", requireAuth, requireRole("traveler"), async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = request.authUser?.id;
    const tripId = request.body?.tripId as unknown;
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";

    if (!userId || (typeof tripId !== "string" && typeof tripId !== "number")) {
      response.status(400).json({ error: { code: "INVALID_TRIP", message: "A valid trip is required." } });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ error: { code: "INVALID_EMAIL", message: "Enter a valid TRAVA AI account email." } });
      return;
    }
    if (!(await userCanManageTrip(userId, tripId))) {
      response.status(403).json({ error: { code: "FORBIDDEN", message: "You cannot invite members to this trip." } });
      return;
    }

    const admin = getSupabaseAdmin();
    let target = await runQuery("invite profile lookup", admin.from("profiles").select("*").eq("email", email).limit(1));
    let invitedUserId = target.rows[0]?.id;

    if (typeof invitedUserId !== "string") {
      target = await runQuery("invite legacy user lookup", admin.from("users").select("*").eq("email", email).limit(1));
      invitedUserId = target.rows[0]?.user_id ?? target.rows[0]?.id;
    }

    if (typeof invitedUserId !== "string") {
      response.status(404).json({ error: { code: "USER_NOT_FOUND", message: "No TRAVA AI account uses that email yet." } });
      return;
    }
    if (invitedUserId === userId) {
      response.status(400).json({ error: { code: "SELF_INVITE", message: "You are already part of this trip." } });
      return;
    }

    const existing = await runQuery(
      "existing invitation",
      admin.from("trip_members").select("*").eq("trip_id", tripId).eq("user_id", invitedUserId).limit(1),
    );

    if (existing.rows.length) {
      const { error } = await admin
        .from("trip_members")
        .update({ status: "pending" })
        .eq("trip_id", tripId)
        .eq("user_id", invitedUserId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("trip_members").insert({
        trip_id: tripId,
        user_id: invitedUserId,
        status: "pending",
      });
      if (error) throw error;
    }

    response.status(200).json({ data: { message: "Invitation sent." } });
  } catch (error) {
    next(error);
  }
});

homeRouter.post("/feedback", requireAuth, requireRole("traveler"), async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = request.authUser?.id;
    const listingType = request.body?.listingType;
    const rating = Number(request.body?.rating);
    const packageId = request.body?.packageId ?? null;
    const agencyId = request.body?.agencyId ?? null;
    const comment = typeof request.body?.comment === "string" ? request.body.comment.trim().slice(0, 500) : "";

    if (!userId || typeof listingType !== "string" || !["tour", "agency"].includes(listingType)) {
      response.status(400).json({ error: { code: "INVALID_LISTING", message: "Choose a valid listing." } });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      response.status(400).json({ error: { code: "INVALID_RATING", message: "Rating must be between 1 and 5." } });
      return;
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("travel_listing_feedback").insert({
      user_id: userId,
      listing_type: listingType,
      package_id: listingType === "tour" ? packageId : null,
      agency_id: agencyId,
      rating,
      comment: comment || null,
    });
    if (error) throw error;

    response.status(201).json({ data: { message: "Thank you. Your feedback was submitted." } });
  } catch (error) {
    next(error);
  }
});
