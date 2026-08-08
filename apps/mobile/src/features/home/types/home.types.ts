export type HomeEntityId = string | number;

export interface HomeProfileSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface HomeTripSummary {
  id: HomeEntityId;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  currencyCode: string;
  totalBudget: number;
  spent: number;
  memberCount: number;
}

export interface HomeTravelStats {
  totalDistanceKm: number;
  flights: number;
  countries: number;
  daysTraveled: number;
}

export interface HomeTourPackage {
  id: HomeEntityId;
  agencyId: HomeEntityId | null;
  title: string;
  destination: string | null;
  country: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  durationDays: number;
  durationNights: number;
  price: number;
  currencyCode: string;
}

export interface HomeTravelAgency {
  id: HomeEntityId;
  name: string;
  subtitle: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  specialties: string[];
  rating: number;
}

export interface HomeNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string | null;
  tripId: HomeEntityId | null;
}

export interface HomeDashboardData {
  generatedAt: string;
  profile: HomeProfileSummary;
  upcomingTrip: HomeTripSummary | null;
  stats: HomeTravelStats;
  tours: HomeTourPackage[];
  agencies: HomeTravelAgency[];
  notifications: HomeNotification[];
  partial: boolean;
}

export type HomeListing =
  | { type: "tour"; item: HomeTourPackage }
  | { type: "agency"; item: HomeTravelAgency };

export interface HomeFeedbackInput {
  listingType: HomeListing["type"];
  packageId?: HomeEntityId | null;
  agencyId?: HomeEntityId | null;
  rating: number;
  comment?: string;
}

export interface HomeInviteInput {
  tripId: HomeEntityId;
  email: string;
}

export interface HomeTravelRoute {
  id: string;
  originCode: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationCode: string;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  distanceKm: number;
  traveledAt: string;
  createdAt: string;
}

export interface HomeTravelRouteInput {
  originCode: string;
  destinationCode: string;
  traveledAt?: string;
}

export interface HomeTravelRouteStats {
  totalDistanceKm: number;
  totalDistanceMiles: number;
  flights: number;
  countries: number;
  travelDays: number;
}
