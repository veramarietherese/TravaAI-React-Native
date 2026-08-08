import type { TripActivity } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export type ActivityInput = Omit<TripActivity, "id" | "tripId" | "createdBy" | "createdAt" | "updatedAt">;

export async function listActivities(tripId: string): Promise<TripActivity[]> {
  const result = await apiRequest<{ data: TripActivity[] }>(`/api/trips/${tripId}/activities`);
  return result.data;
}

export async function createActivity(tripId: string, input: ActivityInput): Promise<TripActivity> {
  const result = await apiRequest<{ data: TripActivity }>(`/api/trips/${tripId}/activities`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function updateActivity(tripId: string, activityId: string, input: Partial<ActivityInput>): Promise<TripActivity> {
  const result = await apiRequest<{ data: TripActivity }>(`/api/trips/${tripId}/activities/${activityId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function deleteActivity(tripId: string, activityId: string): Promise<void> {
  await apiRequest<void>(`/api/trips/${tripId}/activities/${activityId}`, { method: "DELETE" });
}
