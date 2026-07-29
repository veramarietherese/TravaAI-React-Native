export type TripStatus = "draft" | "upcoming" | "ongoing" | "completed";

export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
}
