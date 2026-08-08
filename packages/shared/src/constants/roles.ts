import type { UserRole } from "../types/user.types";

export const USER_ROLES = ["traveler", "agency"] as const satisfies readonly UserRole[];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  traveler: "Traveler",
  agency: "Travel Agency",
};
