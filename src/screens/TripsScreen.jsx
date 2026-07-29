import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BaggageClaim,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  ListChecks,
  LoaderCircle,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Plane,
  PlaneTakeoff,
  Plus,
  ReceiptText,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  Trash2,
  Upload,
  UserCheck,
  UserRoundPlus,
  UserX,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

import "./trips.css";

import { BrowserMultiFormatReader } from "@zxing/browser";

import { supabase } from "../auth/supabaseClient";
import { useAuth } from "../auth/AuthContext";

import BudgetScreen from "./BudgetScreen";
import ExpensesScreen from "./ExpensesScreen";
import TripItinerary, {
  createPlaceholderItinerary,
} from "./TripItinerary";

/* =========================================================
   MOBILE-SAFE UUID FALLBACK

   Some browsers and non-HTTPS local network sessions expose
   window.crypto but do not provide crypto.randomUUID().
   TripItinerary's createPlaceholderItinerary() uses that API,
   so install a compatible fallback before TripsScreen renders.
========================================================= */

function createFallbackUUID() {
  const cryptoApi =
    typeof globalThis !== "undefined" ? globalThis.crypto : null;

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);

    // RFC 4122 version 4 UUID bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    );

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  return `trava-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function installRandomUUIDFallback() {
  if (typeof globalThis === "undefined") return;

  let cryptoApi = globalThis.crypto;

  if (!cryptoApi) {
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: {},
        configurable: true,
      });
      cryptoApi = globalThis.crypto;
    } catch {
      return;
    }
  }

  if (typeof cryptoApi.randomUUID === "function") return;

  try {
    Object.defineProperty(cryptoApi, "randomUUID", {
      value: createFallbackUUID,
      configurable: true,
    });
  } catch {
    try {
      cryptoApi.randomUUID = createFallbackUUID;
    } catch {
      // createSafeUUID below still protects TripsScreen-owned IDs.
    }
  }
}

function createSafeUUID() {
  const cryptoApi =
    typeof globalThis !== "undefined" ? globalThis.crypto : null;

  return typeof cryptoApi?.randomUUID === "function"
    ? cryptoApi.randomUUID()
    : createFallbackUUID();
}

installRandomUUIDFallback();

/* =========================================================
   CONSTANTS
========================================================= */

const WORKSPACE_TABS = [
  "Overview",
  "Itinerary",
  "Budget",
  "Expenses",
  "Checklist",
  "Documents",
];

const DOCUMENT_CATEGORIES = [
  "Boarding Pass",
  "Flight Confirmation",
  "Hotel Booking",
  "Activity Voucher",
  "Transport Ticket",
  "Restaurant Reservation",
  "Travel Insurance Summary",
  "Event Ticket",
  "Rental Car Booking",
  "Airport Transfer",
  "Itinerary PDF",
  "Packing List",
  "Emergency Contact Sheet",
  "Receipt",
  "Expense Proof",
  "Map or Travel Guide",
  "Health Entry Reminder",
  "Other",
];

const DESTINATION_SUGGESTIONS = [
  "Tokyo, Japan", "Kyoto, Japan", "Osaka, Japan",
  "Seoul, South Korea", "Busan, South Korea",
  "Bangkok, Thailand", "Singapore", "Bali, Indonesia",
  "Kuala Lumpur, Malaysia", "Hong Kong", "Taipei, Taiwan",
  "Hanoi, Vietnam", "Ho Chi Minh City, Vietnam",
  "Manila, Philippines", "Cebu, Philippines",
  "Palawan, Philippines", "Boracay, Philippines",
  "Sydney, Australia", "Melbourne, Australia",
  "Paris, France", "London, United Kingdom", "Rome, Italy",
  "Barcelona, Spain", "Amsterdam, Netherlands",
  "New York, United States", "Los Angeles, United States",
  "Vancouver, Canada", "Dubai, United Arab Emirates",
];

const DEFAULT_TRIP_FORM = {
  trip_name: "",
  destination: "",
  number_of_days: "1",
  travel_style: "Standard",
  travel_group: "Not specified",
  preferred_activities: "",
  total_budget: "",
  currency_code: "PHP",
  start_date: "",
  end_date: "",
  origin_city: "",
  origin_code: "",
  destination_code: "",
  departure_time: "",
  arrival_time: "",
  flight_number: "",
  terminal: "",
  gate: "",
  seat: "",
};

const FALLBACK_DESTINATION_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=85&w=1800&auto=format&fit=crop";

const CURATED_DESTINATION_IMAGES = {
  japan:
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=85&w=1800&auto=format&fit=crop",
  tokyo:
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=85&w=1800&auto=format&fit=crop",
  kyoto:
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=85&w=1800&auto=format&fit=crop",
  osaka:
    "https://images.unsplash.com/photo-1590559899731-a382839e5549?q=85&w=1800&auto=format&fit=crop",
  korea:
    "https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=85&w=1800&auto=format&fit=crop",
  seoul:
    "https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=85&w=1800&auto=format&fit=crop",
};

function getCuratedDestinationImage(destination = "") {
  const normalized = destination.toLowerCase();

  const matchingKey = Object.keys(CURATED_DESTINATION_IMAGES).find(
    (key) => normalized.includes(key),
  );

  return matchingKey
    ? CURATED_DESTINATION_IMAGES[matchingKey]
    : null;
}

function getTripCoverImage(trip) {
  return (
    getCuratedDestinationImage(
      `${trip?.trip_name || ""} ${trip?.destination || ""}`,
    ) ||
    trip?.cover_image_url ||
    FALLBACK_DESTINATION_IMAGE
  );
}

const DOCUMENT_DATABASE_NAME = "trava-local-documents";
const DOCUMENT_STORE_NAME = "documents";
const DOCUMENT_DATABASE_VERSION = 1;
const LAST_TRIPS_USER_KEY = "trava-last-trips-user";

/* =========================================================
   HELPERS
========================================================= */

function getUserName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Traveler"
  );
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TR"
  );
}

function TripPersonAvatar({ person, className = "" }) {
  const name = person?.full_name || person?.email || "Traveler";

  return (
    <span className={`trip-person-avatar ${className}`.trim()} title={name}>
      {person?.profile_picture_url ? (
        <img src={person.profile_picture_url} alt={name} />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

function normalizeMembershipStatus(value = "") {
  return String(value).trim().toLowerCase();
}

function isAcceptedMembership(value) {
  return ["accepted", "joined"].includes(
    normalizeMembershipStatus(value),
  );
}

function escapePostgrestSearch(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", " ")
    .trim();
}

function formatNotificationTime(value) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Date pending";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "TBD";

  const rawValue = String(value).trim();
  const airLabsLocalTime = rawValue.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/,
  );

  if (airLabsLocalTime && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(rawValue)) {
    const hour = Number(airLabsLocalTime[4]);
    const minute = airLabsLocalTime[5];
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTripCardDate(value) {
  if (!value) {
    return {
      main: "TBD",
      year: "",
    };
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  return {
    main: parsedDate.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    }),
    year: String(parsedDate.getFullYear()),
  };
}

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.error_description ||
    "Something went wrong. Please try again."
  );
}

function normalizeDateTimeForInput(value) {
  if (!value) return "";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const localDate = new Date(
    parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 16);
}

function calculateTripDays(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) {
    return "";
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return String(
    Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1,
  );
}


function getFeaturedTrip(trips = []) {
  if (!trips.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = trips
    .filter((trip) => {
      if (!trip.start_date) return false;
      return new Date(`${trip.start_date}T00:00:00`) >= today;
    })
    .sort(
      (first, second) =>
        new Date(`${first.start_date}T00:00:00`) -
        new Date(`${second.start_date}T00:00:00`),
    );

  return upcoming[0] || trips[0];
}

function getDaysUntil(value) {
  if (!value) return null;

  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function getFlightStatusLabel(value) {
  const normalized = String(value || "")
    .replaceAll("_", " ")
    .trim();

  if (!normalized) return "Status pending";

  return normalized.replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

function getChecklistMessage(progress, completed, total) {
  if (!total) {
    return {
      eyebrow: "Let’s get you ready",
      title: "Your travel buddy is ready to help",
      body:
        "Add your essentials or use the starter list so nothing important gets left behind.",
    };
  }

  if (progress === 100) {
    return {
      eyebrow: "All packed",
      title: "You’re completely ready!",
      body:
        "Everything is checked. Do one final document and flight-status review before you leave.",
    };
  }

  if (progress >= 75) {
    return {
      eyebrow: "Almost there",
      title: "Only a few things left",
      body:
        `${completed} of ${total} tasks are done. Your travel buddy says you’re nearly departure-ready.`,
    };
  }

  if (progress >= 45) {
    return {
      eyebrow: "Great progress",
      title: "You’re halfway ready",
      body:
        `${completed} of ${total} tasks are complete. Keep going—you’ve already handled the hard part.`,
    };
  }

  return {
    eyebrow: "Good start",
    title: "Let’s prepare one step at a time",
    body:
      `${completed} of ${total} tasks are complete. Tick off one small item now to keep the momentum going.`,
  };
}

function readTripsCache(userId) {
  const resolvedUserId =
    userId || localStorage.getItem(LAST_TRIPS_USER_KEY);

  if (!resolvedUserId) return [];

  try {
    const cachedValue = localStorage.getItem(
      `trava-trips-cache:${resolvedUserId}`,
    );

    return cachedValue ? JSON.parse(cachedValue) : [];
  } catch {
    return [];
  }
}

function writeTripsCache(userId, trips) {
  if (!userId) return;

  try {
    localStorage.setItem(LAST_TRIPS_USER_KEY, userId);
    localStorage.setItem(
      `trava-trips-cache:${userId}`,
      JSON.stringify(trips),
    );
  } catch {
    // The screen remains usable without localStorage.
  }
}

async function searchDestinationImage(destination) {
  const curatedImage = getCuratedDestinationImage(destination);

  if (curatedImage) {
    return curatedImage;
  }

  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  if (!accessKey || !destination?.trim()) {
    return FALLBACK_DESTINATION_IMAGE;
  }

  try {
    const query = encodeURIComponent(
      `${destination.trim()} iconic landmark skyline architecture travel`,
    );

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&page=1&per_page=8&orientation=landscape&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          "Accept-Version": "v1",
        },
      },
    );

    if (!response.ok) {
      return FALLBACK_DESTINATION_IMAGE;
    }

    const result = await response.json();

    const bestPhoto = (result.results || []).find(
      (photo) =>
        photo?.urls?.regular &&
        Number(photo.width || 0) > Number(photo.height || 0),
    );

    return (
      bestPhoto?.urls?.regular ||
      result.results?.[0]?.urls?.regular ||
      FALLBACK_DESTINATION_IMAGE
    );
  } catch {
    return FALLBACK_DESTINATION_IMAGE;
  }
}


function parseJulianDate(julianDay, referenceYear) {
  if (!julianDay || !/^\d{3}$/.test(julianDay)) return "";
  const date = new Date(Number(referenceYear) || new Date().getFullYear(), 0, Number(julianDay));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function parseBoardingPassBarcode(rawValue, referenceDate = "") {
  const raw = String(rawValue || "").trim();
  const result = {
    raw_barcode: raw, origin_code: "", destination_code: "",
    flight_number: "", departure_time: "", arrival_time: "",
    terminal: "", gate: "", seat: "",
  };
  if (!raw) return result;

  if (raw.startsWith("M") && raw.length >= 58) {
    const originCode = raw.slice(30, 33).trim();
    const destinationCode = raw.slice(33, 36).trim();
    const carrier = raw.slice(36, 39).trim();
    const flightNumber = raw.slice(39, 44).trim();
    const julianDate = raw.slice(44, 47).trim();
    const seat = raw.slice(48, 52).trim();
    const year = referenceDate
      ? new Date(`${referenceDate}T00:00:00`).getFullYear()
      : new Date().getFullYear();
    const flightDate = parseJulianDate(julianDate, year);
    result.origin_code = originCode;
    result.destination_code = destinationCode;
    result.flight_number = `${carrier}${flightNumber}`.replace(/\s+/g, "");
    result.departure_time = flightDate ? `${flightDate}T00:00` : "";
    result.seat = seat;
  }

  if (!result.origin_code || !result.destination_code) {
    const route = raw.match(/\b([A-Z]{3})\s*(?:-|→|TO|\/)\s*([A-Z]{3})\b/i);
    if (route) {
      result.origin_code ||= route[1].toUpperCase();
      result.destination_code ||= route[2].toUpperCase();
    }
  }
  if (!result.flight_number) {
    const flight = raw.match(/\b([A-Z0-9]{2,3})\s?(\d{2,4})\b/);
    if (flight) result.flight_number = `${flight[1]} ${flight[2]}`;
  }
  if (!result.seat) {
    const seat = raw.match(/\bSEAT[:\s-]*([0-9]{1,3}[A-Z])\b/i);
    if (seat) result.seat = seat[1].toUpperCase();
  }
  const gate = raw.match(/\bGATE[:\s-]*([A-Z0-9]{1,5})\b/i);
  if (gate) result.gate = gate[1].toUpperCase();
  const terminal = raw.match(/\bTERMINAL[:\s-]*([A-Z0-9]{1,5})\b/i);
  if (terminal) result.terminal = terminal[1].toUpperCase();
  return result;
}

async function scanBoardingPassImage(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("For automatic scanning, upload a boarding-pass image or screenshot.");
  }
  const reader = new BrowserMultiFormatReader();
  const objectUrl = URL.createObjectURL(file);
  try {
    const result = await reader.decodeFromImageUrl(objectUrl);
    return result?.getText?.() || result?.text || "";
  } finally {
    URL.revokeObjectURL(objectUrl);
    reader.reset?.();
  }
}

/* =========================================================
   INDEXEDDB DOCUMENT HELPERS
========================================================= */

function openDocumentDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(
        new Error(
          "Local document storage is not supported by this browser.",
        ),
      );
      return;
    }

    const request = indexedDB.open(
      DOCUMENT_DATABASE_NAME,
      DOCUMENT_DATABASE_VERSION,
    );

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
        const store = database.createObjectStore(DOCUMENT_STORE_NAME, {
          keyPath: "documentId",
        });

        store.createIndex("tripId", "tripId", {
          unique: false,
        });

        store.createIndex("createdAt", "createdAt", {
          unique: false,
        });
      }
    };
  });
}

async function getLocalDocuments(tripId) {
  const database = await openDocumentDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      DOCUMENT_STORE_NAME,
      "readonly",
    );

    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const index = store.index("tripId");
    const request = index.getAll(tripId);

    request.onsuccess = () => {
      const documents = request.result || [];

      documents.sort(
        (first, second) =>
          new Date(second.createdAt) - new Date(first.createdAt),
      );

      resolve(documents);
    };

    request.onerror = () => reject(request.error);
  });
}

async function saveLocalDocument(documentRecord) {
  const database = await openDocumentDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      DOCUMENT_STORE_NAME,
      "readwrite",
    );

    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const request = store.put(documentRecord);

    request.onsuccess = () => resolve(documentRecord);
    request.onerror = () => reject(request.error);
  });
}

async function deleteLocalDocument(documentId) {
  const database = await openDocumentDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      DOCUMENT_STORE_NAME,
      "readwrite",
    );

    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const request = store.delete(documentId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function TripsScreen() {
  const {
    user: contextUser,
    loading: authLoading,
  } = useAuth();

  const [activeUser, setActiveUser] = useState(contextUser || null);

  const [trips, setTrips] = useState(() =>
    readTripsCache(contextUser?.id),
  );

  const [selectedTripId, setSelectedTripId] = useState(() =>
    sessionStorage.getItem("trava-selected-trip-id"),
  );

  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = sessionStorage.getItem("trava-trip-active-tab");

    return WORKSPACE_TABS.includes(savedTab)
      ? savedTab
      : "Overview";
  });
  const [searchValue, setSearchValue] = useState("");
  const [tripFilter, setTripFilter] = useState("all");
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [syncingTrips, setSyncingTrips] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [tripForm, setTripForm] = useState(DEFAULT_TRIP_FORM);
  const [menuOpen, setMenuOpen] = useState(false);
  const [planningModalOpen, setPlanningModalOpen] = useState(false);
  const [itinerary, setItinerary] = useState(() =>
    createPlaceholderItinerary(),
  );
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [error, setError] = useState("");
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const itinerarySaveTimer = useRef(null);
  const tripsInitializedRef = useRef(false);
  const activeUserRef = useRef(contextUser || null);

  const selectedTrip = useMemo(() => {
    return (
      trips.find((trip) => trip.trip_id === selectedTripId) || null
    );
  }, [trips, selectedTripId]);

  const filteredTrips = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return trips.filter((trip) => {
      const matchesSearch = !normalizedSearch ||
        [
          trip.trip_name,
          trip.destination,
          trip.travel_group,
          trip.travel_style,
          trip.flight_number,
          trip.origin_code,
          trip.destination_code,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          );

      if (!matchesSearch) return false;
      if (tripFilter === "all") return true;

      if (!trip.start_date) {
        return tripFilter === "drafts";
      }

      const tripDate = new Date(`${trip.start_date}T00:00:00`);

      if (tripFilter === "upcoming") return tripDate >= today;
      if (tripFilter === "past") return tripDate < today;
      if (tripFilter === "drafts") return false;

      return true;
    });
  }, [trips, searchValue, tripFilter]);

  useEffect(() => {
    if (contextUser?.id) {
      activeUserRef.current = contextUser;
      setActiveUser(contextUser);
    }
  }, [contextUser]);

  const resolveActiveUser = useCallback(async () => {
    if (contextUser?.id) {
      activeUserRef.current = contextUser;
      return contextUser;
    }

    if (activeUserRef.current?.id) {
      return activeUserRef.current;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const sessionUser = session?.user ?? null;

    if (!sessionUser?.id) {
      throw new Error(
        "Your session could not be verified. Please sign in again.",
      );
    }

    activeUserRef.current = sessionUser;
    setActiveUser(sessionUser);

    return sessionUser;
  }, [contextUser]);

  const loadNotifications = useCallback(async () => {
    const authenticatedUser = await resolveActiveUser();
    setLoadingNotifications(true);

    try {
      const { data, error: notificationError } = await supabase
        .from("trip_notifications")
        .select(
          "notification_id,recipient_id,actor_id,trip_id,membership_id,type,title,message,is_read,created_at",
        )
        .eq("recipient_id", authenticatedUser.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notificationError) throw notificationError;
      setNotifications(data || []);
    } catch (notificationError) {
      console.error("Trip notification load error:", notificationError);
      setError(getErrorMessage(notificationError));
    } finally {
      setLoadingNotifications(false);
    }
  }, [resolveActiveUser]);

  async function markNotificationRead(notificationId) {
    if (!notificationId) return;

    setNotifications((current) =>
      current.map((notification) =>
        notification.notification_id === notificationId
          ? { ...notification, is_read: true }
          : notification,
      ),
    );

    const { error: updateError } = await supabase
      .from("trip_notifications")
      .update({ is_read: true })
      .eq("notification_id", notificationId);

    if (updateError) {
      setError(getErrorMessage(updateError));
      loadNotifications();
    }
  }

  async function respondToInvitation(notification, nextStatus) {
    if (!notification?.membership_id) return;

    setError("");

    const { error: membershipError } = await supabase
      .from("trip_members")
      .update({
        status: nextStatus,
        responded_at: new Date().toISOString(),
      })
      .eq("member_id", notification.membership_id);

    if (membershipError) {
      setError(getErrorMessage(membershipError));
      return;
    }

    await markNotificationRead(notification.notification_id);
    await Promise.all([loadTrips(), loadNotifications()]);
  }

  const loadTrips = useCallback(
    async ({ showLoader = false } = {}) => {
      if (showLoader) setLoadingTrips(true);

      setSyncingTrips(true);
      setError("");

      try {
        const authenticatedUser = await resolveActiveUser();
        const cachedTrips = readTripsCache(authenticatedUser.id);

        if (cachedTrips.length) {
          setTrips(cachedTrips);
        }

        // Load the trips table by itself. Expenses and members are loaded
        // inside their own tabs so one failing relation cannot erase trips.
        const { data, error: tripsError } = await supabase
          .from("trips")
          .select("*")
          .order("created_at", { ascending: false });

        if (tripsError) throw tripsError;

        const tripRows = data || [];
        const tripIds = tripRows.map((trip) => trip.trip_id);
        let memberships = [];
        let peopleById = {};

        if (tripIds.length) {
          const { data: membershipRows, error: membershipError } =
            await supabase
              .from("trip_members")
              .select(
                "member_id,trip_id,user_id,status,invited_by,created_at,responded_at",
              )
              .in("trip_id", tripIds);

          if (membershipError) throw membershipError;
          memberships = membershipRows || [];

          const personIds = [
            ...new Set(
              memberships.map((membership) => membership.user_id),
            ),
          ].filter(Boolean);

          if (personIds.length) {
            const { data: peopleRows, error: peopleError } = await supabase
              .from("users")
              .select("user_id,full_name,email,profile_picture_url")
              .in("user_id", personIds);

            if (peopleError) throw peopleError;
            peopleById = Object.fromEntries(
              (peopleRows || []).map((person) => [person.user_id, person]),
            );
          }
        }

        const remoteTrips = tripRows.map((trip) => {
          const tripMemberships = memberships.filter(
            (membership) => membership.trip_id === trip.trip_id,
          );

          return {
            ...trip,
            total_spent: Number(trip.total_spent || 0),
            accepted_members: tripMemberships
              .filter((membership) =>
                isAcceptedMembership(membership.status),
              )
              .map((membership) => ({
                ...membership,
                person: peopleById[membership.user_id] || null,
              })),
            pending_members: tripMemberships
              .filter(
                (membership) =>
                  normalizeMembershipStatus(membership.status) === "pending",
              )
              .map((membership) => ({
                ...membership,
                person: peopleById[membership.user_id] || null,
              })),
          };
        });

        // Never replace a known-good cache with an unexpected empty result.
        const nextTrips =
          remoteTrips.length > 0 || cachedTrips.length === 0
            ? remoteTrips
            : cachedTrips;

        setTrips(nextTrips);
        writeTripsCache(authenticatedUser.id, nextTrips);

        setSelectedTripId((currentSelectedId) => {
          if (
            currentSelectedId &&
            nextTrips.some(
              (trip) => trip.trip_id === currentSelectedId,
            )
          ) {
            return currentSelectedId;
          }

          return null;
        });
      } catch (loadError) {
        console.error("Trips load error:", loadError);

        const fallbackTrips = readTripsCache(
          activeUserRef.current?.id,
        );

        if (fallbackTrips.length) {
          setTrips(fallbackTrips);
        }

        setError(getErrorMessage(loadError));
      } finally {
        setLoadingTrips(false);
        setSyncingTrips(false);
      }
    },
    [resolveActiveUser],
  );

  useEffect(() => {
    if (authLoading || tripsInitializedRef.current) {
      return;
    }

    let cancelled = false;

    async function initializeTrips() {
      try {
        const authenticatedUser = await resolveActiveUser();

        if (cancelled) return;

        tripsInitializedRef.current = true;

        const cachedTrips = readTripsCache(authenticatedUser.id);

        if (cachedTrips.length) {
          setTrips(cachedTrips);
        }

        await loadTrips({
          showLoader: cachedTrips.length === 0,
        });
      } catch (sessionError) {
        if (!cancelled) {
          setError(getErrorMessage(sessionError));
        }
      }
    }

    initializeTrips();

    return () => {
      cancelled = true;
    };
  }, [authLoading, resolveActiveUser, loadTrips]);

  useEffect(() => {
    if (authLoading) return;

    loadNotifications();
  }, [authLoading, loadNotifications]);

  useEffect(() => {
    if (!activeUser?.id) return undefined;

    const channel = supabase
      .channel(`trips-realtime:${activeUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
        },
        () => {
          loadTrips();
          loadNotifications();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_notifications",
          filter: `recipient_id=eq.${activeUser.id}`,
        },
        () => {
          loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUser?.id, loadNotifications, loadTrips]);

  useEffect(() => {
    if (selectedTripId) {
      sessionStorage.setItem(
        "trava-selected-trip-id",
        selectedTripId,
      );
    } else {
      sessionStorage.removeItem("trava-selected-trip-id");
    }
  }, [selectedTripId]);

  useEffect(() => {
    sessionStorage.setItem("trava-trip-active-tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedTrip?.trip_id) {
      setItinerary(createPlaceholderItinerary());
      return;
    }

    let cancelled = false;

    async function loadItinerary() {
      try {
        const {
          data,
          error: itineraryError,
        } = await supabase
          .from("travel_itineraries")
          .select("*")
          .eq("trip_id", selectedTrip.trip_id)
          .order("day_number", {
            ascending: true,
          });

        if (itineraryError) {
          throw itineraryError;
        }

        if (cancelled) return;

        if (!data?.length) {
          setItinerary(createPlaceholderItinerary());
          return;
        }

        setItinerary(
          data.map((row) => ({
            dayNumber: row.day_number,
            ...(row.schedule_details || {}),
          })),
        );
      } catch (loadError) {
        console.error("Itinerary load error:", loadError);
        setError(getErrorMessage(loadError));
      }
    }

    loadItinerary();

    return () => {
      cancelled = true;
    };
  }, [selectedTrip?.trip_id]);

  useEffect(() => {
    return () => {
      window.clearTimeout(itinerarySaveTimer.current);
    };
  }, []);

  function openTrip(tripId, destinationTab = "Overview") {
    setSelectedTripId(tripId);
    setActiveTab(
      WORKSPACE_TABS.includes(destinationTab)
        ? destinationTab
        : "Overview",
    );
    setMenuOpen(false);
  }

  function closeTrip() {
    setSelectedTripId(null);
    setActiveTab("Overview");
    setMenuOpen(false);
  }

  function openCreateTrip() {
    setEditingTrip(null);
    setTripForm({
      ...DEFAULT_TRIP_FORM,
    });
    setTripModalOpen(true);
  }

  function openEditTrip() {
    if (!selectedTrip) return;

    setEditingTrip(selectedTrip);

    setTripForm({
      trip_name: selectedTrip.trip_name || "",
      destination: selectedTrip.destination || "",
      number_of_days: String(selectedTrip.number_of_days || 1),
      travel_style: selectedTrip.travel_style || "Standard",
      travel_group: selectedTrip.travel_group || "Solo",
      preferred_activities:
        selectedTrip.preferred_activities || "",
      total_budget: String(selectedTrip.total_budget || ""),
      currency_code: selectedTrip.currency_code || "PHP",
      start_date: selectedTrip.start_date || "",
      end_date: selectedTrip.end_date || "",
      origin_city:
        selectedTrip.origin_city || "Cebu, Philippines",
      origin_code: selectedTrip.origin_code || "CEB",
      destination_code: selectedTrip.destination_code || "",
      departure_time: normalizeDateTimeForInput(
        selectedTrip.departure_time,
      ),
      arrival_time: normalizeDateTimeForInput(
        selectedTrip.arrival_time,
      ),
      flight_number: selectedTrip.flight_number || "",
      terminal: selectedTrip.terminal || "",
      gate: selectedTrip.gate || "",
      seat: selectedTrip.seat || "",
    });

    setMenuOpen(false);
    setTripModalOpen(true);
  }

  function handleTripPatchedById(tripId, updatedFields) {
    if (!tripId) return;

    setTrips((currentTrips) => {
      const nextTrips = currentTrips.map((trip) =>
        trip.trip_id === tripId
          ? { ...trip, ...updatedFields }
          : trip,
      );

      if (activeUserRef.current?.id) {
        writeTripsCache(
          activeUserRef.current.id,
          nextTrips,
        );
      }

      return nextTrips;
    });
  }

  function handleTripPatched(updatedFields) {
    handleTripPatchedById(
      selectedTripId,
      updatedFields,
    );
  }

  async function saveTrip(event) {
    event.preventDefault();

    setSavingTrip(true);
    setError("");

    try {
      const authenticatedUser = await resolveActiveUser();
      const destination = tripForm.destination.trim();

      if (!destination) {
        throw new Error("Enter a destination.");
      }

      if (
        tripForm.start_date &&
        tripForm.end_date &&
        tripForm.end_date < tripForm.start_date
      ) {
        throw new Error(
          "The end date cannot be earlier than the start date.",
        );
      }

      const numberOfDays = Number(
        calculateTripDays(
          tripForm.start_date,
          tripForm.end_date,
        ) || tripForm.number_of_days,
      );

      const totalBudget = Number(tripForm.total_budget || 0);

      if (!Number.isInteger(numberOfDays) || numberOfDays < 1) {
        throw new Error(
          "Trip duration must be at least one day.",
        );
      }

      if (!Number.isFinite(totalBudget) || totalBudget < 0) {
        throw new Error("Enter a valid total budget.");
      }

      const destinationChanged =
        editingTrip &&
        String(editingTrip.destination || "").toLowerCase() !==
          destination.toLowerCase();

      let coverImageUrl = editingTrip?.cover_image_url;
      const curatedImage = getCuratedDestinationImage(destination);

      if (curatedImage || !coverImageUrl || destinationChanged) {
        coverImageUrl = await searchDestinationImage(destination);
      }

      const payload = {
        user_id: authenticatedUser.id,
        trip_name:
          tripForm.trip_name.trim() || `${destination} Trip`,
        destination,
        number_of_days: numberOfDays,
        travel_style: tripForm.travel_style || "Standard",
        travel_group: tripForm.travel_group.trim() || "Not specified",
        preferred_activities:
          tripForm.preferred_activities.trim() || null,
        total_budget: totalBudget,
        currency_code: tripForm.currency_code || "PHP",
        start_date: tripForm.start_date || null,
        end_date: tripForm.end_date || null,
        origin_city: tripForm.origin_city.trim() || null,
        origin_code:
          tripForm.origin_code.trim().toUpperCase() || null,
        destination_code:
          tripForm.destination_code.trim().toUpperCase() || null,
        departure_time: tripForm.departure_time || null,
        arrival_time: tripForm.arrival_time || null,
        flight_number: tripForm.flight_number.trim() || null,
        terminal: tripForm.terminal.trim() || null,
        gate: tripForm.gate.trim() || null,
        seat: tripForm.seat.trim() || null,
        cover_image_url: coverImageUrl,
      };

      const result = editingTrip
        ? await supabase
            .from("trips")
            .update(payload)
            .eq("trip_id", editingTrip.trip_id)
            .select()
            .single()
        : await supabase
            .from("trips")
            .insert(payload)
            .select()
            .single();

      if (result.error) {
        throw result.error;
      }

      const savedTrip = {
        ...result.data,
        total_spent: editingTrip?.total_spent || 0,
        accepted_members: editingTrip?.accepted_members || [],
      };

      setTrips((currentTrips) => {
        const nextTrips = editingTrip
          ? currentTrips.map((trip) =>
              trip.trip_id === savedTrip.trip_id ? savedTrip : trip,
            )
          : [savedTrip, ...currentTrips];

        writeTripsCache(authenticatedUser.id, nextTrips);
        return nextTrips;
      });

      setTripModalOpen(false);
      setEditingTrip(null);

      if (!editingTrip) {
        openTrip(savedTrip.trip_id, "Overview");
      }

      // Background refresh only; the optimistic copy is already persistent.
      loadTrips();
    } catch (saveError) {
      console.error("Trip save error:", saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setSavingTrip(false);
    }
  }

  async function deleteSelectedTrip() {
    if (!selectedTrip) return;

    const confirmed = window.confirm(
      `Delete “${
        selectedTrip.trip_name || selectedTrip.destination
      }”? This cannot be undone.`,
    );

    if (!confirmed) return;

    const previousTrips = trips;

    const nextTrips = trips.filter(
      (trip) => trip.trip_id !== selectedTrip.trip_id,
    );

    setTrips(nextTrips);

    if (activeUser?.id) {
      writeTripsCache(activeUser.id, nextTrips);
    }

    closeTrip();

    const {
      error: deleteError,
    } = await supabase
      .from("trips")
      .delete()
      .eq("trip_id", selectedTrip.trip_id);

    if (deleteError) {
      setTrips(previousTrips);

      if (activeUser?.id) {
        writeTripsCache(activeUser.id, previousTrips);
      }

      setSelectedTripId(selectedTrip.trip_id);
      setError(getErrorMessage(deleteError));
    }
  }

  function handleItineraryChange(nextItinerary) {
    setItinerary(nextItinerary);

    if (!selectedTrip?.trip_id) return;

    window.clearTimeout(itinerarySaveTimer.current);

    itinerarySaveTimer.current = window.setTimeout(async () => {
      setSavingItinerary(true);
      setError("");

      try {
        const {
          error: deleteError,
        } = await supabase
          .from("travel_itineraries")
          .delete()
          .eq("trip_id", selectedTrip.trip_id);

        if (deleteError) {
          throw deleteError;
        }

        const itineraryRows = (nextItinerary || []).map(
          (day, index) => ({
            trip_id: selectedTrip.trip_id,
            day_number: day.dayNumber || index + 1,
            schedule_details: day,
          }),
        );

        if (itineraryRows.length) {
          const {
            error: insertError,
          } = await supabase
            .from("travel_itineraries")
            .insert(itineraryRows);

          if (insertError) {
            throw insertError;
          }
        }
      } catch (saveError) {
        console.error("Itinerary save error:", saveError);
        setError(getErrorMessage(saveError));
      } finally {
        setSavingItinerary(false);
      }
    }, 700);
  }

  if (!selectedTrip) {
    return (
      <>
        <TripsLanding
          user={activeUser || contextUser}
          trips={filteredTrips}
          loading={loadingTrips}
          syncing={syncingTrips}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          tripFilter={tripFilter}
          setTripFilter={setTripFilter}
          onOpenTrip={openTrip}
          onCreateTrip={openCreateTrip}
          onTripUpdated={handleTripPatchedById}
          onRetry={() =>
            loadTrips({
              showLoader: true,
            })
          }
          notifications={notifications}
          loadingNotifications={loadingNotifications}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() =>
            setNotificationsOpen((current) => !current)
          }
          onCloseNotifications={() => setNotificationsOpen(false)}
          onMarkNotificationRead={markNotificationRead}
          onRespondInvitation={respondToInvitation}
        />

        {error && (
          <TripsError
            message={error}
            onDismiss={() => setError("")}
          />
        )}

        {tripModalOpen && (
          <TripFormModal
            form={tripForm}
            setForm={setTripForm}
            editing={Boolean(editingTrip)}
            saving={savingTrip}
            onClose={() => {
              setTripModalOpen(false);
              setEditingTrip(null);
            }}
            onSubmit={saveTrip}
          />
        )}
      </>
    );
  }

  return (
    <div className="scroll-area trip-workspace">
      <header className="trip-header">
        <button
          className="trip-icon-btn"
          type="button"
          onClick={closeTrip}
          aria-label="Return to trips"
        >
          <ArrowLeft size={20} />
        </button>

        <h1>
          {selectedTrip.trip_name || selectedTrip.destination}
        </h1>

        <div className="trip-header-actions">
          {selectedTrip.user_id === activeUser?.id && (
            <button
              className="trip-icon-btn"
              type="button"
              onClick={() => setCollaborationOpen(true)}
              aria-label="Invite travelers"
              title="Invite travelers"
            >
              <UserRoundPlus size={19} />
            </button>
          )}

          <div className="trip-notification-wrap">
            <button
              className="trip-icon-btn"
              type="button"
              onClick={() =>
                setNotificationsOpen((current) => !current)
              }
              aria-label="Trip notifications"
            >
              <Bell size={19} />
              {notifications.some((item) => !item.is_read) && (
                <span className="trip-notification-dot" />
              )}
            </button>

            {notificationsOpen && (
              <TripNotificationPanel
                notifications={notifications}
                loading={loadingNotifications}
                onClose={() => setNotificationsOpen(false)}
                onRead={markNotificationRead}
                onRespond={respondToInvitation}
              />
            )}
          </div>

          <div className="trip-options-wrap">
            <button
              className="trip-icon-btn"
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="Trip options"
            >
              <MoreHorizontal size={22} />
            </button>

            {menuOpen && (
              <div className="trip-options-menu">
              <button type="button" onClick={openEditTrip}>
                <Edit3 size={16} />
                Edit trip
              </button>

              <button
                type="button"
                className="danger"
                onClick={deleteSelectedTrip}
              >
                <Trash2 size={16} />
                Delete trip
              </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="trip-tabs" aria-label="Trip workspace">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Overview" && (
        <TripOverview
          trip={selectedTrip}
          onQuickOpen={setActiveTab}
          onEditTrip={openEditTrip}
          onCompletePlanning={() => setPlanningModalOpen(true)}
          onManageCollaborators={() => setCollaborationOpen(true)}
          canManageCollaborators={selectedTrip.user_id === activeUser?.id}
        />
      )}

      {activeTab === "Itinerary" && (
        <div className="trip-itinerary-wrapper">
          {savingItinerary && (
            <div className="trip-save-indicator">
              <LoaderCircle className="spin" size={13} />
              Saving itinerary
            </div>
          )}

          <TripItinerary
            itinerary={itinerary}
            onChange={handleItineraryChange}
          />
        </div>
      )}

      {activeTab === "Budget" && (
        <BudgetScreen tripId={selectedTrip.trip_id} />
      )}

      {activeTab === "Expenses" && (
        <ExpensesScreen
          tripId={selectedTrip.trip_id}
          trip={selectedTrip}
          onTotalChanged={(totalSpent) =>
            handleTripPatched({ total_spent: totalSpent })
          }
        />
      )}

      {activeTab === "Checklist" && (
        <ChecklistScreen tripId={selectedTrip.trip_id} />
      )}

      {activeTab === "Documents" && (
        <LocalDocumentsScreen
          trip={selectedTrip}
          onTripUpdated={handleTripPatched}
        />
      )}

      {planningModalOpen && (
        <PlanningDetailsModal
          trip={selectedTrip}
          onClose={() => setPlanningModalOpen(false)}
          onSaved={(updatedFields) => {
            handleTripPatched(updatedFields);
            setPlanningModalOpen(false);
          }}
        />
      )}

      {collaborationOpen && selectedTrip && (
        <TripCollaborationModal
          trip={selectedTrip}
          currentUser={activeUser}
          onClose={() => setCollaborationOpen(false)}
          onChanged={async () => {
            await Promise.all([loadTrips(), loadNotifications()]);
          }}
          onError={(message) => setError(message)}
        />
      )}

      {error && (
        <TripsError
          message={error}
          onDismiss={() => setError("")}
        />
      )}

      {tripModalOpen && (
        <TripFormModal
          form={tripForm}
          setForm={setTripForm}
          editing={Boolean(editingTrip)}
          saving={savingTrip}
          onClose={() => {
            setTripModalOpen(false);
            setEditingTrip(null);
          }}
          onSubmit={saveTrip}
        />
      )}
    </div>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

function TripsLanding({
  user,
  trips,
  loading,
  syncing,
  searchValue,
  setSearchValue,
  tripFilter,
  setTripFilter,
  onOpenTrip,
  onCreateTrip,
  onTripUpdated,
  onRetry,
  notifications,
  loadingNotifications,
  notificationsOpen,
  onToggleNotifications,
  onCloseNotifications,
  onMarkNotificationRead,
  onRespondInvitation,
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const featuredTrip = getFeaturedTrip(trips);

  const upcomingTrips = featuredTrip
    ? trips.filter(
        (trip) => trip.trip_id !== featuredTrip.trip_id,
      )
    : trips;

  const visibleUpcomingTrips = showAllUpcoming
    ? upcomingTrips
    : upcomingTrips.slice(0, 3);

  function resetTripView() {
    setSearchValue("");
    setTripFilter("all");
    setFilterOpen(false);
    setShowAllUpcoming(true);
  }

  return (
    <div className="scroll-area trips-premium-home">
      <header className="trips-main-heading">
        <div>
          <p>
            Hello, {getUserName(user).split(" ")[0]} 👋
          </p>
          <h1>My Trips</h1>
        </div>

        <div className="trips-heading-actions">
          <div className="trip-notification-wrap">
            <button
              type="button"
              className="trips-notification-button"
              onClick={onToggleNotifications}
              aria-label="Trip notifications"
            >
              <Bell size={19} />
              {notifications.some((item) => !item.is_read) && (
                <span className="trip-notification-count">
                  {Math.min(99, notifications.filter((item) => !item.is_read).length)}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <TripNotificationPanel
                notifications={notifications}
                loading={loadingNotifications}
                onClose={onCloseNotifications}
                onRead={onMarkNotificationRead}
                onRespond={onRespondInvitation}
              />
            )}
          </div>

          <button
            type="button"
            className="trips-add-button"
            onClick={onCreateTrip}
          >
            <Plus size={19} />
            New Trip
          </button>
        </div>
      </header>

      <div className="trips-search-wrap">
        <div className="trips-search-bar">
          <Search size={21} />

          <input
            value={searchValue}
            onChange={(event) =>
              setSearchValue(event.target.value)
            }
            placeholder="Search trips, destinations, flights..."
            aria-label="Search trips"
          />

          <button
            type="button"
            className={`trips-filter-button ${
              tripFilter !== "all" ? "active" : ""
            }`}
            onClick={() => setFilterOpen((current) => !current)}
            aria-label="Filter trips"
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal size={19} />
          </button>
        </div>

        {filterOpen && (
          <div className="trips-filter-menu">
            {[
              ["all", "All trips"],
              ["upcoming", "Upcoming"],
              ["past", "Past trips"],
              ["drafts", "Drafts"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={tripFilter === value ? "active" : ""}
                onClick={() => {
                  setTripFilter(value);
                  setFilterOpen(false);
                }}
              >
                {label}
                {tripFilter === value && <CheckCircle2 size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {syncing && (
        <div className="trips-sync-status">
          <LoaderCircle className="spin" size={13} />
          Syncing trips
        </div>
      )}

      {featuredTrip ? (
        <>
          <FeaturedBoardingPass
            trip={featuredTrip}
            onOpen={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Overview",
              )
            }
            onTripUpdated={(updatedFields) =>
              onTripUpdated(
                featuredTrip.trip_id,
                updatedFields,
              )
            }
          />

          <FeaturedTripSummary
            trip={featuredTrip}
            onOpen={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Overview",
              )
            }
          />

          <QuickActions
            onItinerary={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Itinerary",
              )
            }
            onBudget={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Budget",
              )
            }
            onExpenses={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Expenses",
              )
            }
            onChecklist={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Checklist",
              )
            }
            onDocuments={() =>
              onOpenTrip(
                featuredTrip.trip_id,
                "Documents",
              )
            }
          />
        </>
      ) : null}

      <section className="ios-upcoming">
        <div className="ios-section-title">
          <div>
            <h2>
              {featuredTrip ? "Upcoming Trips" : "Your Trips"}
            </h2>
            <p>
              Open any trip to continue planning.
            </p>
          </div>

          {(upcomingTrips.length > 0 || searchValue || tripFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                if (upcomingTrips.length > 3) {
                  setShowAllUpcoming((current) => !current);
                } else {
                  resetTripView();
                }
              }}
            >
              {upcomingTrips.length > 3
                ? showAllUpcoming
                  ? "Show Less"
                  : "See All"
                : "See All"}
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {loading && trips.length === 0 ? (
          <TripsSkeleton />
        ) : visibleUpcomingTrips.length ? (
          <div className="ios-upcoming-list">
            {visibleUpcomingTrips.map((trip) => (
              <UpcomingTripCard
                key={trip.trip_id}
                trip={trip}
                onOpen={() =>
                  onOpenTrip(
                    trip.trip_id,
                    "Overview",
                  )
                }
              />
            ))}
          </div>
        ) : featuredTrip ? (
          <button
            type="button"
            className="trips-add-another"
            onClick={onCreateTrip}
          >
            <Plus size={18} />
            Add another trip
          </button>
        ) : (
          <section className="trips-empty-state">
            <PlaneTakeoff size={38} />
            <h2>No matching trips</h2>

            <p>
              Clear the current search or filter, or create a new
              trip to start planning.
            </p>

            <div>
              <button type="button" onClick={onCreateTrip}>
                <Plus size={17} />
                Create Trip
              </button>

              <button type="button" onClick={resetTripView}>
                <RefreshCw size={16} />
                Clear filters
              </button>

              <button type="button" onClick={onRetry}>
                Retry sync
              </button>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

function FeaturedBoardingPass({
  trip,
  onOpen,
  onTripUpdated,
}) {
  const [flightNumber, setFlightNumber] = useState(
    trip.flight_number || "",
  );
  const [checkingFlight, setCheckingFlight] =
    useState(false);
  const [flightError, setFlightError] = useState("");
  const [liveFlight, setLiveFlight] = useState(null);

  useEffect(() => {
    setFlightNumber(trip.flight_number || "");
    setLiveFlight(null);
    setFlightError("");
  }, [trip.flight_number, trip.trip_id]);

  const originCode =
    liveFlight?.departure?.iata ||
    trip.origin_code ||
    "ORG";

  const destinationCode =
    liveFlight?.arrival?.iata ||
    trip.destination_code ||
    trip.destination?.slice(0, 3).toUpperCase() ||
    "DST";

  const departureValue =
    liveFlight?.departure?.actual ||
    liveFlight?.departure?.estimated ||
    liveFlight?.departure?.scheduled ||
    trip.departure_time;

  const arrivalValue =
    liveFlight?.arrival?.actual ||
    liveFlight?.arrival?.estimated ||
    liveFlight?.arrival?.scheduled ||
    trip.arrival_time;

  const displayedStatus =
    liveFlight?.status ||
    trip.flight_status ||
    "scheduled";

  // Airport captions must come from the flight result, not from the
  // trip destination. This prevents values such as “Hong Kong” from
  // appearing below MNL after a successful flight lookup.
  const originAirportLabel =
    liveFlight?.departure?.airport ||
    trip.origin_airport_name ||
    trip.origin_city ||
    originCode;

  const destinationAirportLabel =
    liveFlight?.arrival?.airport ||
    trip.destination_airport_name ||
    trip.destination_code ||
    destinationCode;

  async function checkFlightStatus(event) {
    event.preventDefault();
    event.stopPropagation();

    const normalizedFlightNumber =
      flightNumber.replace(/\s+/g, "").toUpperCase();

    if (!normalizedFlightNumber) {
      setFlightError("Enter a flight number first.");
      return;
    }

    setCheckingFlight(true);
    setFlightError("");

    try {
      const searchDate =
        trip.start_date ||
        new Date().toISOString().slice(0, 10);

      const query = new URLSearchParams({
        flightNumber: normalizedFlightNumber,
        date: searchDate,
      });

      const response = await fetch(
        `/api/flight-status?${query.toString()}`,
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "The flight could not be checked.",
        );
      }

      setLiveFlight(payload);

      const updatedFields = {
        flight_number:
          payload.flightNumber ||
          normalizedFlightNumber,
        origin_code:
          payload.departure?.iata ||
          trip.origin_code ||
          null,
        destination_code:
          payload.arrival?.iata ||
          trip.destination_code ||
          null,
        origin_city:
          payload.departure?.airport ||
          trip.origin_city ||
          null,
        origin_airport_name:
          payload.departure?.airport ||
          trip.origin_airport_name ||
          null,
        destination_airport_name:
          payload.arrival?.airport ||
          trip.destination_airport_name ||
          null,
        departure_time:
          payload.departure?.actual ||
          payload.departure?.estimated ||
          payload.departure?.scheduled ||
          trip.departure_time ||
          null,
        arrival_time:
          payload.arrival?.actual ||
          payload.arrival?.estimated ||
          payload.arrival?.scheduled ||
          trip.arrival_time ||
          null,
        terminal:
          payload.departure?.terminal ||
          trip.terminal ||
          null,
        gate:
          payload.departure?.gate ||
          trip.gate ||
          null,
        flight_status:
          payload.status || "scheduled",
        flight_status_updated_at:
          new Date().toISOString(),
      };

      let updateResult = await supabase
        .from("trips")
        .update(updatedFields)
        .eq("trip_id", trip.trip_id)
        .select()
        .single();

      if (
        updateResult.error &&
        /(flight_status|origin_airport_name|destination_airport_name)/i.test(
          updateResult.error.message || "",
        )
      ) {
        const {
          flight_status,
          flight_status_updated_at,
          origin_airport_name,
          destination_airport_name,
          ...compatibleFields
        } = updatedFields;

        updateResult = await supabase
          .from("trips")
          .update(compatibleFields)
          .eq("trip_id", trip.trip_id)
          .select()
          .single();
      }

      if (updateResult.error) {
        throw updateResult.error;
      }

      onTripUpdated?.({
        ...updatedFields,
        ...updateResult.data,
      });
    } catch (error) {
      setFlightError(getErrorMessage(error));
    } finally {
      setCheckingFlight(false);
    }
  }

  function handleTicketOpen(event) {
    if (
      event.target.closest(
        ".flight-status-inline-form",
      )
    ) {
      return;
    }

    onOpen();
  }

  return (
    <section
      className="featured-boarding-pass"
      role="button"
      tabIndex={0}
      onClick={handleTicketOpen}
      onKeyDown={(event) => {
        if (
          event.target.closest(
            ".flight-status-inline-form",
          )
        ) {
          return;
        }

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="boarding-ticket-main">
        <div className="boarding-ticket-topline">
          <span className="boarding-featured-label">
            <PlaneTakeoff size={14} />
            Next Trip
          </span>

          <span
            className={`boarding-live-status status-${String(
              displayedStatus,
            )
              .toLowerCase()
              .replace(/\s+/g, "-")}`}
          >
            <i />
            {getFlightStatusLabel(displayedStatus)}
          </span>
        </div>

        <div className="boarding-route-line">
          <div className="boarding-airport">
            <strong>{originCode}</strong>
            <span>{originAirportLabel}</span>
          </div>

          <div className="boarding-route-visual">
            <i />
            <Plane size={25} />
            <i />
          </div>

          <div className="boarding-airport align-right">
            <strong>{destinationCode}</strong>
            <span>{destinationAirportLabel}</span>
          </div>
        </div>

        <div className="boarding-time-grid">
          <div>
            <span>Departs</span>
            <strong>{formatTime(departureValue)}</strong>
            <small>{formatDate(trip.start_date)}</small>
          </div>

          <div>
            <span>ETA / Arrives</span>
            <strong>{formatTime(arrivalValue)}</strong>
            <small>
              {liveFlight?.arrival?.delay
                ? `${liveFlight.arrival.delay} min delay`
                : "Local time"}
            </small>
          </div>
        </div>
      </div>

      <aside className="boarding-ticket-stub">
        <div>
          <span>Gate</span>
          <strong>
            {liveFlight?.departure?.gate ||
              trip.gate ||
              "—"}
          </strong>
        </div>

        <div>
          <span>Flight</span>
          <strong>
            {liveFlight?.flightNumber ||
              trip.flight_number ||
              "TBD"}
          </strong>
        </div>

        <div className="boarding-stub-pair">
          <p>
            <span>Terminal</span>
            <strong>
              {liveFlight?.departure?.terminal ||
                trip.terminal ||
                "—"}
            </strong>
          </p>

          <p>
            <span>Seat</span>
            <strong>{trip.seat || "—"}</strong>
          </p>
        </div>

        <div className="boarding-barcode" aria-hidden="true" />
      </aside>

      <form
        className="flight-status-inline-form"
        onSubmit={checkFlightStatus}
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <Plane size={17} />
          <input
            value={flightNumber}
            onChange={(event) =>
              setFlightNumber(event.target.value)
            }
            placeholder="Enter flight number, e.g. PR422"
            aria-label="Flight number"
          />
        </div>

        <button
          type="submit"
          disabled={
            checkingFlight || !flightNumber.trim()
          }
        >
          {checkingFlight ? (
            <LoaderCircle
              className="spin"
              size={16}
            />
          ) : (
            <RefreshCw size={16} />
          )}
          {checkingFlight ? "Checking" : "Check flight"}
        </button>

        {flightError && (
          <p className="flight-status-error">
            {flightError}
          </p>
        )}
      </form>
    </section>
  );
}

function FeaturedTripSummary({ trip, onOpen }) {
  const totalBudget = Number(trip.total_budget || 0);
  const totalSpent = Number(trip.total_spent || 0);

  const remainingBudget =
    totalBudget > 0
      ? Math.max(totalBudget - totalSpent, 0)
      : 0;

  const budgetScore =
    totalBudget > 0
      ? Math.round(
          (remainingBudget / totalBudget) * 100,
        )
      : 40;

  const dateScore =
    trip.start_date && trip.end_date ? 100 : 35;

  const flightScore =
    trip.departure_time && trip.arrival_time
      ? 100
      : trip.flight_number
        ? 65
        : 25;

  const readiness = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (budgetScore + dateScore + flightScore) /
          3,
      ),
    ),
  );

  const members = trip.accepted_members || [];
  const travelers = 1 + Number(members.length || 0);

  return (
    <button
      type="button"
      className="featured-trip-summary"
      onClick={onOpen}
    >
      <img
        src={getTripCoverImage(trip)}
        alt={trip.destination || "Trip"}
      />

      <div className="featured-trip-copy">
        <h2>
          {trip.trip_name ||
            `${trip.destination} Trip`}
        </h2>

        <p>
          {trip.destination || "Destination pending"}
        </p>

        <div className="featured-traveler-row">
          <span className="featured-avatar-stack">
            <b>YOU</b>
            {members.slice(0, 3).map((membership) => {
              const member = membership.users;

              return (
                <b key={membership.member_id || member?.user_id}>
                  {member?.profile_picture_url ? (
                    <img
                      src={member.profile_picture_url}
                      alt={member.full_name || "Traveler"}
                    />
                  ) : (
                    getInitials(member?.full_name || "Traveler")
                  )}
                </b>
              );
            })}
            {members.length > 3 && <b>+{members.length - 3}</b>}
          </span>
          <small>
            {travelers} {travelers === 1 ? "traveler" : "travelers"}
          </small>
        </div>
      </div>

      <div
        className="featured-readiness-ring"
        style={{
          "--readiness": `${readiness * 3.6}deg`,
        }}
      >
        <div>
          <strong>{readiness}%</strong>
          <span>Ready</span>
        </div>
      </div>

      <ChevronRight size={20} />
    </button>
  );
}

function QuickActions({
  onItinerary,
  onBudget,
  onExpenses,
  onChecklist,
  onDocuments,
}) {
  const actions = [
    {
      key: "itinerary",
      title: "Itinerary",
      subtitle: "View your plans",
      icon: CalendarDays,
      className: "action-coral action-wide",
      onClick: onItinerary,
    },
    {
      key: "budget",
      title: "Budget",
      subtitle: "Track your budget",
      icon: WalletCards,
      className: "action-mint action-wide",
      onClick: onBudget,
    },
    {
      key: "expenses",
      title: "Expenses",
      subtitle: "Add & manage",
      icon: ReceiptText,
      className: "action-apricot action-compact",
      onClick: onExpenses,
    },
    {
      key: "checklist",
      title: "Checklist",
      subtitle: "Stay organized",
      icon: ListChecks,
      className: "action-lilac action-compact",
      onClick: onChecklist,
    },
    {
      key: "documents",
      title: "Documents",
      subtitle: "Travel docs",
      icon: FolderOpen,
      className: "action-blue action-compact",
      onClick: onDocuments,
    },
  ];

  return (
    <section className="trips-quick-actions-wrap">
      <div className="ios-section-title">
        <div>
          <h2>Quick Actions</h2>
          <p>Everything for your latest trip.</p>
        </div>
      </div>

      <div className="trips-quick-actions">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.key}
              type="button"
              className={action.className}
              onClick={action.onClick}
            >
              <span className="quick-action-copy">
                <strong>{action.title}</strong>
                <small>{action.subtitle}</small>
              </span>

              <span className="quick-action-icon">
                <Icon size={31} strokeWidth={1.8} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PieIcon() {
  return (
    <span className="quick-pie-icon" aria-hidden="true">
      ◔
    </span>
  );
}

function UpcomingTripCard({ trip, onOpen }) {
  const daysUntil = getDaysUntil(trip.start_date);

  return (
    <button
      type="button"
      className="ios-trip-pass"
      onClick={onOpen}
    >
      <img
        src={getTripCoverImage(trip)}
        alt={trip.destination || "Trip"}
      />

      <span className="ios-trip-pass-copy">
        <strong>
          {trip.trip_name ||
            `${trip.destination} Trip`}
        </strong>

        <small>{trip.destination}</small>

        <em>
          <CalendarDays size={13} />
          {formatDate(trip.start_date)}
          {trip.end_date
            ? ` – ${formatDate(trip.end_date)}`
            : ""}
        </em>
      </span>

      <span
        className={`ios-trip-countdown ${
          daysUntil !== null && daysUntil < 0
            ? "past"
            : ""
        }`}
      >
        {daysUntil === null
          ? "Draft"
          : daysUntil < 0
            ? "Past"
            : daysUntil === 0
              ? "Today"
              : `${daysUntil} days`}
      </span>

      <ChevronRight size={19} />
    </button>
  );
}

function TripOverview({
  trip,
  onQuickOpen,
  onEditTrip,
  onCompletePlanning,
  onManageCollaborators,
  canManageCollaborators,
}) {
  const totalBudget = Number(trip.total_budget || 0);
  const totalSpent = Number(trip.total_spent || 0);

  const travelers =
    1 + Number(trip.accepted_members?.length || 0);

  return (
    <>
      <section className="premium-trip-hero">
        <div
          className="premium-map"
          style={{
            backgroundImage: `
              linear-gradient(
                90deg,
                rgba(255,255,255,.1),
                rgba(255,255,255,.5)
              ),
              url("${
                getTripCoverImage(trip)
              }")
            `,
          }}
        >
          <div className="flight-glass">
            <Plane size={28} />

            <div>
              <h3>
                {trip.origin_code || "Origin"} →{" "}
                {trip.destination_code || trip.destination}
              </h3>

              <p>{formatDate(trip.start_date)}</p>

              <span>
                {trip.departure_time ? "Scheduled" : "Planning"}
              </span>
            </div>
          </div>

          <span className="route-city city-tokyo">
            {trip.destination}
          </span>
        </div>

        <div className="boarding-glass-card">
          <div>
            <small>Terminal</small>
            <strong>{trip.terminal || "—"}</strong>
          </div>

          <div>
            <small>Gate</small>
            <strong>{trip.gate || "—"}</strong>
          </div>

          <div>
            <small>Seat</small>
            <strong>{trip.seat || "—"}</strong>
          </div>

          <button type="button" onClick={onEditTrip}>
            <Edit3 size={17} />
            Edit Details
          </button>
        </div>

        <div className="trip-date-glass">
          <div>
            <small>START</small>

            <strong>
              {trip.start_date
                ? new Date(
                    `${trip.start_date}T00:00:00`,
                  ).getDate()
                : "—"}
            </strong>

            <small>
              {trip.start_date
                ? new Date(
                    `${trip.start_date}T00:00:00`,
                  )
                    .toLocaleDateString("en-PH", {
                      month: "short",
                    })
                    .toUpperCase()
                : "TBD"}
            </small>
          </div>

          <section>
            <h3>Travelers</h3>
            <p>
              {travelers}{" "}
              {travelers === 1 ? "person" : "people"}
            </p>
          </section>

          <button
            type="button"
            onClick={
              canManageCollaborators
                ? onManageCollaborators
                : onEditTrip
            }
          >
            <UsersRound size={16} />
            {canManageCollaborators ? "Invite" : "View"}
          </button>
        </div>
      </section>

      <section className="trip-completion-reminder">
        <div className="trip-reminder-icon">
          <CheckCircle2 size={24} />
        </div>

        <div className="trip-reminder-copy">
          <span>TRIP SETUP</span>
          <strong>Finish the details whenever you’re ready</strong>
          <p>
            Add your budget, group, travel style, and preferred
            activities later. Your trip is already saved.
          </p>
        </div>

        <button type="button" onClick={onCompletePlanning}>
          Complete details
          <ChevronRight size={17} />
        </button>
      </section>

      <section className="premium-quick-card">
        <h2>Quick Access</h2>

        <div className="premium-quick-grid">
          <button
            type="button"
            onClick={() => onQuickOpen("Itinerary")}
          >
            <CalendarDays size={24} />
            <strong>Itinerary</strong>
            <span>Plan activities</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickOpen("Budget")}
          >
            <WalletCards size={24} />
            <strong>Budget</strong>
            <span>{formatCompactCurrency(totalBudget)}</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickOpen("Expenses")}
          >
            <PieIcon />
            <strong>Expenses</strong>
            <span>{formatCompactCurrency(totalSpent)}</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickOpen("Checklist")}
          >
            <CheckCircle2 size={24} />
            <strong>Checklist</strong>
            <span>Track trip tasks</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickOpen("Documents")}
          >
            <FileText size={24} />
            <strong>Documents</strong>
            <span>Stored locally</span>
          </button>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   LOCAL DOCUMENTS
========================================================= */

function LocalDocumentsScreen({ trip, onTripUpdated }) {
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    setError("");

    try {
      const localDocuments = await getLocalDocuments(trip.trip_id);
      setDocuments(localDocuments);
    } catch (loadError) {
      console.error("Local document load error:", loadError);
      setError("Unable to read local documents from this browser.");
    } finally {
      setLoadingDocuments(false);
    }
  }, [trip.trip_id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function openAddDocument() {
    setEditingDocument(null);
    setUploadOpen(true);
  }

  async function removeDocument(documentRecord) {
    const confirmed = window.confirm(
      `Delete “${documentRecord.name}” from this device?`,
    );

    if (!confirmed) return;

    try {
      await deleteLocalDocument(documentRecord.documentId);

      setDocuments((current) =>
        current.filter(
          (item) => item.documentId !== documentRecord.documentId,
        ),
      );
    } catch (deleteError) {
      console.error("Local document delete error:", deleteError);
      setError("The document could not be deleted.");
    }
  }

  function openDocument(documentRecord) {
    const objectUrl = URL.createObjectURL(documentRecord.file);

    window.open(objectUrl, "_blank", "noopener,noreferrer");

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }

  function downloadDocument(documentRecord) {
    const objectUrl = URL.createObjectURL(documentRecord.file);
    const anchor = window.document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = documentRecord.name;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function saveDocument({ name, category, notes, file }) {
    try {
      const documentId =
        editingDocument?.documentId || createSafeUUID();

      const storedFile = file || editingDocument?.file;

      if (!storedFile) {
        throw new Error("Choose a file.");
      }

      const nextDocument = {
        documentId,
        tripId: trip.trip_id,
        name: name.trim() || storedFile.name || "Travel Document",
        category,
        notes: notes.trim() || "",
        file: storedFile,
        mimeType:
          storedFile.type || editingDocument?.mimeType || "",
        size: storedFile.size || editingDocument?.size || 0,
        createdAt:
          editingDocument?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveLocalDocument(nextDocument);

      setUploadOpen(false);
      setEditingDocument(null);
      await loadDocuments();

      if (category === "Boarding Pass" && file) {
        setScanning(true);

        try {
          const rawBarcode = await scanBoardingPassImage(file);
          const parsed = parseBoardingPassBarcode(
            rawBarcode,
            trip.start_date,
          );

          setScanResult(parsed);
        } catch (scanError) {
          setError(
            `${getErrorMessage(
              scanError,
            )} The document was still saved locally.`,
          );
        } finally {
          setScanning(false);
        }
      }
    } catch (saveError) {
      console.error("Local document save error:", saveError);
      setError(getErrorMessage(saveError));
    }
  }

  async function confirmParsedFlightDetails(details) {
    const payload = {
      origin_code: details.origin_code?.trim().toUpperCase() || null,
      destination_code:
        details.destination_code?.trim().toUpperCase() || null,
      flight_number: details.flight_number?.trim() || null,
      departure_time: details.departure_time || null,
      arrival_time: details.arrival_time || null,
      terminal: details.terminal?.trim() || null,
      gate: details.gate?.trim().toUpperCase() || null,
      seat: details.seat?.trim().toUpperCase() || null,
    };

    const { data, error: updateError } = await supabase
      .from("trips")
      .update(payload)
      .eq("trip_id", trip.trip_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    onTripUpdated?.(data);
    setScanResult(null);
  }

  return (
    <section className="local-documents-screen">
      <header className="local-documents-header">
        <div>
          <h2>Travel Documents</h2>
          <p>
            Files stay on this device. Boarding-pass images can be
            scanned locally for QR or barcode details.
          </p>
        </div>

        <button type="button" onClick={openAddDocument}>
          <Plus size={17} />
          Add Document
        </button>
      </header>

      <div className="document-privacy-notice">
        <FolderOpen size={20} />
        <p>
          Automatic scanning works with boarding-pass images or
          screenshots. PDFs remain stored locally but are not scanned
          in this lightweight version.
        </p>
      </div>

      {error && (
        <div className="documents-error">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {scanning && (
        <div className="documents-loading">
          <LoaderCircle className="spin" size={27} />
          <p>Reading boarding-pass QR or barcode...</p>
        </div>
      )}

      {loadingDocuments ? (
        <div className="documents-loading">
          <LoaderCircle className="spin" size={27} />
          <p>Loading local documents...</p>
        </div>
      ) : documents.length ? (
        <div className="local-document-list">
          {documents.map((documentRecord) => (
            <article key={documentRecord.documentId}>
              <div className="local-document-icon">
                <FileText size={21} />
              </div>

              <button
                type="button"
                className="local-document-main"
                onClick={() => openDocument(documentRecord)}
              >
                <strong>{documentRecord.name}</strong>
                <span>{documentRecord.category}</span>
                <small>
                  {(
                    Number(documentRecord.size || 0) /
                    1024 /
                    1024
                  ).toFixed(2)}{" "}
                  MB
                </small>
              </button>

              <button
                type="button"
                onClick={() => downloadDocument(documentRecord)}
                aria-label="Download document"
              >
                <Download size={17} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingDocument(documentRecord);
                  setUploadOpen(true);
                }}
                aria-label="Edit document"
              >
                <Edit3 size={17} />
              </button>

              <button
                type="button"
                onClick={() => removeDocument(documentRecord)}
                aria-label="Delete document"
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="documents-empty">
          <Paperclip size={34} />
          <h3>No local documents</h3>
          <p>
            Add boarding passes, confirmations, vouchers, tickets,
            receipts, packing lists, or offline guides.
          </p>

          <button type="button" onClick={openAddDocument}>
            <Upload size={17} />
            Add First Document
          </button>
        </div>
      )}

      {scanResult && (
        <FlightDetailsConfirmationModal
          initialDetails={scanResult}
          onClose={() => setScanResult(null)}
          onConfirm={confirmParsedFlightDetails}
        />
      )}

      {uploadOpen && (
        <LocalDocumentModal
          existingDocument={editingDocument}
          categories={DOCUMENT_CATEGORIES}
          onClose={() => {
            setUploadOpen(false);
            setEditingDocument(null);
          }}
          onSave={saveDocument}
        />
      )}
    </section>
  );
}

/* =========================================================
   LOCAL DOCUMENT MODAL
========================================================= */

function LocalDocumentModal({
  existingDocument,
  categories,
  onClose,
  onSave,
}) {
  const [name, setName] = useState(existingDocument?.name || "");
  const [category, setCategory] = useState(
    existingDocument?.category || "Boarding Pass",
  );
  const [notes, setNotes] = useState(
    existingDocument?.notes || "",
  );
  const [file, setFile] = useState(null);

  function submit(event) {
    event.preventDefault();
    onSave({ name, category, notes, file });
  }

  return (
    <div className="trip-form-backdrop" onMouseDown={onClose}>
      <form
        className="local-document-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>
              {existingDocument ? "Edit Document" : "Add Document"}
            </h2>
            <p>The file stays in this browser or device only.</p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <label>
          Document name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Japan boarding pass"
          />
        </label>

        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Choose file
          <input
            required={!existingDocument}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
            onChange={(event) =>
              setFile(event.target.files?.[0] || null)
            }
          />
        </label>

        <label>
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional details"
          />
        </label>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>

          <button type="submit">
            <Save size={17} />
            Save Locally
          </button>
        </footer>
      </form>
    </div>
  );
}

/* =========================================================
   SHORT CREATE TRIP FORM
========================================================= */

function TripFormModal({
  form,
  setForm,
  editing,
  saving,
  onClose,
  onSubmit,
}) {
  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateStartDate(startDate) {
    setForm((current) => ({
      ...current,
      start_date: startDate,
      number_of_days:
        calculateTripDays(
          startDate,
          current.end_date,
        ) || current.number_of_days,
    }));
  }

  function updateEndDate(endDate) {
    setForm((current) => ({
      ...current,
      end_date: endDate,
      number_of_days:
        calculateTripDays(
          current.start_date,
          endDate,
        ) || current.number_of_days,
    }));
  }

  return (
    <div
      className="trip-form-backdrop"
      onMouseDown={onClose}
    >
      <form
        className="trip-form-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header>
          <div>
            <h2>
              {editing ? "Edit Trip" : "Create Trip"}
            </h2>
            <p>
              Add the basics now. Flight details can be
              checked live from the boarding pass later.
            </p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="trip-form-grid">
          <label className="full">
            Trip name
            <input
              value={form.trip_name}
              onChange={(event) =>
                updateField(
                  "trip_name",
                  event.target.value,
                )
              }
              placeholder="Japan Adventure"
            />
          </label>

          <label className="full">
            Destination
            <input
              required
              list="trava-destination-options"
              value={form.destination}
              onChange={(event) =>
                updateField(
                  "destination",
                  event.target.value,
                )
              }
              placeholder="Choose or type a city or country"
            />

            <datalist id="trava-destination-options">
              {DESTINATION_SUGGESTIONS.map(
                (destination) => (
                  <option
                    value={destination}
                    key={destination}
                  />
                ),
              )}
            </datalist>
          </label>

          <label>
            Start date
            <input
              type="date"
              value={form.start_date}
              max={form.end_date || undefined}
              onChange={(event) =>
                updateStartDate(event.target.value)
              }
            />
          </label>

          <label>
            End date
            <input
              type="date"
              value={form.end_date}
              min={form.start_date || undefined}
              onChange={(event) =>
                updateEndDate(event.target.value)
              }
            />
          </label>
        </div>

        <details className="trip-flight-fields">
          <summary>
            <Plane size={17} />
            Add flight details
            <small>Optional</small>
          </summary>

          <div className="trip-form-grid">
            <label className="full">
              Flight number
              <input
                value={form.flight_number}
                onChange={(event) =>
                  updateField(
                    "flight_number",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="PR422 or 5J5062"
              />
            </label>

            <label>
              Origin code
              <input
                value={form.origin_code}
                onChange={(event) =>
                  updateField(
                    "origin_code",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="CEB"
                maxLength={3}
              />
            </label>

            <label>
              Destination code
              <input
                value={form.destination_code}
                onChange={(event) =>
                  updateField(
                    "destination_code",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="NRT"
                maxLength={3}
              />
            </label>

            <label>
              Departure
              <input
                type="datetime-local"
                value={form.departure_time}
                onChange={(event) =>
                  updateField(
                    "departure_time",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Arrival / ETA
              <input
                type="datetime-local"
                value={form.arrival_time}
                onChange={(event) =>
                  updateField(
                    "arrival_time",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Gate
              <input
                value={form.gate}
                onChange={(event) =>
                  updateField(
                    "gate",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="B12"
              />
            </label>

            <label>
              Terminal
              <input
                value={form.terminal}
                onChange={(event) =>
                  updateField(
                    "terminal",
                    event.target.value,
                  )
                }
                placeholder="2"
              />
            </label>

            <label>
              Seat
              <input
                value={form.seat}
                onChange={(event) =>
                  updateField(
                    "seat",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="12A"
              />
            </label>

            <label>
              Origin city
              <input
                value={form.origin_city}
                onChange={(event) =>
                  updateField(
                    "origin_city",
                    event.target.value,
                  )
                }
                placeholder="Cebu, Philippines"
              />
            </label>
          </div>
        </details>

        <div className="trip-form-reminder">
          The live checker updates status, terminal, gate,
          departure, and arrival information when the
          provider has those fields available.
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle
                className="spin"
                size={18}
              />
            ) : (
              <Save size={18} />
            )}
            {editing
              ? "Save Changes"
              : "Create Trip"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function PlanningDetailsModal({ trip, onClose, onSaved }) {
  const [form, setForm] = useState({
    total_budget: String(trip.total_budget || ""),
    travel_group:
      trip.travel_group === "Not specified"
        ? ""
        : trip.travel_group || "",
    travel_style: trip.travel_style || "Standard",
    preferred_activities: trip.preferred_activities || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        total_budget: Number(form.total_budget || 0),
        travel_group: form.travel_group.trim() || "Not specified",
        travel_style: form.travel_style || "Standard",
        preferred_activities:
          form.preferred_activities.trim() || null,
      };

      const { data, error: updateError } = await supabase
        .from("trips")
        .update(payload)
        .eq("trip_id", trip.trip_id)
        .select()
        .single();

      if (updateError) throw updateError;
      onSaved(data);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="trip-form-backdrop" onMouseDown={onClose}>
      <form
        className="trip-form-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>Complete trip details</h2>
            <p>These fields are optional and editable anytime.</p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="trip-form-grid">
          <label>
            Total budget
            <input
              min="0"
              step="0.01"
              type="number"
              value={form.total_budget}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  total_budget: event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </label>

          <label>
            Travel group
            <input
              value={form.travel_group}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  travel_group: event.target.value,
                }))
              }
              placeholder="Solo, Couple, Family, Friends"
            />
          </label>

          <label className="full">
            Travel style
            <select
              value={form.travel_style}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  travel_style: event.target.value,
                }))
              }
            >
              <option value="Budget">Budget</option>
              <option value="Standard">Standard</option>
              <option value="Luxury">Luxury</option>
              <option value="Adventure">Adventure</option>
            </select>
          </label>

          <label className="full">
            Preferred activities
            <textarea
              value={form.preferred_activities}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferred_activities: event.target.value,
                }))
              }
              placeholder="Food trips, museums, shopping, beaches..."
            />
          </label>
        </div>

        {error && <div className="documents-error">{error}</div>}

        <footer>
          <button type="button" onClick={onClose}>
            Later
          </button>

          <button type="submit" disabled={saving}>
            {saving ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Save details
          </button>
        </footer>
      </form>
    </div>
  );
}

/* =========================================================
   FLIGHT DETAILS CONFIRMATION
========================================================= */

function FlightDetailsConfirmationModal({
  initialDetails,
  onClose,
  onConfirm,
}) {
  const [details, setDetails] = useState(initialDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setDetails((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onConfirm(details);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="trip-form-backdrop" onMouseDown={onClose}>
      <form
        className="trip-form-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>Confirm flight details</h2>
            <p>
              The QR or barcode filled what it could find. Review or
              complete any missing fields.
            </p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="trip-form-grid">
          <label>
            Origin code
            <input
              value={details.origin_code || ""}
              onChange={(event) =>
                updateField(
                  "origin_code",
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="CEB"
            />
          </label>

          <label>
            Destination code
            <input
              value={details.destination_code || ""}
              onChange={(event) =>
                updateField(
                  "destination_code",
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="NRT"
            />
          </label>

          <label>
            Flight number
            <input
              value={details.flight_number || ""}
              onChange={(event) =>
                updateField("flight_number", event.target.value)
              }
              placeholder="5J 5062"
            />
          </label>

          <label>
            Seat
            <input
              value={details.seat || ""}
              onChange={(event) =>
                updateField(
                  "seat",
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="12A"
            />
          </label>

          <label>
            Departure
            <input
              type="datetime-local"
              value={details.departure_time || ""}
              onChange={(event) =>
                updateField("departure_time", event.target.value)
              }
            />
          </label>

          <label>
            Arrival
            <input
              type="datetime-local"
              value={details.arrival_time || ""}
              onChange={(event) =>
                updateField("arrival_time", event.target.value)
              }
            />
          </label>

          <label>
            Terminal
            <input
              value={details.terminal || ""}
              onChange={(event) =>
                updateField("terminal", event.target.value)
              }
              placeholder="2"
            />
          </label>

          <label>
            Gate
            <input
              value={details.gate || ""}
              onChange={(event) =>
                updateField(
                  "gate",
                  event.target.value.toUpperCase(),
                )
              }
              placeholder="C6"
            />
          </label>
        </div>

        {error && <div className="documents-error">{error}</div>}

        <footer>
          <button type="button" onClick={onClose}>
            Save later
          </button>

          <button type="submit" disabled={saving}>
            {saving ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Save flight details
          </button>
        </footer>
      </form>
    </div>
  );
}

/* =========================================================
   CHECKLIST
========================================================= */

function ChecklistScreen({ tripId }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [category, setCategory] =
    useState("General");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingStarterList, setAddingStarterList] =
    useState(false);
  const [error, setError] = useState("");

  const completedCount = items.filter(
    (item) => item.is_completed,
  ).length;

  const progress = items.length
    ? Math.round(
        (completedCount / items.length) * 100,
      )
    : 0;

  const mascotMessage = getChecklistMessage(
    progress,
    completedCount,
    items.length,
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } =
      await supabase
        .from("trip_checklist_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", {
          ascending: true,
        });

    if (loadError) {
      setError(getErrorMessage(loadError));
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function getAuthenticatedUserId() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user?.id) {
      throw new Error("Please sign in again.");
    }

    return session.user.id;
  }

  async function addItem(event) {
    event.preventDefault();

    const textValue = newItem.trim();
    if (!textValue) return;

    setSaving(true);
    setError("");

    try {
      const userId =
        await getAuthenticatedUserId();

      const { data, error: insertError } =
        await supabase
          .from("trip_checklist_items")
          .insert({
            trip_id: tripId,
            user_id: userId,
            item_text: textValue,
            category,
            is_completed: false,
          })
          .select()
          .single();

      if (insertError) throw insertError;

      setItems((current) => [
        ...current,
        data,
      ]);
      setNewItem("");
    } catch (addError) {
      setError(getErrorMessage(addError));
    } finally {
      setSaving(false);
    }
  }

  async function addStarterList() {
    if (addingStarterList) return;

    setAddingStarterList(true);
    setError("");

    try {
      const userId =
        await getAuthenticatedUserId();

      const starterItems = [
        ["Passport and valid IDs", "Documents"],
        ["Flight and hotel confirmations", "Booking"],
        ["Medicines and basic first aid", "Health"],
        ["Chargers and power bank", "Packing"],
        ["Cash, cards, and travel budget", "Money"],
        ["Weather-ready clothes", "Packing"],
      ];

      const existingTexts = new Set(
        items.map((item) =>
          item.item_text.toLowerCase(),
        ),
      );

      const rows = starterItems
        .filter(
          ([itemText]) =>
            !existingTexts.has(
              itemText.toLowerCase(),
            ),
        )
        .map(([itemText, itemCategory]) => ({
          trip_id: tripId,
          user_id: userId,
          item_text: itemText,
          category: itemCategory,
          is_completed: false,
        }));

      if (!rows.length) return;

      const { data, error: insertError } =
        await supabase
          .from("trip_checklist_items")
          .insert(rows)
          .select();

      if (insertError) throw insertError;

      setItems((current) => [
        ...current,
        ...(data || []),
      ]);
    } catch (starterError) {
      setError(
        getErrorMessage(starterError),
      );
    } finally {
      setAddingStarterList(false);
    }
  }

  async function toggleItem(item) {
    const nextValue = !item.is_completed;

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.checklist_item_id ===
        item.checklist_item_id
          ? {
              ...currentItem,
              is_completed: nextValue,
            }
          : currentItem,
      ),
    );

    const { error: updateError } =
      await supabase
        .from("trip_checklist_items")
        .update({
          is_completed: nextValue,
          updated_at: new Date().toISOString(),
        })
        .eq(
          "checklist_item_id",
          item.checklist_item_id,
        );

    if (updateError) {
      setError(getErrorMessage(updateError));
      loadItems();
    }
  }

  async function editItem(item) {
    const nextText = window.prompt(
      "Edit checklist item",
      item.item_text,
    );

    if (
      !nextText?.trim() ||
      nextText.trim() === item.item_text
    ) {
      return;
    }

    const { data, error: updateError } =
      await supabase
        .from("trip_checklist_items")
        .update({
          item_text: nextText.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq(
          "checklist_item_id",
          item.checklist_item_id,
        )
        .select()
        .single();

    if (updateError) {
      setError(getErrorMessage(updateError));
      return;
    }

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.checklist_item_id ===
        item.checklist_item_id
          ? data
          : currentItem,
      ),
    );
  }

  async function deleteItem(itemId) {
    const { error: deleteError } =
      await supabase
        .from("trip_checklist_items")
        .delete()
        .eq("checklist_item_id", itemId);

    if (deleteError) {
      setError(getErrorMessage(deleteError));
      return;
    }

    setItems((current) =>
      current.filter(
        (item) =>
          item.checklist_item_id !== itemId,
      ),
    );
  }

  return (
    <section className="trip-checklist-screen">
      <header className="checklist-mascot-header">
        <div
          className={`checklist-mascot progress-${Math.min(
            4,
            Math.floor(progress / 25),
          )}`}
          aria-hidden="true"
        >
          <span className="mascot-handle" />
          <span className="mascot-face">
            <i />
            <i />
            <b />
          </span>
          <Sparkles
            className="mascot-spark mascot-spark-one"
            size={18}
          />
          <Sparkles
            className="mascot-spark mascot-spark-two"
            size={13}
          />
        </div>

        <div className="checklist-mascot-copy">
          <span>{mascotMessage.eyebrow}</span>
          <h2>{mascotMessage.title}</h2>
          <p>{mascotMessage.body}</p>

          <button
            type="button"
            onClick={addStarterList}
            disabled={addingStarterList}
          >
            {addingStarterList ? (
              <LoaderCircle
                className="spin"
                size={15}
              />
            ) : (
              <Bot size={15} />
            )}
            Add suggested essentials
          </button>
        </div>

        <div
          className="checklist-progress-badge"
          style={{ "--progress": progress }}
        >
          <strong>{progress}%</strong>
          <span>
            {completedCount}/{items.length || 0}
          </span>
        </div>
      </header>

      <div className="checklist-progress-track">
        <span
          style={{ width: `${progress}%` }}
        />
      </div>

      <form
        className="checklist-add-form"
        onSubmit={addItem}
      >
        <input
          value={newItem}
          onChange={(event) =>
            setNewItem(event.target.value)
          }
          placeholder="Add a checklist item"
        />

        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
        >
          <option value="General">General</option>
          <option value="Packing">Packing</option>
          <option value="Documents">Documents</option>
          <option value="Booking">Booking</option>
          <option value="Health">Health</option>
          <option value="Money">Money</option>
        </select>

        <button
          type="submit"
          disabled={saving || !newItem.trim()}
        >
          {saving ? (
            <LoaderCircle
              className="spin"
              size={17}
            />
          ) : (
            <Plus size={17} />
          )}
          Add
        </button>
      </form>

      {error && (
        <div className="documents-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="documents-loading">
          <LoaderCircle
            className="spin"
            size={26}
          />
          <p>Loading checklist...</p>
        </div>
      ) : items.length ? (
        <div className="checklist-list">
          {items.map((item) => (
            <article
              key={item.checklist_item_id}
              className={
                item.is_completed
                  ? "completed"
                  : ""
              }
            >
              <button
                type="button"
                className="checklist-toggle"
                onClick={() =>
                  toggleItem(item)
                }
                aria-label={
                  item.is_completed
                    ? "Mark as incomplete"
                    : "Mark as completed"
                }
              >
                {item.is_completed ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <span />
                )}
              </button>

              <div>
                <strong>{item.item_text}</strong>
                <small>
                  {item.category || "General"}
                </small>
              </div>

              <button
                type="button"
                onClick={() => editItem(item)}
                aria-label="Edit checklist item"
              >
                <Edit3 size={17} />
              </button>

              <button
                type="button"
                onClick={() =>
                  deleteItem(
                    item.checklist_item_id,
                  )
                }
                aria-label="Delete checklist item"
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="documents-empty">
          <TicketCheck size={35} />
          <h3>Your checklist is empty</h3>
          <p>
            Add a custom task or let the mascot
            create a starter list.
          </p>
        </div>
      )}
    </section>
  );
}

function TripNotificationPanel({
  notifications,
  loading,
  onClose,
  onRead,
  onRespond,
}) {
  return (
    <aside className="trip-notification-panel" aria-label="Trip notifications">
      <header>
        <div>
          <strong>Notifications</strong>
          <span>Trip invitations and collaboration updates</span>
        </div>

        <button type="button" onClick={onClose} aria-label="Close notifications">
          <X size={17} />
        </button>
      </header>

      {loading ? (
        <div className="trip-notification-empty">
          <LoaderCircle className="spin" size={21} />
          Loading notifications
        </div>
      ) : notifications.length ? (
        <div className="trip-notification-list">
          {notifications.map((notification) => {
            const isInvitation = notification.type === "trip_invitation";

            return (
              <article
                key={notification.notification_id}
                className={notification.is_read ? "" : "unread"}
                onClick={() => {
                  if (!isInvitation) {
                    onRead(notification.notification_id);
                  }
                }}
              >
                <span className="trip-notification-icon">
                  {isInvitation ? (
                    <UserRoundPlus size={17} />
                  ) : (
                    <Bell size={17} />
                  )}
                </span>

                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{formatNotificationTime(notification.created_at)}</small>

                  {isInvitation && !notification.is_read && (
                    <div className="trip-invitation-actions">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRespond(notification, "accepted");
                        }}
                      >
                        <UserCheck size={15} />
                        Accept
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRespond(notification, "declined");
                        }}
                      >
                        <UserX size={15} />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="trip-notification-empty">
          <Bell size={22} />
          No trip notifications yet
        </div>
      )}
    </aside>
  );
}

function TripCollaborationModal({
  trip,
  currentUser,
  onClose,
  onChanged,
  onError,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [workingUserId, setWorkingUserId] = useState(null);
  const searchTimer = useRef(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);

    try {
      const { data: membershipRows, error: membershipError } = await supabase
        .from("trip_members")
        .select(
          "member_id,trip_id,user_id,status,invited_by,created_at,responded_at",
        )
        .eq("trip_id", trip.trip_id)
        .order("created_at", { ascending: true });

      if (membershipError) throw membershipError;

      const userIds = (membershipRows || [])
        .map((membership) => membership.user_id)
        .filter(Boolean);
      let peopleById = {};

      if (userIds.length) {
        const { data: peopleRows, error: peopleError } = await supabase
          .from("users")
          .select("user_id,full_name,email,profile_picture_url")
          .in("user_id", userIds);

        if (peopleError) throw peopleError;
        peopleById = Object.fromEntries(
          (peopleRows || []).map((person) => [person.user_id, person]),
        );
      }

      setMemberships(
        (membershipRows || []).map((membership) => ({
          ...membership,
          person: peopleById[membership.user_id] || null,
        })),
      );
    } catch (loadError) {
      onError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [onError, trip.trip_id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    window.clearTimeout(searchTimer.current);

    const normalizedQuery = escapePostgrestSearch(query);

    if (normalizedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    searchTimer.current = window.setTimeout(async () => {
      setSearching(true);

      try {
        const pattern = `*${normalizedQuery}*`;
        const { data, error: searchError } = await supabase
          .from("users")
          .select("user_id,full_name,email,profile_picture_url")
          .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
          .neq("user_id", currentUser.id)
          .limit(12);

        if (searchError) throw searchError;

        const existingIds = new Set(
          memberships.map((membership) => membership.user_id),
        );

        setResults(
          (data || []).filter(
            (person) =>
              person.user_id !== trip.user_id &&
              !existingIds.has(person.user_id),
          ),
        );
      } catch (searchError) {
        onError(getErrorMessage(searchError));
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(searchTimer.current);
  }, [currentUser.id, memberships, onError, query, trip.user_id]);

  async function invitePerson(person) {
    setWorkingUserId(person.user_id);

    try {
      const { error: inviteError } = await supabase
        .from("trip_members")
        .upsert(
          {
            trip_id: trip.trip_id,
            user_id: person.user_id,
            invited_by: currentUser.id,
            status: "Pending",
            responded_at: null,
          },
          { onConflict: "trip_id,user_id" },
        );

      if (inviteError) throw inviteError;

      setQuery("");
      setResults([]);
      await loadMembers();
      await onChanged();
    } catch (inviteError) {
      onError(getErrorMessage(inviteError));
    } finally {
      setWorkingUserId(null);
    }
  }

  async function removeMembership(membership) {
    const confirmed = window.confirm(
      `Remove ${membership.person?.full_name || membership.person?.email || "this traveler"} from this trip?`,
    );

    if (!confirmed) return;
    setWorkingUserId(membership.user_id);

    try {
      const { error: removeError } = await supabase
        .from("trip_members")
        .delete()
        .eq("member_id", membership.member_id);

      if (removeError) throw removeError;
      await loadMembers();
      await onChanged();
    } catch (removeError) {
      onError(getErrorMessage(removeError));
    } finally {
      setWorkingUserId(null);
    }
  }

  return (
    <div className="trip-form-backdrop" onMouseDown={onClose}>
      <section
        className="trip-collaboration-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>TRIP COLLABORATION</span>
            <h2>Invite travelers</h2>
            <p>Search registered TRAVA users by their full name or email.</p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="trip-collaboration-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a traveler by name or email"
            autoFocus
          />
          {searching && <LoaderCircle className="spin" size={17} />}
        </div>

        {query.trim().length >= 2 && (
          <div className="trip-user-search-results">
            {results.length ? (
              results.map((person) => (
                <article key={person.user_id}>
                  <TripPersonAvatar person={person} />
                  <div>
                    <strong>{person.full_name || "TRAVA traveler"}</strong>
                    <span>{person.email}</span>
                  </div>
                  <button
                    type="button"
                    disabled={workingUserId === person.user_id}
                    onClick={() => invitePerson(person)}
                  >
                    {workingUserId === person.user_id ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <UserRoundPlus size={15} />
                    )}
                    Invite
                  </button>
                </article>
              ))
            ) : !searching ? (
              <p>No registered traveler matches this search.</p>
            ) : null}
          </div>
        )}

        <div className="trip-collaboration-members">
          <div className="trip-collaboration-section-title">
            <strong>Collaborators</strong>
            <span>{memberships.length}</span>
          </div>

          {loading ? (
            <div className="trip-collaboration-empty">
              <LoaderCircle className="spin" size={20} />
              Loading collaborators
            </div>
          ) : memberships.length ? (
            memberships.map((membership) => (
              <article key={membership.member_id}>
                <TripPersonAvatar person={membership.person} />
                <div>
                  <strong>
                    {membership.person?.full_name ||
                      membership.person?.email ||
                      "TRAVA traveler"}
                  </strong>
                  <span>{membership.person?.email}</span>
                </div>
                <em className={`status-${normalizeMembershipStatus(membership.status)}`}>
                  {normalizeMembershipStatus(membership.status) || "pending"}
                </em>
                <button
                  type="button"
                  disabled={workingUserId === membership.user_id}
                  onClick={() => removeMembership(membership)}
                  aria-label="Remove collaborator"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))
          ) : (
            <div className="trip-collaboration-empty">
              <UsersRound size={22} />
              No collaborators invited yet
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TripsError({ message, onDismiss }) {
  return (
    <div className="trips-floating-error">
      <span>{message}</span>

      <button type="button" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}

function TripsSkeleton() {
  return (
    <div className="trips-skeleton-list">
      {[1, 2, 3].map((item) => (
        <div className="trips-skeleton-card" key={item} />
      ))}
    </div>
  );
}