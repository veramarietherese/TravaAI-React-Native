import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type ExploreCategory = "All" | "Attractions" | "Activities" | "Food" | "Cafés" | "Shopping" | "Hotels" | "Transport";
export type ExploreIconName = ComponentProps<typeof Ionicons>["name"];

export const EXPLORE_CATEGORIES: ReadonlyArray<{ name: ExploreCategory; icon: ExploreIconName; api: string }> = [
  { name: "All", icon: "sparkles-outline", api: "all" },
  { name: "Attractions", icon: "business-outline", api: "attractions" },
  { name: "Activities", icon: "walk-outline", api: "activities" },
  { name: "Food", icon: "restaurant-outline", api: "food" },
  { name: "Cafés", icon: "cafe-outline", api: "cafes" },
  { name: "Shopping", icon: "bag-handle-outline", api: "shopping" },
  { name: "Hotels", icon: "bed-outline", api: "hotels" },
  { name: "Transport", icon: "train-outline", api: "transport" },
];

export const DEFAULT_EXPLORATION = {
  label: "Cebu City, Philippines",
  latitude: 10.3157,
  longitude: 123.8854,
} as const;

export const DISCOVERY_RADII = [3_000, 8_000, 15_000, 25_000] as const;

export function categoryApi(category: ExploreCategory) {
  return EXPLORE_CATEGORIES.find((item) => item.name === category)?.api ?? "all";
}

export function categoryIcon(category: string): ExploreIconName {
  return EXPLORE_CATEGORIES.find((item) => item.name === category)?.icon ?? "location-outline";
}

export function formatDistance(meters?: number | null) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1_000) return `${Math.max(10, Math.round(meters / 10) * 10)} m away`;
  const km = meters / 1_000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}
