import { Platform } from "react-native";

import { env } from "./env";
import { getSupabaseClient } from "./supabase";

function candidateBases() {
  const configured = env.apiBaseUrl?.replace(/\/$/, "") ?? "";
  const values: string[] = [];
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location?.hostname;
    // On web, prefer the API on the same machine/host as Expo. This prevents a
    // stale phone-LAN EXPO_PUBLIC_API_BASE_URL from generating refused requests
    // while developing at localhost:8081.
    if (host === "localhost" || host === "127.0.0.1") values.push("http://localhost:3001");
    else if (host) values.push(`http://${host}:3001`);
  }
  values.push(configured);
  if (Platform.OS === "web") values.push("http://localhost:3001");
  return [...new Set(values.filter(Boolean))];
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const bases = candidateBases();
  if (!bases.length) throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");

  const { data: { session } } = await getSupabaseClient().auth.getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  };

  let lastNetworkError: unknown = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, { ...options, headers });
      const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;
      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } } | null;
        throw new Error(errorBody?.error?.message ?? `API request failed with status ${response.status}.`);
      }
      return body as T;
    } catch (error) {
      if (error instanceof TypeError || String(error).includes("Failed to fetch") || String(error).includes("Network request failed")) {
        lastNetworkError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`TRAVA API is not reachable. Start the API server with \"npm run api\" from the repository root. ${lastNetworkError instanceof Error ? lastNetworkError.message : ""}`.trim());
}
