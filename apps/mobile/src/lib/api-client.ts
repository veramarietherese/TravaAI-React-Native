import { env } from "./env";

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}
