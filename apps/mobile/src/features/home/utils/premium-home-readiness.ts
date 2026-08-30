import type { WorkspaceState } from "@/features/trips/hooks/useLocalTripWorkspace";
import type { HomeTripSummary } from "../types/home.types";

export type TravelMoodKey = "worried" | "building" | "halfway" | "almost" | "ready";

export interface ReadinessBreakdown {
  score: number;
  itinerary: number;
  budget: number;
  documents: number;
  checklist: number;
  collaborators: number;
  tripBasics: number;
}

export interface TravelMood {
  key: TravelMoodKey;
  subtitle: string;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseTripDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTripDayCount(trip: HomeTripSummary, workspace: WorkspaceState | null | undefined) {
  const start = parseTripDate(trip.startDate);
  const end = parseTripDate(trip.endDate);

  if (start && end && end.getTime() >= start.getTime()) {
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }

  const workspaceDays = workspace?.manualDayCount ?? workspace?.dayCountOverride;
  if (workspaceDays && Number.isFinite(workspaceDays)) return Math.max(1, Math.floor(workspaceDays));
  return 1;
}

/**
 * Travel Pulse deliberately has no manual override. The score is derived only
 * from live trip/workspace data so the mascot cannot be swiped into a false
 * readiness state.
 *
 * Weighting (100 total):
 * - Core trip details: 20
 * - Day-by-day itinerary coverage: 25
 * - Budget set: 15
 * - Travel documents: 15
 * - Checklist completion: 25
 *
 * Collaboration is shown elsewhere in TRAVA but does not affect readiness:
 * solo travelers must be able to reach 100%.
 */
export function calculateTravelReadiness(
  trip: HomeTripSummary | null | undefined,
  workspace: WorkspaceState | null | undefined,
): ReadinessBreakdown {
  if (!trip) {
    return {
      score: 0,
      itinerary: 0,
      budget: 0,
      documents: 0,
      checklist: 0,
      collaborators: 0,
      tripBasics: 0,
    };
  }

  const tripBasics = ([trip.destination, trip.startDate, trip.endDate].filter(Boolean).length / 3) * 20;

  const tripDayCount = getTripDayCount(trip, workspace);
  const coveredItineraryDays = new Set(
    (workspace?.activities ?? [])
      .map((activity) => Number(activity.dayNumber))
      .filter((day) => Number.isFinite(day) && day >= 1 && day <= tripDayCount),
  ).size;
  const itinerary = Math.min(1, coveredItineraryDays / tripDayCount) * 25;

  const totalBudget = Number(workspace?.totalBudget ?? trip.totalBudget ?? 0);
  const budget = Number.isFinite(totalBudget) && totalBudget > 0 ? 15 : 0;

  // Three saved travel documents is treated as a complete document set for
  // this overview. The score remains granular at 0 / 5 / 10 / 15.
  const documentCount = Math.min(3, workspace?.documents?.length ?? 0);
  const documents = (documentCount / 3) * 15;

  const checklistItems = workspace?.checklist ?? [];
  const completedChecklistItems = checklistItems.filter((item) => item.completed).length;
  const checklistRatio = checklistItems.length ? completedChecklistItems / checklistItems.length : 0;
  const checklist = checklistRatio * 25;

  // Intentionally excluded from the total: solo travel is a valid, fully-ready trip.
  const collaborators = 0;

  const score = clampPercent(tripBasics + itinerary + budget + documents + checklist);

  return {
    score,
    itinerary: clampPercent((itinerary / 25) * 100),
    budget: clampPercent((budget / 15) * 100),
    documents: clampPercent((documents / 15) * 100),
    checklist: clampPercent((checklist / 25) * 100),
    collaborators,
    tripBasics: clampPercent((tripBasics / 20) * 100),
  };
}

export function getTravelMood(score: number): TravelMood {
  const readiness = clampPercent(score);

  if (readiness <= 24) {
    return {
      key: "worried",
      subtitle: "Not quite ready yet — start with the essentials below.",
    };
  }

  if (readiness <= 49) {
    return {
      key: "building",
      subtitle: "You’re making progress. A few essentials still need attention.",
    };
  }

  if (readiness <= 69) {
    return {
      key: "halfway",
      subtitle: "Halfway there! Your core trip plans are coming together.",
    };
  }

  if (readiness <= 89) {
    return {
      key: "almost",
      subtitle: "Nearly ready — finish the last important details.",
    };
  }

  return {
    key: "ready",
    subtitle: "You’re travel-ready. Do one final check and enjoy the trip.",
  };
}
