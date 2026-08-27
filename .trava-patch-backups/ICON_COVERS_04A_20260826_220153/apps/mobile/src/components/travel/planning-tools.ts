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

/**
 * Medium-soft TRAVA palette:
 * stronger than the washed-out version, lighter than dark purple tiles.
 */
export const PLANNING_TOOLS: readonly PlanningToolDefinition[] = [
  {
    key: "itinerary",
    label: "Itinerary",
    subtitle: "View your plans",
    suffix: "itinerary",
    icon: "calendar-outline",
    colors: ["#FF6F97", "#F28BC9"],
    foreground: "#FFFFFF",
    tilt: 0,
  },
  {
    key: "budget",
    label: "Budget",
    subtitle: "Track your budget",
    suffix: "budget",
    icon: "wallet-outline",
    colors: ["#40CFA0", "#75E2BC"],
    foreground: "#FFFFFF",
    tilt: 0,
  },
  {
    key: "expenses",
    label: "Expenses",
    subtitle: "Add & manage",
    suffix: "expenses",
    icon: "receipt-outline",
    colors: ["#FF9C55", "#FFC06F"],
    foreground: "#FFFFFF",
    tilt: 0,
  },
  {
    key: "checklist",
    label: "Checklist",
    subtitle: "Stay organized",
    suffix: "checklist",
    icon: "list-outline",
    colors: ["#9167E8", "#B77FEE"],
    foreground: "#FFFFFF",
    tilt: 0,
  },
  {
    key: "documents",
    label: "Documents",
    subtitle: "Travel docs",
    suffix: "documents",
    icon: "folder-outline",
    colors: ["#55A9E8", "#74C8F2"],
    foreground: "#FFFFFF",
    tilt: 0,
  },
] as const;

export const PLANNING_TOOL_BY_KEY = Object.fromEntries(
  PLANNING_TOOLS.map((tool) => [tool.key, tool]),
) as Record<PlanningToolKey, PlanningToolDefinition>;
