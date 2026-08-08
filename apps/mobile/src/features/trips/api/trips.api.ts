import type { TripDetails, TripInvitation, TripSummary } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export interface TripInput {
  name: string;
  destination: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalBudget: number;
  currencyCode: string;
  travelStyle?: string | null;
  travelGroup?: string | null;
  coverStoragePath?: string | null;
  status?: "draft" | "upcoming" | "ongoing" | "completed";
  flightNumber?: string | null;
  flightDate?: string | null;
}

export async function listTrips(): Promise<TripSummary[]> {
  const result = await apiRequest<{ data: TripSummary[] }>("/api/trips");
  return result.data;
}

export async function listTripInvitations(): Promise<TripInvitation[]> {
  const result = await apiRequest<{ data: TripInvitation[] }>("/api/trips/invitations");
  return result.data;
}

export async function respondToTripInvitation(membershipId: string, action: "accept" | "reject") {
  return apiRequest<{ data: { trip_id: string; status: string } }>(`/api/trips/invitations/${membershipId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export async function createTrip(input: TripInput): Promise<TripSummary> {
  const result = await apiRequest<{ data: TripSummary }>("/api/trips", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function fetchTrip(tripId: string): Promise<TripDetails> {
  const result = await apiRequest<{ data: TripDetails }>(`/api/trips/${tripId}`);
  return result.data;
}

export async function updateTrip(tripId: string, input: Partial<TripInput>): Promise<TripSummary> {
  const result = await apiRequest<{ data: TripSummary }>(`/api/trips/${tripId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  await apiRequest<void>(`/api/trips/${tripId}`, { method: "DELETE" });
}

export async function updateTripFlight(tripId: string, flightNumber: string, flightDate: string | null) {
  const result = await apiRequest<{ data: { flightNumber: string; flightDate: string | null } }>(`/api/trips/${tripId}/flight`, {
    method: "PATCH",
    body: JSON.stringify({ flightNumber, flightDate }),
  });
  return result.data;
}
