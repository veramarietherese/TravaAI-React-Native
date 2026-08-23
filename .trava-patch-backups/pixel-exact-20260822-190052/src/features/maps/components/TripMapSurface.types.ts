import type { TripActivity } from "@trava/shared";

export interface TripMapSurfaceProps {
  activities: TripActivity[];
  selectedActivityId?: string | null;
  onSelectActivity?(activityId: string): void;
  showUserLocation?: boolean;
  height?: number;
}
