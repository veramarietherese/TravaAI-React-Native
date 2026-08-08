import type {
  HomeDashboardData,
  HomeEntityId,
  HomeNotification,
  HomeProfileSummary,
  HomeTourPackage,
  HomeTravelAgency,
  HomeTravelStats,
  HomeTripSummary,
} from "../types/home.types";

export type HomeRow = Record<string, unknown>;

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asId(value: unknown, fallback: HomeEntityId): HomeEntityId {
  return typeof value === "string" || typeof value === "number" ? value : fallback;
}

function firstText(row: HomeRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = asText(row[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(row: HomeRow, keys: string[]): number {
  for (const key of keys) {
    const raw = row[key];
    if (raw !== null && raw !== undefined && raw !== "") return asNumber(raw);
  }
  return 0;
}

function parseSpecialties(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asText(item))
      .filter((item): item is string => Boolean(item));
  }

  const text = asText(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => asText(item))
        .filter((item): item is string => Boolean(item));
    }
  } catch {
    // Comma-delimited legacy values are handled below.
  }

  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeTour(row: HomeRow, index = 0): HomeTourPackage {
  return {
    id: asId(row.package_id ?? row.id, `tour-${index}`),
    agencyId:
      typeof (row.agency_id ?? row.provider_id) === "string" ||
      typeof (row.agency_id ?? row.provider_id) === "number"
        ? ((row.agency_id ?? row.provider_id) as HomeEntityId)
        : null,
    title: firstText(row, ["title", "name", "package_name"]) ?? "Tour package",
    destination: firstText(row, ["destination", "city", "location"]),
    country: firstText(row, ["country", "destination_country"]),
    category: firstText(row, ["category", "tour_type"]),
    description: firstText(row, ["description", "overview"]),
    imageUrl: firstText(row, ["image_url", "cover_image_url", "photo_url"]),
    durationDays: firstNumber(row, ["duration_days", "days"]),
    durationNights: firstNumber(row, ["duration_nights", "nights"]),
    price: firstNumber(row, ["price", "package_price", "base_price"]),
    currencyCode: firstText(row, ["currency_code", "currency"]) ?? "PHP",
  };
}

export function normalizeAgency(row: HomeRow, index = 0): HomeTravelAgency {
  return {
    id: asId(row.agency_id ?? row.id, `agency-${index}`),
    name: firstText(row, ["name", "agency_name", "business_name"]) ?? "Travel agency",
    subtitle: firstText(row, ["subtitle", "tagline", "location"]),
    description: firstText(row, ["description", "about", "bio"]),
    logoUrl: firstText(row, ["logo_url", "avatar_url", "image_url"]),
    coverImageUrl: firstText(row, ["cover_image_url", "banner_url", "image_url"]),
    specialties: parseSpecialties(row.specialties ?? row.services ?? row.categories),
    rating: firstNumber(row, ["rating", "average_rating"]),
  };
}

function daysBetween(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function tripDateValue(row: HomeRow, key: "start" | "end"): string | null {
  return firstText(
    row,
    key === "start"
      ? ["start_date", "departure_date", "date_from"]
      : ["end_date", "return_date", "date_to"],
  );
}

export function selectUpcomingTrip(trips: HomeRow[]): HomeRow | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    trips
      .filter((trip) => {
        const endDate = tripDateValue(trip, "end") ?? tripDateValue(trip, "start");
        if (!endDate) return false;
        const end = new Date(`${endDate}T23:59:59`);
        return Number.isFinite(end.getTime()) && end >= today;
      })
      .sort((a, b) => {
        const aDate = tripDateValue(a, "start") ?? "9999-12-31";
        const bDate = tripDateValue(b, "start") ?? "9999-12-31";
        return aDate.localeCompare(bDate);
      })[0] ?? null
  );
}

export function normalizeDashboard(input: {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  trips: HomeRow[];
  members: HomeRow[];
  expenses: HomeRow[];
  flights: HomeRow[];
  routes?: HomeRow[];
  tours: HomeRow[];
  agencies: HomeRow[];
  notifications?: HomeRow[];
  partial?: boolean;
}): HomeDashboardData {
  const upcomingRaw = selectUpcomingTrip(input.trips);
  const upcomingId = upcomingRaw
    ? asId(upcomingRaw.trip_id ?? upcomingRaw.id, "upcoming-trip")
    : null;

  const upcomingMembers = upcomingId
    ? input.members.filter((row) => {
        const tripId = row.trip_id ?? row.tripId;
        const status = String(row.status ?? "").toLowerCase();
        return String(tripId) === String(upcomingId) && ["accepted", "joined", "active"].includes(status);
      })
    : [];

  const upcomingSpent = upcomingId
    ? input.expenses
        .filter((row) => {
          const tripId = row.trip_id ?? row.tripId;
          return String(tripId) === String(upcomingId) && row.is_deleted !== true;
        })
        .reduce((sum, row) => sum + firstNumber(row, ["amount", "total", "cost"]), 0)
    : 0;

  const upcomingTrip: HomeTripSummary | null = upcomingRaw
    ? {
        id: upcomingId ?? "upcoming-trip",
        name:
          firstText(upcomingRaw, ["trip_name", "name", "title", "destination"]) ??
          "Upcoming trip",
        destination: firstText(upcomingRaw, ["destination", "city", "country"]),
        startDate: tripDateValue(upcomingRaw, "start"),
        endDate: tripDateValue(upcomingRaw, "end"),
        imageUrl: firstText(upcomingRaw, [
          "cover_image_url",
          "image_url",
          "destination_image_url",
          "photo_url",
        ]),
        currencyCode: firstText(upcomingRaw, ["currency_code", "currency"]) ?? "PHP",
        totalBudget: firstNumber(upcomingRaw, ["total_budget", "budget", "budget_amount"]),
        spent: upcomingSpent,
        memberCount: upcomingMembers.length,
      }
    : null;

  const routeRows = input.routes ?? [];
  const travelRows = routeRows.length ? routeRows : input.flights;
  const totalDistanceKm = travelRows.reduce(
    (sum, row) => sum + firstNumber(row, ["distance_km", "distance"]),
    0,
  );

  const countries = new Set<string>();
  travelRows.forEach((row) => {
    [
      "origin_code",
      "destination_code",
      "origin_country",
      "destination_country",
      "country",
    ].forEach((key) => {
      const value = asText(row[key]);
      if (value) countries.add(value.toUpperCase());
    });
  });

  const now = new Date();
  const completedTrips = input.trips.filter((row) => {
    const endDate = tripDateValue(row, "end");
    if (!endDate) return false;
    const end = new Date(`${endDate}T23:59:59`);
    return Number.isFinite(end.getTime()) && end < now;
  });
  const routeTravelDays = new Set(
    routeRows
      .map((row) => firstText(row, ["traveled_at", "travel_date", "date"]))
      .filter((value): value is string => Boolean(value)),
  ).size;

  const stats: HomeTravelStats = {
    totalDistanceKm,
    flights: travelRows.length,
    countries: countries.size,
    daysTraveled: routeRows.length
      ? routeTravelDays
      : completedTrips.reduce(
          (sum, row) => sum + daysBetween(tripDateValue(row, "start"), tripDateValue(row, "end")),
          0,
        ),
  };

  const notifications: HomeNotification[] = [];
  if (upcomingTrip) {
    notifications.push({
      id: `upcoming-${String(upcomingTrip.id)}`,
      title: upcomingTrip.name,
      message: upcomingTrip.startDate
        ? `Your trip starts ${formatTripDate(upcomingTrip.startDate, upcomingTrip.endDate)}.`
        : "Your upcoming trip is ready to continue planning.",
      createdAt: null,
      tripId: upcomingTrip.id,
    });
  }

  input.notifications?.slice(0, 6).forEach((row, index) => {
    notifications.push({
      id: String(row.notification_id ?? row.id ?? `notification-${index}`),
      title: firstText(row, ["title", "subject"]) ?? "TRAVA AI update",
      message: firstText(row, ["message", "body", "description"]) ?? "You have a new update.",
      createdAt: firstText(row, ["created_at", "sent_at"]),
      tripId:
        typeof row.trip_id === "string" || typeof row.trip_id === "number"
          ? row.trip_id
          : null,
    });
  });

  const profile: HomeProfileSummary = {
    id: input.userId,
    fullName: input.fullName || "Explorer",
    avatarUrl: input.avatarUrl ?? null,
  };

  return {
    generatedAt: new Date().toISOString(),
    profile,
    upcomingTrip,
    stats,
    tours: input.tours.map(normalizeTour),
    agencies: input.agencies.map(normalizeAgency),
    notifications,
    partial: Boolean(input.partial),
  };
}

export function formatMoney(value: number, currencyCode = "PHP"): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencyCode} ${Math.round(value).toLocaleString("en-PH")}`;
  }
}

export function formatTripDate(startDate: string | null, endDate?: string | null): string {
  if (!startDate) return "Date not set";

  const start = new Date(`${startDate}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return "Date not set";

  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (!endDate) return `${startText}, ${start.getFullYear()}`;
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(end.getTime())) return `${startText}, ${start.getFullYear()}`;

  const endText = end.toLocaleDateString("en-US", {
    month: start.getMonth() === end.getMonth() ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startText} – ${endText}`;
}
