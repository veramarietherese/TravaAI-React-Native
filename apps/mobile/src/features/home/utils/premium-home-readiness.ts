import type { HomeTripSummary } from "../types/home.types";
import type { WorkspaceState } from "@/features/trips/hooks/useLocalTripWorkspace";

export type TravelMoodKey = "worried" | "neutral" | "winking" | "celebrating";

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

export function calculateTravelReadiness(
  trip: HomeTripSummary | null | undefined,
  workspace: WorkspaceState | null | undefined,
): ReadinessBreakdown {
  if (!trip) {
    return { score: 0, itinerary: 0, budget: 0, documents: 0, checklist: 0, collaborators: 0, tripBasics: 0 };
  }

  // Weighted traveler-readiness model. The weights total 100.
  // It intentionally uses data already present in TRAVA's trip workspace instead of inventing a parallel store.
  const tripBasics = [trip.destination, trip.startDate, trip.endDate].filter(Boolean).length / 3 * 16;
  const itinerary = workspace?.activities?.length ? 22 : 0;
  const budget = (workspace?.totalBudget ?? trip.totalBudget) > 0 ? 14 : 0;
  const documents = workspace?.documents?.length ? 18 : 0;
  const checklistItems = workspace?.checklist ?? [];
  const checklistRatio = checklistItems.length
    ? checklistItems.filter((item) => item.completed).length / checklistItems.length
    : 0;
  const checklist = checklistRatio * 22;
  const collaborators = trip.memberCount > 1 ? 8 : 0;

  return {
    score: clampPercent(tripBasics + itinerary + budget + documents + checklist + collaborators),
    itinerary: clampPercent(itinerary),
    budget: clampPercent(budget),
    documents: clampPercent(documents),
    checklist: clampPercent(checklist),
    collaborators: clampPercent(collaborators),
    tripBasics: clampPercent(tripBasics),
  };
}

export function getTravelMood(score: number): TravelMood {
  if (score <= 24) {
    return {
      key: "worried",
      subtitle: "Just getting started. Let’s build your trip together.",
    };
  }
  if (score <= 49) {
    return {
      key: "neutral",
      subtitle: "You’re making progress. A few essentials still need attention.",
    };
  }
  if (score <= 79) {
    return {
      key: "winking",
      subtitle: "Halfway there! Your adventure is coming together.",
    };
  }
  return {
    key: "celebrating",
    subtitle: "Almost there! Your trip is looking beautifully organized.",
  };
}
