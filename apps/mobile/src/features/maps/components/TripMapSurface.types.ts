export interface TripMapActivity {
  id: string;
  title: string;
  category: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
}

export interface TripMapSurfaceProps {
  activities: TripMapActivity[];
  selectedActivityId?: string | null;
  onSelectActivity?(activityId: string): void;
  height?: number;
  mapMode?: "map" | "satellite";
}
