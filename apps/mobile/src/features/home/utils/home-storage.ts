import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HomeDashboardData, HomeListing } from "../types/home.types";

const CACHE_PREFIX = "trava-home-cache-v1";
const FAVORITES_PREFIX = "trava-home-favorites-v1";
const PENDING_INQUIRY_KEY = "trava-pending-inquiry-v1";

export async function readHomeCache(userId: string): Promise<HomeDashboardData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as HomeDashboardData;
  } catch {
    return null;
  }
}

export async function writeHomeCache(userId: string, data: HomeDashboardData): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}:${userId}`, JSON.stringify(data));
  } catch {
    // Dashboard remains usable even when cache storage is unavailable.
  }
}

export async function readHomeFavorites(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(`${FAVORITES_PREFIX}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function writeHomeFavorites(userId: string, favorites: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${FAVORITES_PREFIX}:${userId}`, JSON.stringify(favorites));
  } catch {
    // Favorites still work for the active session.
  }
}

export function getListingFavoriteKey(listing: HomeListing): string {
  return `${listing.type}:${String(listing.item.id)}`;
}

export async function savePendingInquiry(listing: HomeListing): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_INQUIRY_KEY,
      JSON.stringify({
        ...listing,
        createdAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Navigation still works without persisted context.
  }
}
