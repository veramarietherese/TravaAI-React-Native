import { Platform } from "react-native";

import { env } from "./env";
import { getSupabaseClient } from "./supabase";

function candidateBases() {
  const configured = env.apiBaseUrl?.replace(/\/$/, "") ?? "";
  const values: string[] = [];
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location?.hostname;
    if (host === "localhost" || host === "127.0.0.1") values.push("http://localhost:3001");
    else if (host) values.push(`http://${host}:3001`);
  }
  values.push(configured);
  if (Platform.OS === "web") values.push("http://localhost:3001");
  return [...new Set(values.filter(Boolean))];
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
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
    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort();

    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener("abort", onExternalAbort, { once: true });

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as
        | T
        | { error?: { code?: string; message?: string } }
        | null;

      if (!response.ok) {
        const errorBody = body as { error?: { code?: string; message?: string } } | null;
        const error = new Error(
          errorBody?.error?.message ?? `API request failed with status ${response.status}.`,
        );
        Object.assign(error, {
          code: errorBody?.error?.code,
          status: response.status,
        });
        throw error;
      }

      return body as T;
    } catch (error) {
      if (options.signal?.aborted) throw error;

      const isAbort =
        timedOut ||
        (error instanceof Error && error.name === "AbortError") ||
        String(error).includes("AbortError");

      const isNetwork =
        error instanceof TypeError ||
        String(error).includes("Failed to fetch") ||
        String(error).includes("Network request failed");

      if (isAbort || isNetwork) {
        lastNetworkError = timedOut
          ? new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`)
          : error;
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  throw new Error(
    `TRAVA API is not reachable. Start the API server with "npm run api" from the repository root. ${
      lastNetworkError instanceof Error ? lastNetworkError.message : ""
    }`.trim(),
  );
}
