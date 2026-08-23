import type { TripMember } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export async function listTripMembers(tripId: string): Promise<{ members: TripMember[]; canManage: boolean }> {
  const result = await apiRequest<{ data: TripMember[]; permissions: { canManage: boolean } }>(`/api/trips/${tripId}/members`);
  return { members: result.data, canManage: result.permissions.canManage };
}

export async function inviteTripMember(tripId: string, email: string): Promise<string> {
  const result = await apiRequest<{ message: string }>(`/api/trips/${tripId}/members/invite`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return result.message;
}

export async function removeTripMember(tripId: string, memberId: string): Promise<void> {
  await apiRequest<void>(`/api/trips/${tripId}/members/${memberId}`, { method: "DELETE" });
}
