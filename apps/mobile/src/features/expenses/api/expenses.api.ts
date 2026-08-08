import type { ExpenseSplitMethod, TripExpense, TripMember } from "@trava/shared";

import { apiRequest } from "@/lib/api-client";

export interface ExpenseInput {
  title: string;
  description?: string | null;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy: string;
  splitMethod: ExpenseSplitMethod;
  receiptStoragePath?: string | null;
  notes?: string | null;
  splits: Array<{ userId: string; amount: number }>;
}

export async function listExpenses(tripId: string): Promise<{ expenses: TripExpense[]; members: TripMember[]; canEditAll: boolean }> {
  const result = await apiRequest<{ data: TripExpense[]; members: TripMember[]; permissions: { canEditAll: boolean } }>(`/api/trips/${tripId}/expenses`);
  return { expenses: result.data, members: result.members, canEditAll: result.permissions.canEditAll };
}

export async function createExpense(tripId: string, input: ExpenseInput): Promise<TripExpense> {
  const result = await apiRequest<{ data: TripExpense }>(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function updateExpense(tripId: string, expenseId: string, input: ExpenseInput): Promise<TripExpense> {
  const result = await apiRequest<{ data: TripExpense }>(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<void> {
  await apiRequest<void>(`/api/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" });
}
