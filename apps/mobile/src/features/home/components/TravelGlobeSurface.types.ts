import type { HomeTravelRoute } from "../types/home.types";

export type TravelGlobeCommand =
  | { id: number; type: "zoom-in" | "zoom-out" | "reset" }
  | { id: number; type: "focus"; countryCode: string };

export interface TravelGlobeSurfaceProps {
  routes: HomeTravelRoute[];
  command?: TravelGlobeCommand | null;
  accessibilityLabel?: string;
  onReady?: () => void;
  onError?: (message: string) => void;
}
