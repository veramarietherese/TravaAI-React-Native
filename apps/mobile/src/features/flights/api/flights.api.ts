import type { FlightStatus } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export async function checkFlightStatus(
  flightNumber: string,
  date?: string | null,
  tripId?: string,
  fresh = false,
): Promise<FlightStatus> {
  const normalized = flightNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const query = new URLSearchParams({ flightNumber: normalized });
  if (date) query.set("date", date);
  if (tripId) query.set("tripId", tripId);
  if (fresh) query.set("fresh", "1");

  const result = await apiRequest<{ data: FlightStatus }>(`/api/flights/status?${query.toString()}`);
  return result.data;
}
