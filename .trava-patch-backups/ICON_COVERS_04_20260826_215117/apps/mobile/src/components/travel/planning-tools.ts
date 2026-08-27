import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type PlanningToolKey =
  | "itinerary"
  | "budget"
  | "expenses"
  | "checklist"
  | "documents";

export type PlanningToolIconName = ComponentProps<typeof Ionicons>["name"];

export interface PlanningToolDefinition {
  key: PlanningToolKey;
  label: string;
  subtitle: string;
  suffix: PlanningToolKey;
  icon: PlanningToolIconName;
  colors: readonly [string, string];
  foreground: string;
  tilt: number;
}

export const PLANNING_TOOLS: readonly PlanningToolDefinition[] = [
  {
    key: "itinerary",
    label: "Itinerary",
    subtitle: "View your plans",
    suffix: "itinerary",
    icon: "calendar-outline",
    colors: ["#FFB9C8", "#FFD8E0"],
    foreground: "#FFFFFF",
    tilt: -4,
  },
  {
    key: "budget",
    label: "Budget",
    subtitle: "Track your budget",
    suffix: "budget",
    icon: "wallet-outline",
    colors: ["#A6E5C8", "#D4F5E4"],
    foreground: "#FFFFFF",
    tilt: 3,
  },
  {
    key: "expenses",
    label: "Expenses",
    subtitle: "Add & manage",
    suffix: "expenses",
    icon: "receipt-outline",
    colors: ["#FFD0A6", "#FFE7C8"],
    foreground: "#FFFFFF",
    tilt: -3,
  },
  {
    key: "checklist",
    label: "Checklist",
    subtitle: "Stay organized",
    suffix: "checklist",
    icon: "list-outline",
    colors: ["#C6B1F3", "#E6DAFB"],
    foreground: "#FFFFFF",
    tilt: 4,
  },
  {
    key: "documents",
    label: "Documents",
    subtitle: "Travel docs",
    suffix: "documents",
    icon: "folder-outline",
    colors: ["#A8D4F2", "#D8ECFA"],
    foreground: "#FFFFFF",
    tilt: -3,
  },
] as const;

export const PLANNING_TOOL_BY_KEY = Object.fromEntries(
  PLANNING_TOOLS.map((tool) => [tool.key, tool]),
) as Record<PlanningToolKey, PlanningToolDefinition>;
