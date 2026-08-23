import { useQuery } from "@tanstack/react-query";
import type { TripSummary } from "@trava/shared";

import { listTrips } from "../api/trips.api";

const FALLBACK: TripSummary = {
  id: "local-japan",
  name: "Japan",
  destination: "Hong Kong",
  description: null,
  startDate: "2025-03-10",
  endDate: "2025-03-17",
  numberOfDays: 8,
  status: "upcoming",
  coverImageUrl: null,
  coverStoragePath: null,
  totalBudget: 90000,
  currencyCode: "PHP",
  travelStyle: null,
  travelGroup: null,
  ownerId: "local",
  ownerName: "Traveler",
  memberCount: 3,
  flightNumber: "PR2334",
  flightDate: "2026-09-18",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

export function useTripLite(tripId: string) {
  const query = useQuery({
    queryKey: ["trips"],
    queryFn: listTrips,
    staleTime: 60_000,
    retry: 1,
  });
  const trip = query.data?.find((item) => item.id === tripId) ?? query.data?.[0] ?? FALLBACK;
  return { trip, query };
}
