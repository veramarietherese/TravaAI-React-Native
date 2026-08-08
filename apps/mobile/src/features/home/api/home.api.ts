import { apiRequest } from "@/lib/api-client";
import { getSupabaseClient } from "@/lib/supabase";

import type {
  HomeDashboardData,
  HomeFeedbackInput,
  HomeInviteInput,
} from "../types/home.types";
import { normalizeDashboard, type HomeRow } from "../utils/home-normalizers";

interface HomeDashboardEnvelope {
  data: HomeDashboardData;
}

interface ActionEnvelope {
  data: {
    message: string;
  };
}

function fulfilledRows(
  result: PromiseSettledResult<{ data: unknown; error: unknown }>,
): { rows: HomeRow[]; failed: boolean } {
  if (result.status === "rejected" || result.value.error) {
    return { rows: [], failed: true };
  }

  return {
    rows: Array.isArray(result.value.data) ? (result.value.data as HomeRow[]) : [],
    failed: false,
  };
}

async function fetchDashboardFromSupabase(): Promise<HomeDashboardData> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) throw new Error("Your session has expired. Please sign in again.");

  const queries = await Promise.allSettled([
    supabase.from("trips").select("*"),
    supabase.from("trip_members").select("*"),
    supabase.from("expense_tracking").select("*"),
    supabase.from("trip_flights").select("*"),
    supabase
      .from("travel_routes")
      .select("*")
      .order("traveled_at", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("tour_packages").select("*").limit(12),
    supabase.from("travel_agencies").select("*").limit(12),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(6),
  ]);

  const normalizedResults = queries.map(fulfilledRows);
  const emptyResult = { rows: [] as HomeRow[], failed: true };
  const tripResult = normalizedResults[0] ?? emptyResult;
  const memberResult = normalizedResults[1] ?? emptyResult;
  const expenseResult = normalizedResults[2] ?? emptyResult;
  const flightResult = normalizedResults[3] ?? emptyResult;
  const routeResult = normalizedResults[4] ?? emptyResult;
  const tourResult = normalizedResults[5] ?? emptyResult;
  const agencyResult = normalizedResults[6] ?? emptyResult;
  const notificationResult = normalizedResults[7] ?? emptyResult;

  const profileName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email?.split("@")[0] ||
    "Explorer";

  return normalizeDashboard({
    userId: session.user.id,
    fullName: String(profileName),
    avatarUrl:
      typeof session.user.user_metadata?.avatar_url === "string"
        ? session.user.user_metadata.avatar_url
        : null,
    trips: tripResult.rows,
    members: memberResult.rows,
    expenses: expenseResult.rows,
    flights: flightResult.rows,
    routes: routeResult.rows,
    tours: tourResult.rows,
    agencies: agencyResult.rows,
    notifications: notificationResult.rows,
    partial: queries.some((_, index) =>
      [
        tripResult,
        memberResult,
        expenseResult,
        flightResult,
        routeResult,
        tourResult,
        agencyResult,
        notificationResult,
      ][index]?.failed,
    ),
  });
}

export async function fetchHomeDashboard(): Promise<HomeDashboardData> {
  try {
    const response = await apiRequest<HomeDashboardEnvelope>("/api/home/dashboard");
    return response.data;
  } catch (apiError) {
    console.warn("Home API unavailable; using Supabase RLS fallback.", apiError);
    return fetchDashboardFromSupabase();
  }
}

export async function sendHomeInvitation(input: HomeInviteInput): Promise<string> {
  const response = await apiRequest<ActionEnvelope>("/api/home/invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data.message;
}

export async function submitHomeFeedback(input: HomeFeedbackInput): Promise<string> {
  try {
    const response = await apiRequest<ActionEnvelope>("/api/home/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.data.message;
  } catch (apiError) {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw apiError;

    const { error } = await supabase.from("travel_listing_feedback").insert({
      user_id: session.user.id,
      listing_type: input.listingType,
      package_id: input.packageId ?? null,
      agency_id: input.agencyId ?? null,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    });

    if (error) throw new Error(error.message || "Unable to submit feedback.");
    return "Thank you. Your feedback was submitted.";
  }
}
