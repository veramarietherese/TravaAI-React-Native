export type TripStatus = "draft" | "upcoming" | "ongoing" | "completed";
export type TripMemberRole = "owner" | "member";
export type TripMemberStatus = "pending" | "accepted" | "rejected";
export type ActivityCategory =
  | "flight"
  | "stay"
  | "food"
  | "sightseeing"
  | "transport"
  | "shopping"
  | "meeting"
  | "other";
export type ExpenseSplitMethod = "equal" | "exact" | "payer_only";

export interface TripSummary {
  id: string;
  name: string;
  destination: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  numberOfDays: number;
  status: TripStatus;
  coverImageUrl: string | null;
  coverStoragePath: string | null;
  totalBudget: number;
  currencyCode: string;
  travelStyle: string | null;
  travelGroup: string | null;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  flightNumber: string | null;
  flightDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: TripMemberRole;
  status: TripMemberStatus;
  invitedBy: string | null;
  invitedAt: string;
  respondedAt: string | null;
}

export interface TripDetails extends TripSummary {
  owner: TripMember;
  members: TripMember[];
  currentUserRole: TripMemberRole;
  canManageTrip: boolean;
  canManageMembers: boolean;
}

export interface TripInvitation {
  membershipId: string;
  tripId: string;
  tripName: string;
  destination: string;
  coverImageUrl: string | null;
  invitedByName: string;
  invitedAt: string;
}

export interface TripActivity {
  id: string;
  tripId: string;
  dayNumber: number;
  activityDate: string | null;
  title: string;
  category: ActivityCategory;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  estimatedCost: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  displayName: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
}

export interface BudgetCategory {
  id: string;
  tripId: string;
  name: string;
  plannedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  fullName: string;
  amount: number;
}

export interface TripExpense {
  id: string;
  tripId: string;
  title: string;
  description: string | null;
  category: string;
  amount: number;
  expenseDate: string;
  paidBy: string;
  paidByName: string;
  splitMethod: ExpenseSplitMethod;
  receiptUrl: string | null;
  receiptStoragePath: string | null;
  createdBy: string;
  notes: string | null;
  splits: ExpenseSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantBalance {
  userId: string;
  fullName: string;
  paid: number;
  owed: number;
  net: number;
}

export interface TripBudgetSummary {
  totalBudget: number;
  actualSpending: number;
  remainingAmount: number;
  currencyCode: string;
  categories: BudgetCategory[];
  balances: ParticipantBalance[];
}

export interface FlightStatus {
  source: "airlabs";
  checkedAt: string;
  flightNumber: string;
  flightDate: string | null;
  status: string;
  airlineName: string | null;
  aircraft: string | null;
  departure: {
    airportCode: string | null;
    airportName: string | null;
    terminal: string | null;
    gate: string | null;
    scheduledTime: string | null;
    estimatedTime: string | null;
    actualTime: string | null;
  };
  arrival: {
    airportCode: string | null;
    airportName: string | null;
    terminal: string | null;
    gate: string | null;
    scheduledTime: string | null;
    estimatedTime: string | null;
    actualTime: string | null;
  };
}

export interface LocalChecklistItem {
  id: string;
  title: string;
  category: "packing" | "booking" | "documents" | "health" | "other";
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalTripDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  localUri: string;
  category: "ticket" | "reservation" | "identity" | "insurance" | "other";
  createdAt: string;
}
