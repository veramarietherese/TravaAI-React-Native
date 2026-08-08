import { Router, type NextFunction, type Request, type Response } from "express";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { loadTripAccess, requireRequestUserId } from "../lib/trip-access.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

export const itineraryRouter = Router();
itineraryRouter.use(requireAuth, requireRole("traveler"));

itineraryRouter.get("/:tripId", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = requireRequestUserId(request.authUser?.id);
    const rawTripId = request.params.tripId;
    const tripId = Array.isArray(rawTripId) ? (rawTripId[0] ?? "") : (rawTripId ?? "");
    await loadTripAccess(userId, tripId);
    const { data, error } = await getSupabaseAdmin()
      .from("trip_activities")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number")
      .order("start_time");
    if (error) throw error;
    response.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});
