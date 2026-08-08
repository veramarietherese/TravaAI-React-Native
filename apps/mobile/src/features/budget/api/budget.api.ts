import type { TripBudgetSummary } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export async function fetchBudget(tripId: string): Promise<{ summary: TripBudgetSummary; canManageCategories: boolean }> {
  const result = await apiRequest<{ data: TripBudgetSummary; permissions: { canManageCategories: boolean } }>(`/api/trips/${tripId}/budget`);
  return { summary: result.data, canManageCategories: result.permissions.canManageCategories };
}

export async function createBudgetCategory(tripId: string, name: string, plannedAmount: number) {
  return apiRequest(`/api/trips/${tripId}/budget/categories`, {
    method: "POST",
    body: JSON.stringify({ name, plannedAmount }),
  });
}

export async function updateBudgetCategory(tripId: string, categoryId: string, input: { name?: string; plannedAmount?: number }) {
  return apiRequest(`/api/trips/${tripId}/budget/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteBudgetCategory(tripId: string, categoryId: string) {
  return apiRequest<void>(`/api/trips/${tripId}/budget/categories/${categoryId}`, { method: "DELETE" });
}
