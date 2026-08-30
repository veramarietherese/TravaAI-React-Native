import type { TripMember } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export type ResolvedTraveler = {
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

export type DirectoryTraveler = ResolvedTraveler & {
  id: string;
};

export async function listTripMembers(
  tripId: string,
): Promise<{ members: TripMember[]; canManage: boolean }> {
  const result = await apiRequest<{
    data: TripMember[];
    permissions: { canManage: boolean };
  }>(`/api/trips/${tripId}/members`);

  return {
    members: result.data,
    canManage: result.permissions.canManage,
  };
}

export async function searchTripMemberDirectory(
  tripId: string,
  query: string,
): Promise<DirectoryTraveler[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const result = await apiRequest<{ data: DirectoryTraveler[] }>(
    `/api/trips/${tripId}/members/search?q=${encodeURIComponent(normalized)}`,
  );
  return result.data;
}

export async function resolveTripMemberIdentity(
  tripId: string,
  identity: string,
): Promise<ResolvedTraveler | null> {
  const result = await apiRequest<{ data: ResolvedTraveler | null }>(
    `/api/trips/${tripId}/members/resolve?identity=${encodeURIComponent(identity)}`,
  );
  return result.data;
}

export async function inviteTripMember(
  tripId: string,
  email: string,
): Promise<string> {
  const result = await apiRequest<{ message: string }>(
    `/api/trips/${tripId}/members/invite`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
  return result.message;
}

export async function removeTripMember(
  tripId: string,
  memberId: string,
): Promise<void> {
  await apiRequest<void>(`/api/trips/${tripId}/members/${memberId}`, {
    method: "DELETE",
  });
}
