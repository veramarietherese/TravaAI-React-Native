import type { FlightStatus } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export async function checkFlightStatus(flightNumber: string, date?: string | null, tripId?: string): Promise<FlightStatus> {
  const query = new URLSearchParams({ flightNumber });
  if (date) query.set("date", date);
  if (tripId) query.set("tripId", tripId);
  const result = await apiRequest<{ data: FlightStatus }>(`/api/flights/status?${query.toString()}`);
  return result.data;
}
