import { getSupabaseAdmin } from "./supabase-admin.js";
import { HttpError } from "./http-error.js";

type Row = Record<string, unknown>;

export interface TripAccess {
  trip: Row;
  role: "owner" | "member";
  membershipId: string | null;
}

export async function loadTripAccess(userId: string, tripId: string): Promise<TripAccess> {
  const admin = getSupabaseAdmin();
  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (tripError) throw tripError;
  if (!trip) throw new HttpError(404, "Trip not found.", "TRIP_NOT_FOUND");

  if (String(trip.user_id ?? "") === userId) {
    return { trip: trip as Row, role: "owner", membershipId: null };
  }

  const { data: membership, error: membershipError } = await admin
    .from("trip_members")
    .select("member_id,status,role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership || String(membership.status).toLowerCase() !== "accepted") {
    throw new HttpError(403, "You do not have access to this trip.", "TRIP_ACCESS_DENIED");
  }

  return {
    trip: trip as Row,
    role: String(membership.role).toLowerCase() === "owner" ? "owner" : "member",
    membershipId: String(membership.member_id),
  };
}

export async function requireTripOwner(userId: string, tripId: string): Promise<TripAccess> {
  const access = await loadTripAccess(userId, tripId);
  if (access.role !== "owner") {
    throw new HttpError(403, "Only the trip owner can perform this action.", "OWNER_REQUIRED");
  }
  return access;
}

export function requireRequestUserId(userId: string | undefined): string {
  if (!userId) throw new HttpError(401, "Authentication is required.", "UNAUTHORIZED");
  return userId;
}
