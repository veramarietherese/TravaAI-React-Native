import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { HttpError } from "../lib/http-error.js";
import { createTripMediaSignedUrl, removeTripMedia } from "../lib/trip-media.js";
import { loadTripAccess, requireRequestUserId, requireTripOwner } from "../lib/trip-access.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

type Row = Record<string, unknown>;

const uuidSchema = z.string().uuid();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const nullableDate = z.union([isoDateSchema, z.literal(""), z.null()]).transform((value) => value || null);

const tripInputBaseSchema = z.object({
    name: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1200).nullable().optional(),
    startDate: nullableDate.optional(),
    endDate: nullableDate.optional(),
    totalBudget: z.coerce.number().min(0).max(999999999),
    currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    travelStyle: z.string().trim().max(80).nullable().optional(),
    travelGroup: z.string().trim().max(80).nullable().optional(),
    coverStoragePath: z.string().trim().max(500).nullable().optional(),
    status: z.enum(["draft", "upcoming", "ongoing", "completed"]).optional(),
    flightNumber: z.string().trim().toUpperCase().max(12).nullable().optional(),
    flightDate: nullableDate.optional(),
  });
const validTripDates = (value: { startDate?: string | null; endDate?: string | null }) => !value.startDate || !value.endDate || value.endDate >= value.startDate;
const tripInputSchema = tripInputBaseSchema.refine(validTripDates, { path: ["endDate"], message: "End date must be on or after the start date." });
const tripPatchSchema = tripInputBaseSchema.partial().refine(validTripDates, { path: ["endDate"], message: "End date must be on or after the start date." });
const activityBaseSchema = z.object({
    dayNumber: z.coerce.number().int().min(1).max(365),
    activityDate: nullableDate.optional(),
    title: z.string().trim().min(2).max(140),
    category: z.enum(["flight", "stay", "food", "sightseeing", "transport", "shopping", "meeting", "other"]),
    locationName: z.string().trim().min(2).max(240),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal(""), z.null()]).optional(),
    notes: z.string().trim().max(1200).nullable().optional(),
    estimatedCost: z.coerce.number().min(0).max(999999999),
  });
const validActivityTimes = (value: { startTime?: string; endTime?: string | null }) => !value.startTime || !value.endTime || value.endTime >= value.startTime;
const activitySchema = activityBaseSchema.refine(validActivityTimes, { path: ["endTime"], message: "End time must be after the start time." });
const activityPatchSchema = activityBaseSchema.partial().refine(validActivityTimes, { path: ["endTime"], message: "End time must be after the start time." });
const categorySchema = z.object({ name: z.string().trim().min(2).max(80), plannedAmount: z.coerce.number().min(0).max(999999999) });
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320) });
const invitationResponseSchema = z.object({ action: z.enum(["accept", "reject"]) });
const splitSchema = z.object({ userId: uuidSchema, amount: z.coerce.number().min(0).max(999999999) });
const expenseSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(800).nullable().optional(),
  category: z.string().trim().min(2).max(80),
  amount: z.coerce.number().positive().max(999999999),
  expenseDate: isoDateSchema,
  paidBy: uuidSchema,
  splitMethod: z.enum(["equal", "exact", "payer_only"]),
  receiptStoragePath: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(1200).nullable().optional(),
  splits: z.array(splitSchema).min(1).max(100),
});
const flightConfigSchema = z.object({
  flightNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/),
  flightDate: nullableDate.optional(),
});

async function resolveTravelerExact(identityRaw: unknown) {
  const identity = typeof identityRaw === "string" ? identityRaw.trim() : "";
  if (identity.length < 3 || identity.length > 320) return null;
  const admin = getSupabaseAdmin();
  const isEmail = identity.includes("@");
  let result;
  if (isEmail) {
    result = await admin.from("profiles").select("id,email,full_name,avatar_url,role").eq("role", "traveler").eq("email", identity.toLowerCase()).limit(2);
  } else {
    // ilike is used only to allow case-insensitive matching. We still perform an
    // exact normalized comparison below and never return prefix/partial matches.
    result = await admin.from("profiles").select("id,email,full_name,avatar_url,role").eq("role", "traveler").ilike("full_name", identity).limit(6);
  }
  if (result.error) throw result.error;
  const normalized = identity.toLocaleLowerCase();
  const exact = (result.data ?? []).filter((person) => {
    const candidate = String(isEmail ? person.email ?? "" : person.full_name ?? "").trim().toLocaleLowerCase();
    return candidate === normalized;
  });
  // Ambiguous full names remain private rather than exposing a list of accounts.
  if (exact.length !== 1) return null;
  const person = exact[0];
  if (!person) return null;
  return {
    email: text(person.email) ?? "",
    fullName: text(person.full_name) ?? text(person.email) ?? "TRAVA traveler",
    avatarUrl: text(person.avatar_url),
  };
}

export const tripsRouter = Router();
tripsRouter.use(requireAuth, requireRole("traveler"));

// Privacy-first collaborator lookup used before a new trip exists. This route
// returns at most one account and only after an exact email/full-name match.
tripsRouter.get("/member-directory/resolve", async (request: Request, response: Response, next: NextFunction) => {
  try {
    requireRequestUserId(request.authUser?.id);
    const person = await resolveTravelerExact(request.query.identity);
    response.json({ data: person });
  } catch (error) {
    next(error);
  }
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpError(400, first?.message ?? "Invalid request.", "VALIDATION_FAILED");
  }
  return result.data;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function dateText(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function calculateStatus(row: Row): "draft" | "upcoming" | "ongoing" | "completed" {
  const explicit = String(row.status ?? "").toLowerCase();
  const start = dateText(row.start_date);
  const end = dateText(row.end_date) ?? start;
  if (explicit === "draft" || !start) return "draft";
  if (explicit === "completed") return "completed";
  const today = new Date().toISOString().slice(0, 10);
  if (end && end < today) return "completed";
  if (start <= today && (!end || end >= today)) return "ongoing";
  return "upcoming";
}

async function profileMap(userIds: string[]): Promise<Map<string, Row>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("id,email,full_name,avatar_url")
    .in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.id), row as Row]));
}

async function acceptedMemberCounts(tripIds: string[]): Promise<Map<string, number>> {
  if (!tripIds.length) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from("trip_members")
    .select("trip_id,user_id,status")
    .in("trip_id", tripIds)
    .eq("status", "accepted");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = String(row.trip_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function tripSummary(row: Row, owner: Row | undefined, memberCount: number) {
  const coverStoragePath = text(row.cover_storage_path);
  const signedCover = coverStoragePath ? await createTripMediaSignedUrl(coverStoragePath) : null;
  const startDate = dateText(row.start_date);
  const endDate = dateText(row.end_date);
  const days = startDate && endDate
    ? Math.max(1, Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000) + 1)
    : Math.max(1, Math.round(numberValue(row.number_of_days)) || 1);

  return {
    id: String(row.trip_id),
    name: text(row.trip_name) ?? text(row.destination) ?? "Untitled Trip",
    destination: text(row.destination) ?? "Destination pending",
    description: text(row.description),
    startDate,
    endDate,
    numberOfDays: days,
    status: calculateStatus(row),
    coverImageUrl: signedCover ?? text(row.cover_image_url),
    coverStoragePath,
    totalBudget: numberValue(row.total_budget),
    currencyCode: text(row.currency_code) ?? "PHP",
    travelStyle: text(row.travel_style),
    travelGroup: text(row.travel_group),
    ownerId: String(row.user_id),
    ownerName: text(owner?.full_name) ?? text(owner?.email) ?? "Trip owner",
    memberCount,
    flightNumber: text(row.flight_number),
    flightDate: dateText(row.flight_date),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function loadMembers(tripId: string, ownerId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("trip_members")
    .select("member_id,trip_id,user_id,role,status,invited_by,created_at,responded_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  if (!rows.some((row) => String(row.user_id) === ownerId)) {
    rows.unshift({
      member_id: `owner-${ownerId}`,
      trip_id: tripId,
      user_id: ownerId,
      role: "owner",
      status: "accepted",
      invited_by: ownerId,
      created_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    });
  }
  const profiles = await profileMap(rows.map((row) => String(row.user_id)));
  return rows.map((row) => {
    const person = profiles.get(String(row.user_id));
    return {
      id: String(row.member_id),
      tripId: String(row.trip_id),
      userId: String(row.user_id),
      email: text(person?.email),
      fullName: text(person?.full_name) ?? text(person?.email) ?? "TRAVA traveler",
      avatarUrl: text(person?.avatar_url),
      role: String(row.user_id) === ownerId || String(row.role).toLowerCase() === "owner" ? "owner" : "member",
      status: String(row.status).toLowerCase() === "accepted"
        ? "accepted"
        : String(row.status).toLowerCase() === "rejected"
          ? "rejected"
          : "pending",
      invitedBy: text(row.invited_by),
      invitedAt: String(row.created_at ?? new Date().toISOString()),
      respondedAt: text(row.responded_at),
    };
  });
}

function activityFrom(row: Row) {
  return {
    id: String(row.activity_id),
    tripId: String(row.trip_id),
    dayNumber: Math.max(1, Math.round(numberValue(row.day_number))),
    activityDate: dateText(row.activity_date),
    title: text(row.title) ?? "Activity",
    category: text(row.category) ?? "other",
    locationName: text(row.location_name) ?? "Location",
    latitude: row.latitude === null || row.latitude === undefined ? null : numberValue(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : numberValue(row.longitude),
    startTime: String(row.start_time ?? "00:00").slice(0, 5),
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    notes: text(row.notes),
    estimatedCost: numberValue(row.estimated_cost),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function expenseFrom(row: Row, profiles: Map<string, Row>) {
  const rawSplits = Array.isArray(row.expense_splits) ? (row.expense_splits as Row[]) : [];
  const receiptPath = text(row.receipt_storage_path);
  const receiptUrl = receiptPath ? await createTripMediaSignedUrl(receiptPath) : null;
  return {
    id: String(row.expense_id),
    tripId: String(row.trip_id),
    title: text(row.title) ?? "Trip expense",
    description: text(row.description),
    category: text(row.category) ?? "Other",
    amount: numberValue(row.amount),
    expenseDate: dateText(row.expense_date) ?? new Date().toISOString().slice(0, 10),
    paidBy: String(row.paid_by),
    paidByName: text(profiles.get(String(row.paid_by))?.full_name) ?? "Traveler",
    splitMethod: text(row.split_method) ?? "equal",
    receiptUrl: receiptUrl ?? text(row.receipt_url),
    receiptStoragePath: receiptPath,
    createdBy: String(row.created_by),
    notes: text(row.notes),
    splits: rawSplits.map((split) => ({
      id: String(split.split_id),
      expenseId: String(split.expense_id),
      userId: String(split.user_id),
      fullName: text(profiles.get(String(split.user_id))?.full_name) ?? "Traveler",
      amount: numberValue(split.amount),
    })),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

tripsRouter.get("/", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const admin = getSupabaseAdmin();
    const [owned, memberships] = await Promise.all([
      admin.from("trips").select("*").eq("user_id", userId),
      admin.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "accepted"),
    ]);
    if (owned.error) throw owned.error;
    if (memberships.error) throw memberships.error;

    const memberIds = (memberships.data ?? []).map((row) => String(row.trip_id));
    const memberTrips = memberIds.length
      ? await admin.from("trips").select("*").in("trip_id", memberIds)
      : { data: [], error: null };
    if (memberTrips.error) throw memberTrips.error;

    const map = new Map<string, Row>();
    [...(owned.data ?? []), ...(memberTrips.data ?? [])].forEach((row) => map.set(String(row.trip_id), row as Row));
    const rows = [...map.values()];
    const owners = await profileMap(rows.map((row) => String(row.user_id)));
    const counts = await acceptedMemberCounts(rows.map((row) => String(row.trip_id)));
    const trips = await Promise.all(rows.map((row) => tripSummary(row, owners.get(String(row.user_id)), counts.get(String(row.trip_id)) ?? 1)));
    trips.sort((a, b) => (a.startDate ?? "9999-12-31").localeCompare(b.startDate ?? "9999-12-31"));
    response.json({ data: trips });
  } catch (error) {
    next(error);
  }
});

tripsRouter.get("/invitations", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const admin = getSupabaseAdmin();
    const { data: memberships, error } = await admin
      .from("trip_members")
      .select("member_id,trip_id,invited_by,created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (memberships ?? []) as Row[];
    const tripIds = rows.map((row) => String(row.trip_id));
    const inviterIds = rows.map((row) => String(row.invited_by ?? "")).filter(Boolean);
    const trips = tripIds.length ? await admin.from("trips").select("*").in("trip_id", tripIds) : { data: [], error: null };
    if (trips.error) throw trips.error;
    const tripMap = new Map((trips.data ?? []).map((row) => [String(row.trip_id), row as Row]));
    const inviters = await profileMap(inviterIds);
    const data = await Promise.all(rows.map(async (row) => {
      const trip = tripMap.get(String(row.trip_id));
      return {
        membershipId: String(row.member_id),
        tripId: String(row.trip_id),
        tripName: text(trip?.trip_name) ?? "Trip invitation",
        destination: text(trip?.destination) ?? "Destination pending",
        coverImageUrl: text(trip?.cover_storage_path)
          ? await createTripMediaSignedUrl(trip?.cover_storage_path)
          : text(trip?.cover_image_url),
        invitedByName: text(inviters.get(String(row.invited_by))?.full_name) ?? "A traveler",
        invitedAt: String(row.created_at),
      };
    }));
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/invitations/:membershipId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const membershipId = parse(uuidSchema, request.params.membershipId);
    const input = parse(invitationResponseSchema, request.body);
    const { data, error } = await getSupabaseAdmin()
      .from("trip_members")
      .update({ status: input.action === "accept" ? "accepted" : "rejected", responded_at: new Date().toISOString() })
      .eq("member_id", membershipId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("member_id,trip_id,status")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Invitation not found or already handled.", "INVITATION_NOT_FOUND");
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const input = parse(tripInputSchema, request.body);
    if (input.coverStoragePath && !input.coverStoragePath.startsWith(`${userId}/trips/`)) {
      throw new HttpError(400, "Invalid cover image path.", "INVALID_MEDIA_PATH");
    }
    const admin = getSupabaseAdmin();
    const { data: trip, error } = await admin.from("trips").insert({
      user_id: userId,
      trip_name: input.name,
      destination: input.destination,
      description: input.description ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      total_budget: input.totalBudget,
      currency_code: input.currencyCode,
      travel_style: input.travelStyle ?? null,
      travel_group: input.travelGroup ?? null,
      cover_storage_path: input.coverStoragePath ?? null,
      status: input.status ?? (input.startDate ? "upcoming" : "draft"),
      flight_number: input.flightNumber ?? null,
      flight_date: input.flightDate ?? null,
    }).select("*").single();
    if (error) throw error;
    const { error: ownerMembershipError } = await admin.from("trip_members").upsert({
      trip_id: trip.trip_id,
      user_id: userId,
      role: "owner",
      status: "accepted",
      invited_by: userId,
      responded_at: new Date().toISOString(),
    }, { onConflict: "trip_id,user_id" });
    if (ownerMembershipError) {
      await admin.from("trips").delete().eq("trip_id", trip.trip_id);
      if (input.coverStoragePath) await removeTripMedia([input.coverStoragePath]);
      throw ownerMembershipError;
    }
    const ownerProfile = await profileMap([userId]);
    response.status(201).json({ data: await tripSummary(trip as Row, ownerProfile.get(userId), 1) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.get("/:tripId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await loadTripAccess(userId, tripId);
    const ownerId = String(access.trip.user_id);
    const members = await loadMembers(tripId, ownerId);
    const owner = members.find((member) => member.userId === ownerId) ?? members[0];
    if (!owner) throw new HttpError(500, "Trip owner profile is unavailable.");
    const summary = await tripSummary(access.trip, { full_name: owner.fullName, email: owner.email }, members.filter((member) => member.status === "accepted").length);
    response.json({ data: { ...summary, owner, members, currentUserRole: access.role, canManageTrip: access.role === "owner", canManageMembers: access.role === "owner" } });
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/:tripId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await requireTripOwner(userId, tripId);
    const input = parse(tripPatchSchema, request.body);
    if (input.coverStoragePath && !input.coverStoragePath.startsWith(`${userId}/trips/${tripId}/`)) {
      throw new HttpError(400, "Invalid cover image path.", "INVALID_MEDIA_PATH");
    }
    const patch: Row = {};
    if (input.name !== undefined) patch.trip_name = input.name;
    if (input.destination !== undefined) patch.destination = input.destination;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.startDate !== undefined) patch.start_date = input.startDate;
    if (input.endDate !== undefined) patch.end_date = input.endDate;
    if (input.totalBudget !== undefined) patch.total_budget = input.totalBudget;
    if (input.currencyCode !== undefined) patch.currency_code = input.currencyCode;
    if (input.travelStyle !== undefined) patch.travel_style = input.travelStyle ?? null;
    if (input.travelGroup !== undefined) patch.travel_group = input.travelGroup ?? null;
    if (input.status !== undefined) patch.status = input.status;
    if (input.coverStoragePath !== undefined) patch.cover_storage_path = input.coverStoragePath ?? null;
    if (input.flightNumber !== undefined) patch.flight_number = input.flightNumber ?? null;
    if (input.flightDate !== undefined) patch.flight_date = input.flightDate;
    const { data, error } = await getSupabaseAdmin().from("trips").update(patch).eq("trip_id", tripId).select("*").single();
    if (error) throw error;
    const oldPath = text(access.trip.cover_storage_path);
    const newPath = text(data.cover_storage_path);
    if (oldPath && oldPath !== newPath) await removeTripMedia([oldPath]);
    const ownerProfile = await profileMap([userId]);
    const counts = await acceptedMemberCounts([tripId]);
    response.json({ data: await tripSummary(data as Row, ownerProfile.get(userId), counts.get(tripId) ?? 1) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.delete("/:tripId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await requireTripOwner(userId, tripId);
    const admin = getSupabaseAdmin();
    const { data: receipts } = await admin.from("expense_tracking").select("receipt_storage_path").eq("trip_id", tripId);
    const mediaPaths = [access.trip.cover_storage_path, ...(receipts ?? []).map((row) => row.receipt_storage_path)];
    const { error } = await admin.from("trips").delete().eq("trip_id", tripId);
    if (error) throw error;
    await removeTripMedia(mediaPaths);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

tripsRouter.get("/:tripId/members", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await loadTripAccess(userId, tripId);
    response.json({ data: await loadMembers(tripId, String(access.trip.user_id)), permissions: { canManage: access.role === "owner" } });
  } catch (error) {
    next(error);
  }
});



// Owner-only traveler directory search used by the collaboration picker.
// It returns a small, minimal result set and excludes users who already belong to the trip.
tripsRouter.get("/:tripId/members/search", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await requireTripOwner(userId, tripId);

    const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
    if (query.length < 2) {
      response.json({ data: [] });
      return;
    }
    if (query.length > 80) {
      throw new HttpError(400, "Search text is too long.", "DIRECTORY_QUERY_TOO_LONG");
    }

    const admin = getSupabaseAdmin();
    const { data: memberships, error: membershipError } = await admin
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", tripId);
    if (membershipError) throw membershipError;

    const excluded = new Set<string>([
      userId,
      ...(memberships ?? []).map((row) => String(row.user_id)),
    ]);
    const pattern = `%${query}%`;

    const [nameResult, emailResult] = await Promise.all([
      admin
        .from("profiles")
        .select("id,email,full_name,avatar_url,role")
        .eq("role", "traveler")
        .ilike("full_name", pattern)
        .limit(8),
      admin
        .from("profiles")
        .select("id,email,full_name,avatar_url,role")
        .eq("role", "traveler")
        .ilike("email", pattern)
        .limit(8),
    ]);
    if (nameResult.error) throw nameResult.error;
    if (emailResult.error) throw emailResult.error;

    const merged = new Map<string, Row>();
    for (const person of [...(nameResult.data ?? []), ...(emailResult.data ?? [])]) {
      const id = String(person.id ?? "");
      if (!id || excluded.has(id) || merged.has(id)) continue;
      merged.set(id, person as Row);
      if (merged.size >= 8) break;
    }

    response.json({
      data: [...merged.values()].map((person) => ({
        id: String(person.id),
        email: text(person.email) ?? "",
        fullName: text(person.full_name) ?? text(person.email) ?? "TRAVA traveler",
        avatarUrl: text(person.avatar_url),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Privacy-first exact collaborator resolver. No prefix suggestions are exposed.
tripsRouter.get("/:tripId/members/resolve", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await requireTripOwner(userId, tripId);
    const person = await resolveTravelerExact(request.query.identity);
    response.json({ data: person });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/:tripId/members/invite", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await requireTripOwner(userId, tripId);
    const { email } = parse(inviteSchema, request.body);
    const admin = getSupabaseAdmin();
    const { data: person, error: profileError } = await admin.from("profiles").select("id,email,full_name,role").ilike("email", email).eq("role", "traveler").maybeSingle();
    if (profileError) throw profileError;
    if (!person) throw new HttpError(404, "No registered TRAVA AI traveler uses that email.", "TRAVELER_NOT_FOUND");
    if (String(person.id) === userId) throw new HttpError(400, "You are already the trip owner.", "ALREADY_OWNER");
    const { data, error } = await admin.from("trip_members").upsert({
      trip_id: tripId,
      user_id: person.id,
      role: "member",
      status: "pending",
      invited_by: userId,
      responded_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "trip_id,user_id" }).select("member_id,trip_id,user_id,status,created_at").single();
    if (error) throw error;
    response.status(201).json({ data, message: `Invitation sent to ${person.full_name || person.email}.` });
  } catch (error) {
    next(error);
  }
});

tripsRouter.delete("/:tripId/members/:memberId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const memberId = parse(uuidSchema, request.params.memberId);
    const access = await requireTripOwner(userId, tripId);
    const { data: membership, error: readError } = await getSupabaseAdmin().from("trip_members").select("member_id,user_id").eq("member_id", memberId).eq("trip_id", tripId).maybeSingle();
    if (readError) throw readError;
    if (!membership) throw new HttpError(404, "Trip member not found.", "MEMBER_NOT_FOUND");
    if (String(membership.user_id) === String(access.trip.user_id)) throw new HttpError(400, "The trip owner cannot be removed.", "OWNER_CANNOT_BE_REMOVED");
    const { error } = await getSupabaseAdmin().from("trip_members").delete().eq("member_id", memberId).eq("trip_id", tripId);
    if (error) throw error;
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

tripsRouter.get("/:tripId/activities", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await loadTripAccess(userId, tripId);
    const { data, error } = await getSupabaseAdmin().from("trip_activities").select("*").eq("trip_id", tripId).order("day_number").order("start_time");
    if (error) throw error;
    response.json({ data: (data ?? []).map((row) => activityFrom(row as Row)) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/:tripId/activities", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await loadTripAccess(userId, tripId);
    const input = parse(activitySchema, request.body);
    const { data, error } = await getSupabaseAdmin().from("trip_activities").insert({
      trip_id: tripId,
      day_number: input.dayNumber,
      activity_date: input.activityDate ?? null,
      title: input.title,
      category: input.category,
      location_name: input.locationName,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      start_time: input.startTime,
      end_time: input.endTime || null,
      notes: input.notes ?? null,
      estimated_cost: input.estimatedCost,
      created_by: userId,
    }).select("*").single();
    if (error) throw error;
    response.status(201).json({ data: activityFrom(data as Row) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/:tripId/activities/:activityId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const activityId = parse(uuidSchema, request.params.activityId);
    const access = await loadTripAccess(userId, tripId);
    const admin = getSupabaseAdmin();
    const { data: current, error: currentError } = await admin.from("trip_activities").select("*").eq("activity_id", activityId).eq("trip_id", tripId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new HttpError(404, "Activity not found.", "ACTIVITY_NOT_FOUND");
    if (access.role !== "owner" && String(current.created_by) !== userId) throw new HttpError(403, "You can edit only activities you created.", "ACTIVITY_EDIT_DENIED");
    const input = parse(activityPatchSchema, request.body);
    const patch: Row = {};
    if (input.dayNumber !== undefined) patch.day_number = input.dayNumber;
    if (input.activityDate !== undefined) patch.activity_date = input.activityDate;
    if (input.title !== undefined) patch.title = input.title;
    if (input.category !== undefined) patch.category = input.category;
    if (input.locationName !== undefined) patch.location_name = input.locationName;
    if (input.latitude !== undefined) patch.latitude = input.latitude;
    if (input.longitude !== undefined) patch.longitude = input.longitude;
    if (input.startTime !== undefined) patch.start_time = input.startTime;
    if (input.endTime !== undefined) patch.end_time = input.endTime || null;
    if (input.notes !== undefined) patch.notes = input.notes ?? null;
    if (input.estimatedCost !== undefined) patch.estimated_cost = input.estimatedCost;
    const { data, error } = await admin.from("trip_activities").update(patch).eq("activity_id", activityId).eq("trip_id", tripId).select("*").single();
    if (error) throw error;
    response.json({ data: activityFrom(data as Row) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.delete("/:tripId/activities/:activityId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const activityId = parse(uuidSchema, request.params.activityId);
    const access = await loadTripAccess(userId, tripId);
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("trip_activities").select("created_by").eq("activity_id", activityId).eq("trip_id", tripId).maybeSingle();
    if (readError) throw readError;
    if (!current) throw new HttpError(404, "Activity not found.", "ACTIVITY_NOT_FOUND");
    if (access.role !== "owner" && String(current.created_by) !== userId) throw new HttpError(403, "You can delete only activities you created.", "ACTIVITY_DELETE_DENIED");
    const { error } = await admin.from("trip_activities").delete().eq("activity_id", activityId).eq("trip_id", tripId);
    if (error) throw error;
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

tripsRouter.get("/:tripId/budget", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await loadTripAccess(userId, tripId);
    const admin = getSupabaseAdmin();
    const [categoryResult, expenseResult, members] = await Promise.all([
      admin.from("trip_budget_categories").select("*").eq("trip_id", tripId).order("name"),
      admin.from("expense_tracking").select("*,expense_splits(*)").eq("trip_id", tripId).eq("is_deleted", false).order("expense_date", { ascending: false }),
      loadMembers(tripId, String(access.trip.user_id)),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (expenseResult.error) throw expenseResult.error;
    const profiles = await profileMap(members.map((member) => member.userId));
    const expenses = await Promise.all((expenseResult.data ?? []).map((row) => expenseFrom(row as Row, profiles)));
    const actualByCategory = new Map<string, number>();
    for (const expense of expenses) actualByCategory.set(expense.category.toLowerCase(), (actualByCategory.get(expense.category.toLowerCase()) ?? 0) + expense.amount);
    const categories = (categoryResult.data ?? []).map((row) => {
      const planned = numberValue(row.planned_amount);
      const actual = actualByCategory.get(String(row.name).toLowerCase()) ?? 0;
      return {
        id: String(row.category_id),
        tripId,
        name: String(row.name),
        plannedAmount: planned,
        actualAmount: actual,
        remainingAmount: planned - actual,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    });
    const balances = members.filter((member) => member.status === "accepted").map((member) => {
      const paid = expenses.filter((expense) => expense.paidBy === member.userId).reduce((sum, expense) => sum + expense.amount, 0);
      const owed = expenses.flatMap((expense) => expense.splits).filter((split) => split.userId === member.userId).reduce((sum, split) => sum + split.amount, 0);
      return { userId: member.userId, fullName: member.fullName, paid, owed, net: paid - owed };
    });
    const actualSpending = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalBudget = numberValue(access.trip.total_budget);
    response.json({
      data: {
        totalBudget,
        actualSpending,
        remainingAmount: totalBudget - actualSpending,
        currencyCode: text(access.trip.currency_code) ?? "PHP",
        categories,
        balances,
      },
      permissions: { canManageCategories: access.role === "owner" },
    });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/:tripId/budget/categories", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await requireTripOwner(userId, tripId);
    const input = parse(categorySchema, request.body);
    const { data, error } = await getSupabaseAdmin().from("trip_budget_categories").insert({ trip_id: tripId, name: input.name, planned_amount: input.plannedAmount, created_by: userId }).select("*").single();
    if (error?.code === "23505") throw new HttpError(409, "A budget category with that name already exists.", "CATEGORY_EXISTS");
    if (error) throw error;
    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/:tripId/budget/categories/:categoryId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const categoryId = parse(uuidSchema, request.params.categoryId);
    await requireTripOwner(userId, tripId);
    const input = parse(categorySchema.partial(), request.body);
    const patch: Row = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.plannedAmount !== undefined) patch.planned_amount = input.plannedAmount;
    const { data, error } = await getSupabaseAdmin().from("trip_budget_categories").update(patch).eq("category_id", categoryId).eq("trip_id", tripId).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Budget category not found.", "CATEGORY_NOT_FOUND");
    response.json({ data });
  } catch (error) {
    next(error);
  }
});

tripsRouter.delete("/:tripId/budget/categories/:categoryId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const categoryId = parse(uuidSchema, request.params.categoryId);
    await requireTripOwner(userId, tripId);
    const { error } = await getSupabaseAdmin().from("trip_budget_categories").delete().eq("category_id", categoryId).eq("trip_id", tripId);
    if (error) throw error;
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

async function validateExpenseParticipants(tripId: string, ownerId: string, paidBy: string, splits: Array<{ userId: string; amount: number }>, amount: number) {
  const members = await loadMembers(tripId, ownerId);
  const accepted = new Set(members.filter((member) => member.status === "accepted").map((member) => member.userId));
  if (!accepted.has(paidBy)) throw new HttpError(400, "The payer must be an accepted trip member.", "INVALID_PAYER");
  if (splits.some((split) => !accepted.has(split.userId))) throw new HttpError(400, "Every split participant must be an accepted trip member.", "INVALID_SPLIT_PARTICIPANT");
  const sum = splits.reduce((total, split) => total + split.amount, 0);
  if (Math.abs(sum - amount) > 0.01) throw new HttpError(400, "Expense splits must add up to the total amount.", "SPLIT_TOTAL_MISMATCH");
}

tripsRouter.get("/:tripId/expenses", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await loadTripAccess(userId, tripId);
    const members = await loadMembers(tripId, String(access.trip.user_id));
    const profiles = await profileMap(members.map((member) => member.userId));
    const { data, error } = await getSupabaseAdmin().from("expense_tracking").select("*,expense_splits(*)").eq("trip_id", tripId).eq("is_deleted", false).order("expense_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    response.json({ data: await Promise.all((data ?? []).map((row) => expenseFrom(row as Row, profiles))), members, permissions: { canEditAll: access.role === "owner" } });
  } catch (error) {
    next(error);
  }
});

tripsRouter.post("/:tripId/expenses", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await loadTripAccess(userId, tripId);
    const input = parse(expenseSchema, request.body);
    if (input.receiptStoragePath && !input.receiptStoragePath.startsWith(`${userId}/trips/${tripId}/receipts/`)) throw new HttpError(400, "Invalid receipt image path.", "INVALID_MEDIA_PATH");
    await validateExpenseParticipants(tripId, String(access.trip.user_id), input.paidBy, input.splits, input.amount);
    const admin = getSupabaseAdmin();
    const { data: expense, error } = await admin.from("expense_tracking").insert({
      trip_id: tripId,
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      amount: input.amount,
      expense_date: input.expenseDate,
      paid_by: input.paidBy,
      split_method: input.splitMethod,
      receipt_storage_path: input.receiptStoragePath ?? null,
      notes: input.notes ?? null,
      created_by: userId,
      is_deleted: false,
    }).select("*").single();
    if (error) throw error;
    const { error: splitError } = await admin.from("expense_splits").insert(input.splits.map((split) => ({ expense_id: expense.expense_id, user_id: split.userId, amount: split.amount })));
    if (splitError) {
      await admin.from("expense_tracking").delete().eq("expense_id", expense.expense_id);
      throw splitError;
    }
    const profiles = await profileMap([...input.splits.map((split) => split.userId), input.paidBy]);
    const { data: hydrated, error: hydratedError } = await admin.from("expense_tracking").select("*,expense_splits(*)").eq("expense_id", expense.expense_id).single();
    if (hydratedError) throw hydratedError;
    response.status(201).json({ data: await expenseFrom(hydrated as Row, profiles) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/:tripId/expenses/:expenseId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const expenseId = parse(uuidSchema, request.params.expenseId);
    const access = await loadTripAccess(userId, tripId);
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("expense_tracking").select("*,expense_splits(*)").eq("expense_id", expenseId).eq("trip_id", tripId).maybeSingle();
    if (readError) throw readError;
    if (!current) throw new HttpError(404, "Expense not found.", "EXPENSE_NOT_FOUND");
    if (access.role !== "owner" && String(current.created_by) !== userId) throw new HttpError(403, "You can edit only expenses you created.", "EXPENSE_EDIT_DENIED");
    const input = parse(expenseSchema, request.body);
    if (input.receiptStoragePath && !input.receiptStoragePath.startsWith(`${userId}/trips/${tripId}/receipts/`) && input.receiptStoragePath !== current.receipt_storage_path) throw new HttpError(400, "Invalid receipt image path.", "INVALID_MEDIA_PATH");
    await validateExpenseParticipants(tripId, String(access.trip.user_id), input.paidBy, input.splits, input.amount);
    const { error } = await admin.from("expense_tracking").update({
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      amount: input.amount,
      expense_date: input.expenseDate,
      paid_by: input.paidBy,
      split_method: input.splitMethod,
      receipt_storage_path: input.receiptStoragePath ?? null,
      notes: input.notes ?? null,
    }).eq("expense_id", expenseId).eq("trip_id", tripId);
    if (error) throw error;
    const { error: deleteSplitsError } = await admin.from("expense_splits").delete().eq("expense_id", expenseId);
    if (deleteSplitsError) throw deleteSplitsError;
    const { error: insertSplitsError } = await admin.from("expense_splits").insert(input.splits.map((split) => ({ expense_id: expenseId, user_id: split.userId, amount: split.amount })));
    if (insertSplitsError) {
      const previousSplits = Array.isArray(current.expense_splits) ? current.expense_splits as Row[] : [];
      await admin.from("expense_tracking").update({
        title: current.title,
        description: current.description,
        category: current.category,
        amount: current.amount,
        expense_date: current.expense_date,
        paid_by: current.paid_by,
        split_method: current.split_method,
        receipt_storage_path: current.receipt_storage_path,
        notes: current.notes,
      }).eq("expense_id", expenseId).eq("trip_id", tripId);
      if (previousSplits.length) {
        await admin.from("expense_splits").insert(previousSplits.map((split) => ({
          expense_id: expenseId,
          user_id: split.user_id,
          amount: split.amount,
        })));
      }
      throw insertSplitsError;
    }
    const oldPath = text(current.receipt_storage_path);
    if (oldPath && oldPath !== input.receiptStoragePath) await removeTripMedia([oldPath]);
    const profiles = await profileMap([...input.splits.map((split) => split.userId), input.paidBy]);
    const { data: hydrated, error: hydratedError } = await admin.from("expense_tracking").select("*,expense_splits(*)").eq("expense_id", expenseId).single();
    if (hydratedError) throw hydratedError;
    response.json({ data: await expenseFrom(hydrated as Row, profiles) });
  } catch (error) {
    next(error);
  }
});

tripsRouter.delete("/:tripId/expenses/:expenseId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const expenseId = parse(uuidSchema, request.params.expenseId);
    const access = await loadTripAccess(userId, tripId);
    const admin = getSupabaseAdmin();
    const { data: current, error: readError } = await admin.from("expense_tracking").select("created_by,receipt_storage_path").eq("expense_id", expenseId).eq("trip_id", tripId).maybeSingle();
    if (readError) throw readError;
    if (!current) throw new HttpError(404, "Expense not found.", "EXPENSE_NOT_FOUND");
    if (access.role !== "owner" && String(current.created_by) !== userId) throw new HttpError(403, "You can delete only expenses you created.", "EXPENSE_DELETE_DENIED");
    const { error } = await admin.from("expense_tracking").delete().eq("expense_id", expenseId).eq("trip_id", tripId);
    if (error) throw error;
    await removeTripMedia([current.receipt_storage_path]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/:tripId/flight", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await requireTripOwner(userId, tripId);
    const input = parse(flightConfigSchema, request.body);
    const { data, error } = await getSupabaseAdmin().from("trips").update({ flight_number: input.flightNumber, flight_date: input.flightDate ?? null }).eq("trip_id", tripId).select("flight_number,flight_date").single();
    if (error) throw error;
    response.json({ data: { flightNumber: data.flight_number, flightDate: dateText(data.flight_date) } });
  } catch (error) {
    next(error);
  }
});


// TRAVA_PERSISTED_WORKSPACE_STATE_V1
tripsRouter.get("/:tripId/workspace-state", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    const access = await loadTripAccess(userId, tripId);
    response.json({
      data: {
        workspace: access.trip.trava_workspace && typeof access.trip.trava_workspace === "object"
          ? access.trip.trava_workspace
          : {},
        updatedAt: String(access.trip.trava_workspace_updated_at ?? access.trip.updated_at ?? new Date(0).toISOString()),
      },
    });
  } catch (error) {
    next(error);
  }
});

tripsRouter.patch("/:tripId/workspace-state", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const tripId = parse(uuidSchema, request.params.tripId);
    await loadTripAccess(userId, tripId);

    const workspace = request.body?.workspace;
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
      throw new HttpError(400, "A workspace object is required.", "INVALID_WORKSPACE");
    }
    const encoded = JSON.stringify(workspace);
    if (encoded.length > 1_500_000) {
      throw new HttpError(413, "Trip workspace is too large to sync.", "WORKSPACE_TOO_LARGE");
    }

    const updatedAt = new Date().toISOString();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("trips")
      .update({ trava_workspace: workspace, trava_workspace_updated_at: updatedAt })
      .eq("trip_id", tripId)
      .select("trava_workspace,trava_workspace_updated_at")
      .single();
    if (error) throw error;

    response.json({
      data: {
        workspace: data?.trava_workspace ?? workspace,
        updatedAt: String(data?.trava_workspace_updated_at ?? updatedAt),
      },
    });
  } catch (error) {
    next(error);
  }
});
