import { env } from "./env";
import { getSupabaseClient } from "./supabase";

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");
  }

  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;

  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } } | null;
    throw new Error(errorBody?.error?.message ?? `API request failed with status ${response.status}.`);
  }

  return body as T;
}
