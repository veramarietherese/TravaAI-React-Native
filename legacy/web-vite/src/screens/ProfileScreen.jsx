import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Award,
  BatteryFull,
  Bell,
  BellRing,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Edit3,
  Flame,
  Globe2,
  Heart,
  LoaderCircle,
  LogOut,
  MapPin,
  MessageCircle,
  Plane,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Signal,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  WalletCards,
  Wifi,
  X,
} from "lucide-react";

import { supabase } from "../auth/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import PassportScreen from "./PassportScreen";

import passportVisual from "../assets/passport.png";
import streakMascot from "../assets/luggage-mascot.gif";

import "./profile.css";

const FAVORITES_STORAGE_KEY = "trava-listing-favorites";
const PROFILE_AVATAR_BUCKET = "profile-avatars";

const DEFAULT_PREFERENCES = {
  location: "",
  bio: "",
  travel_style: "Balanced",
  notification_enabled: true,
};

const TRAVEL_STYLES = [
  "Budget",
  "Balanced",
  "Luxury",
  "Adventure",
  "Food & Culture",
  "Relaxed",
];

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.error_description ||
    "Something went wrong. Please try again."
  );
}

function getUserName(user, profile) {
  return (
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Traveler"
  );
}

function getInitials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TR"
  );
}

function readFavorites() {
  try {
    const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFavorites(nextFavorites) {
  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(nextFavorites),
    );

    window.dispatchEvent(
      new CustomEvent("trava:favorites-changed", {
        detail: nextFavorites,
      }),
    );
  } catch {
    // Favorites still work for this session.
  }
}

function toLocalDateKey(date = new Date()) {
  const resolved = new Date(date);
  resolved.setHours(12, 0, 0, 0);
  return resolved.toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(12, 0, 0, 0);
  return next;
}

function getCurrentStreak(activityDates) {
  const keys = new Set(activityDates);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  let cursor = keys.has(toLocalDateKey(today))
    ? today
    : addDays(today, -1);

  let count = 0;

  while (keys.has(toLocalDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}

function getLongestStreak(activityDates) {
  const sorted = [...new Set(activityDates)]
    .sort()
    .map(parseDateKey);

  if (!sorted.length) return 0;

  let longest = 1;
  let current = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const difference = Math.round(
      (sorted[index] - sorted[index - 1]) / 86400000,
    );

    if (difference === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (difference > 1) {
      current = 1;
    }
  }

  return longest;
}

function buildLastFourteenDays(activityDates) {
  const keys = new Set(activityDates);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index - 13);
    const key = toLocalDateKey(date);

    return {
      key,
      day: date.getDate(),
      completed: keys.has(key),
      today: key === toLocalDateKey(today),
    };
  });
}

function countryFromDestination(destination = "") {
  const pieces = String(destination)
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);

  return pieces.length > 1 ? pieces.at(-1) : pieces[0] || "";
}

function cityFromDestination(destination = "") {
  return String(destination).split(",")[0]?.trim() || "";
}

function formatDate(value) {
  if (!value) return "Recently";

  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeListingType(value) {
  return value === "agency" ? "agency" : "tour";
}

function withTimeout(promise, timeoutMs = 8000, label = "Request") {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function IOSStatusBar() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="premium-profile-statusbar" aria-hidden="true">
      <strong>{time}</strong>
      <span>
        <Signal size={16} fill="currentColor" />
        <Wifi size={17} />
        <BatteryFull size={21} />
      </span>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}) {
  return (
    <div
      className="profile-modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        className={`profile-modal ${wide ? "wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            type="button"
            className="profile-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>

        <div className="profile-modal-content">{children}</div>
      </section>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, text }) {
  return (
    <div className="profile-empty-panel">
      <span>
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export default function ProfileScreen() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const authName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    userEmail.split("@")[0] ||
    "Traveler";
  const authAvatar = user?.user_metadata?.avatar_url || "";

  const [screen, setScreen] = useState("profile");
  const [modal, setModal] = useState(null);

  // The shell renders immediately from Auth metadata.
  // Supabase details synchronize in the background.
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [trips, setTrips] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activities, setActivities] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [packages, setPackages] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [favorites, setFavorites] = useState(readFavorites);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [settingsForm, setSettingsForm] = useState({
    full_name: "",
    location: "",
    bio: "",
    travel_style: "Balanced",
    notification_enabled: true,
    profile_picture_url: "",
  });

  const [reviewForm, setReviewForm] = useState({
    feedback_id: null,
    listing_type: "tour",
    package_id: "",
    agency_id: "",
    rating: 5,
    comment: "",
  });

  const avatarInputRef = useRef(null);
  const loadedUserRef = useRef(null);
  const profileRequestRef = useRef(0);
  const catalogLoadedRef = useRef(false);
  const catalogLoadingRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;

    setError("");

    // Show a usable profile immediately. Remote data only enriches it.
    const fallbackProfile = {
      user_id: userId,
      full_name: authName,
      email: userEmail,
      profile_picture_url: authAvatar || null,
    };

    setProfile((current) =>
      current?.user_id === userId ? current : fallbackProfile,
    );

    setSettingsForm((current) => ({
      ...current,
      full_name: current.full_name || authName,
      profile_picture_url:
        current.profile_picture_url || authAvatar,
    }));

    setLoading(false);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const queryEntries = [
      {
        label: "Profile",
        query: supabase
          .from("users")
          .select(
            "user_id,full_name,email,profile_picture_url,created_at",
          )
          .eq("user_id", userId)
          .maybeSingle(),
      },
      {
        label: "Preferences",
        query: supabase
          .from("user_profile_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      },
      {
        label: "Trips",
        query: supabase
          .from("trips")
          .select(
            "trip_id,trip_name,destination,start_date,end_date,cover_image_url,created_at",
          )
          .eq("user_id", userId)
          .order("start_date", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(250),
      },
      {
        label: "Passport photos",
        query: supabase
          .from("trip_album_photos")
          .select(
            "photo_id,trip_id,is_favorite,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(500),
      },
      {
        label: "Travel streak",
        query: supabase
          .from("travel_streak_activity")
          .select("*")
          .eq("user_id", userId)
          .gte(
            "activity_date",
            toLocalDateKey(ninetyDaysAgo),
          )
          .order("activity_date", { ascending: true }),
      },
      {
        label: "Reviews",
        query: supabase
          .from("travel_listing_feedback")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      },
    ];

    try {
      const results = await Promise.allSettled(
        queryEntries.map(({ query, label }) =>
          withTimeout(query, 8000, label),
        ),
      );

      if (profileRequestRef.current !== requestId) {
        return;
      }

      function valueAt(index, fallback) {
        const result = results[index];

        if (
          result.status !== "fulfilled" ||
          result.value?.error
        ) {
          const queryError =
            result.status === "fulfilled"
              ? result.value?.error
              : result.reason;

          console.warn(
            `${queryEntries[index].label} could not be loaded:`,
            queryError,
          );

          return fallback;
        }

        return result.value?.data ?? fallback;
      }

      const profileRow = valueAt(0, null);
      const preferenceRow = valueAt(1, null);

      const nextPreferences = {
        ...DEFAULT_PREFERENCES,
        ...(preferenceRow || {}),
      };

      // Never replace the Auth fallback with null.
      if (profileRow) {
        setProfile(profileRow);
      }

      setPreferences(nextPreferences);
      setTrips(valueAt(2, []));
      setPhotos(valueAt(3, []));
      setActivities(valueAt(4, []));
      setFeedback(valueAt(5, []));
      setFavorites(readFavorites());

      setSettingsForm({
        full_name: getUserName(
          user,
          profileRow || fallbackProfile,
        ),
        location: nextPreferences.location || "",
        bio: nextPreferences.bio || "",
        travel_style:
          nextPreferences.travel_style || "Balanced",
        notification_enabled:
          nextPreferences.notification_enabled !== false,
        profile_picture_url:
          profileRow?.profile_picture_url ||
          authAvatar ||
          "",
      });
    } catch (loadError) {
      console.error("Profile background sync failed:", loadError);

      if (profileRequestRef.current === requestId) {
        setError(
          "Your profile is available, but some details could not be synchronized.",
        );
      }
    } finally {
      if (profileRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [authAvatar, authName, user, userEmail, userId]);

  const loadCatalog = useCallback(async () => {
    if (
      catalogLoadedRef.current ||
      catalogLoadingRef.current
    ) {
      return;
    }

    catalogLoadingRef.current = true;
    setCatalogLoading(true);

    try {
      const results = await Promise.allSettled([
        withTimeout(
          supabase
            .from("tour_packages")
            .select(
              "package_id,agency_id,title,destination,country,cover_image_url,image_url",
            )
            .eq("is_active", true)
            .limit(100),
          8000,
          "Tour packages",
        ),
        withTimeout(
          supabase
            .from("travel_agencies")
            .select(
              "agency_id,name,subtitle,profile_picture_url",
            )
            .eq("is_active", true)
            .limit(100),
          8000,
          "Travel agencies",
        ),
      ]);

      const packageResult = results[0];
      const agencyResult = results[1];

      if (
        packageResult.status === "fulfilled" &&
        !packageResult.value?.error
      ) {
        setPackages(packageResult.value?.data || []);
      } else {
        console.warn(
          "Tour packages could not be loaded:",
          packageResult.status === "fulfilled"
            ? packageResult.value?.error
            : packageResult.reason,
        );
      }

      if (
        agencyResult.status === "fulfilled" &&
        !agencyResult.value?.error
      ) {
        setAgencies(agencyResult.value?.data || []);
      } else {
        console.warn(
          "Travel agencies could not be loaded:",
          agencyResult.status === "fulfilled"
            ? agencyResult.value?.error
            : agencyResult.reason,
        );
      }

      catalogLoadedRef.current =
        packageResult.status === "fulfilled" &&
        !packageResult.value?.error &&
        agencyResult.status === "fulfilled" &&
        !agencyResult.value?.error;
    } catch (catalogError) {
      console.error("Profile catalog load failed:", catalogError);
      setNotice(
        "Some packages or agencies could not be loaded.",
      );
    } finally {
      catalogLoadingRef.current = false;
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      loadedUserRef.current = null;
      catalogLoadedRef.current = false;
      setLoading(false);
      return;
    }

    if (loadedUserRef.current === userId) {
      return;
    }

    loadedUserRef.current = userId;
    catalogLoadedRef.current = false;

    void loadProfile();
  }, [authLoading, loadProfile, userId]);

  useEffect(() => {
    function handleFavoritesChanged(event) {
      setFavorites(
        Array.isArray(event.detail)
          ? event.detail
          : readFavorites(),
      );
    }

    window.addEventListener(
      "trava:favorites-changed",
      handleFavoritesChanged,
    );

    return () => {
      window.removeEventListener(
        "trava:favorites-changed",
        handleFavoritesChanged,
      );
    };
  }, []);

  const displayName = getUserName(user, profile);
  const activityDates = useMemo(
    () =>
      activities
        .map((item) => item.activity_date)
        .filter(Boolean),
    [activities],
  );

  const currentStreak = useMemo(
    () => getCurrentStreak(activityDates),
    [activityDates],
  );

  const longestStreak = useMemo(
    () => getLongestStreak(activityDates),
    [activityDates],
  );

  const monthlyActivityCount = useMemo(() => {
    const monthPrefix = toLocalDateKey(new Date()).slice(0, 7);

    return new Set(
      activityDates.filter((date) =>
        String(date).startsWith(monthPrefix),
      ),
    ).size;
  }, [activityDates]);

  const lastFourteenDays = useMemo(
    () => buildLastFourteenDays(activityDates),
    [activityDates],
  );

  const stats = useMemo(() => {
    const countries = new Set();
    const cities = new Set();

    trips.forEach((trip) => {
      const country = countryFromDestination(trip.destination);
      const city = cityFromDestination(trip.destination);
      if (country) countries.add(country.toLowerCase());
      if (city) cities.add(city.toLowerCase());
    });

    return {
      trips: trips.length,
      countries: countries.size,
      cities: cities.size,
      points:
        trips.length * 100 +
        photos.length * 20 +
        feedback.length * 25 +
        activities.length * 10,
    };
  }, [activities.length, feedback.length, photos.length, trips]);

  const favoriteListings = useMemo(() => {
    return favorites
      .map((key) => {
        const [type, id] = String(key).split(":");

        if (type === "tour") {
          const item = packages.find(
            (tour) => String(tour.package_id) === id,
          );

          return item
            ? {
                key,
                type,
                title: item.title,
                subtitle:
                  item.destination ||
                  item.country ||
                  "Tour package",
                image:
                  item.cover_image_url ||
                  item.image_url ||
                  "",
              }
            : null;
        }

        if (type === "agency") {
          const item = agencies.find(
            (agency) => String(agency.agency_id) === id,
          );

          return item
            ? {
                key,
                type,
                title: item.name,
                subtitle: item.subtitle || "Travel agency",
                image: item.profile_picture_url || "",
              }
            : null;
        }

        return null;
      })
      .filter(Boolean);
  }, [agencies, favorites, packages]);

  const reviewOptions = useMemo(() => {
    return reviewForm.listing_type === "agency"
      ? agencies.map((agency) => ({
          id: agency.agency_id,
          label: agency.name,
        }))
      : packages.map((tour) => ({
          id: tour.package_id,
          label:
            tour.title ||
            tour.destination ||
            "Tour package",
        }));
  }, [agencies, packages, reviewForm.listing_type]);

  function openSettings() {
    setNotice("");
    setModal("settings");
  }

  function openPassport() {
    setScreen("passport");
  }

  function openFavorites() {
    setNotice("");
    setModal("favorites");
    void loadCatalog();
  }

  function openReviews() {
    resetReviewForm();
    setModal("reviews");
    void loadCatalog();
  }

  function removeFavorite(key) {
    const next = favorites.filter((item) => item !== key);
    setFavorites(next);
    writeFavorites(next);
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!user?.id) return;

    const fullName = settingsForm.full_name.trim();

    if (!fullName) {
      setNotice("Enter your name.");
      return;
    }

    setSavingSettings(true);
    setNotice("");

    try {
      const userPayload = {
        user_id: user.id,
        email: user.email,
        full_name: fullName,
        profile_picture_url:
          settingsForm.profile_picture_url || null,
      };

      const preferencePayload = {
        user_id: user.id,
        location: settingsForm.location.trim() || null,
        bio: settingsForm.bio.trim() || null,
        travel_style: settingsForm.travel_style,
        notification_enabled:
          settingsForm.notification_enabled,
        updated_at: new Date().toISOString(),
      };

      const [userResult, preferenceResult, authResult] =
        await Promise.all([
          supabase
            .from("users")
            .upsert(userPayload, {
              onConflict: "user_id",
            })
            .select()
            .single(),
          supabase
            .from("user_profile_preferences")
            .upsert(preferencePayload, {
              onConflict: "user_id",
            })
            .select()
            .single(),
          supabase.auth.updateUser({
            data: {
              full_name: fullName,
              avatar_url:
                settingsForm.profile_picture_url || null,
            },
          }),
        ]);

      if (userResult.error) throw userResult.error;
      if (preferenceResult.error) {
        throw preferenceResult.error;
      }
      if (authResult.error) throw authResult.error;

      setProfile(userResult.data);
      setPreferences(preferenceResult.data);
      setNotice("Profile settings saved.");
    } catch (saveError) {
      setNotice(getErrorMessage(saveError));
    } finally {
      setSavingSettings(false);
    }
  }

  async function uploadAvatar(file) {
    if (!file || !user?.id) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice("Profile photos must be under 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    setNotice("");

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .upload(path, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .getPublicUrl(path);

      const publicUrl = data?.publicUrl;

      if (!publicUrl) {
        throw new Error(
          "The profile photo URL could not be created.",
        );
      }

      setSettingsForm((current) => ({
        ...current,
        profile_picture_url: publicUrl,
      }));

      setNotice(
        "Photo uploaded. Press Save changes to keep it.",
      );
    } catch (uploadError) {
      setNotice(getErrorMessage(uploadError));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function checkInToday() {
    if (!user?.id || checkingIn) return;

    setCheckingIn(true);
    setNotice("");

    try {
      const payload = {
        user_id: user.id,
        activity_date: toLocalDateKey(new Date()),
        activity_type: "daily_profile_check_in",
        points: 10,
      };

      const { data, error: checkInError } = await supabase
        .from("travel_streak_activity")
        .upsert(payload, {
          onConflict: "user_id,activity_date",
        })
        .select()
        .single();

      if (checkInError) throw checkInError;

      setActivities((current) => {
        const withoutToday = current.filter(
          (item) =>
            item.activity_date !== data.activity_date,
        );

        return [...withoutToday, data].sort((a, b) =>
          String(a.activity_date).localeCompare(
            String(b.activity_date),
          ),
        );
      });

      setNotice("Today’s travel streak is secured! 🔥");
    } catch (checkInError) {
      setNotice(getErrorMessage(checkInError));
    } finally {
      setCheckingIn(false);
    }
  }

  function resetReviewForm() {
    setReviewForm({
      feedback_id: null,
      listing_type: "tour",
      package_id: "",
      agency_id: "",
      rating: 5,
      comment: "",
    });
    setNotice("");
  }

  function editReview(review) {
    setReviewForm({
      feedback_id: review.feedback_id,
      listing_type: normalizeListingType(
        review.listing_type,
      ),
      package_id: review.package_id || "",
      agency_id: review.agency_id || "",
      rating: Number(review.rating || 5),
      comment: review.comment || "",
    });
    setNotice("");
  }

  async function saveReview(event) {
    event.preventDefault();

    if (!user?.id) return;

    const isAgency =
      reviewForm.listing_type === "agency";
    const selectedId = isAgency
      ? reviewForm.agency_id
      : reviewForm.package_id;

    if (!selectedId) {
      setNotice("Select what you are reviewing.");
      return;
    }

    if (!reviewForm.comment.trim()) {
      setNotice("Write a short review.");
      return;
    }

    setSavingReview(true);
    setNotice("");

    try {
      const payload = {
        user_id: user.id,
        listing_type: reviewForm.listing_type,
        package_id: isAgency
          ? null
          : reviewForm.package_id,
        agency_id: isAgency
          ? reviewForm.agency_id
          : packages.find(
              (item) =>
                String(item.package_id) ===
                String(reviewForm.package_id),
            )?.agency_id || null,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        updated_at: new Date().toISOString(),
      };

      const query = reviewForm.feedback_id
        ? supabase
            .from("travel_listing_feedback")
            .update(payload)
            .eq("feedback_id", reviewForm.feedback_id)
        : supabase
            .from("travel_listing_feedback")
            .insert(payload);

      const { data, error: reviewError } = await query
        .select()
        .single();

      if (reviewError) throw reviewError;

      setFeedback((current) => {
        const exists = current.some(
          (item) =>
            item.feedback_id === data.feedback_id,
        );

        return exists
          ? current.map((item) =>
              item.feedback_id === data.feedback_id
                ? data
                : item,
            )
          : [data, ...current];
      });

      resetReviewForm();
      setNotice("Your review was saved.");
    } catch (reviewError) {
      setNotice(getErrorMessage(reviewError));
    } finally {
      setSavingReview(false);
    }
  }

  async function deleteReview(review) {
    const confirmed = window.confirm(
      "Delete this review?",
    );

    if (!confirmed) return;

    const previous = feedback;
    setFeedback((current) =>
      current.filter(
        (item) =>
          item.feedback_id !== review.feedback_id,
      ),
    );

    const { error: deleteError } = await supabase
      .from("travel_listing_feedback")
      .delete()
      .eq("feedback_id", review.feedback_id);

    if (deleteError) {
      setFeedback(previous);
      setNotice(getErrorMessage(deleteError));
    }
  }

  function reviewTitle(review) {
    if (review.listing_type === "agency") {
      return (
        agencies.find(
          (item) =>
            String(item.agency_id) ===
            String(review.agency_id),
        )?.name || "Travel agency"
      );
    }

    return (
      packages.find(
        (item) =>
          String(item.package_id) ===
          String(review.package_id),
      )?.title || "Tour package"
    );
  }

  async function handleSignOut() {
    const confirmed = window.confirm(
      "Sign out of TRAVA AI?",
    );

    if (!confirmed) return;

    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setNotice(getErrorMessage(signOutError));
    }
  }

  if (screen === "passport") {
    return (
      <div className="profile-passport-wrapper">
        <button
          type="button"
          className="profile-passport-back"
          onClick={() => setScreen("profile")}
        >
          <ChevronLeft size={19} />
          Back to Profile
        </button>

        <PassportScreen />
      </div>
    );
  }

  const avatarUrl =
    profile?.profile_picture_url ||
    user?.user_metadata?.avatar_url ||
    "";

  const todayCheckedIn = activityDates.includes(
    toLocalDateKey(new Date()),
  );

  return (
    <div className="scroll-area premium-profile-screen">
      <IOSStatusBar />

      <header className="premium-profile-heading">
        <div>
          <h1>
            Profile <Sparkles size={22} />
          </h1>
          <p>Manage your travel world</p>
        </div>

        <div className="premium-profile-heading-actions">
          <button
            type="button"
            onClick={() => setModal("notifications")}
            aria-label="Notifications"
          >
            <Bell size={22} />
            <i />
          </button>

          <button
            type="button"
            onClick={openSettings}
            aria-label="Settings"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      {error && (
        <div className="premium-profile-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="premium-profile-loading">
          <LoaderCircle className="spin" size={27} />
          <span>Loading your travel profile…</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="premium-profile-identity-card"
            onClick={openSettings}
          >
            <div className="premium-profile-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} />
              ) : (
                <span>{getInitials(displayName)}</span>
              )}

              <i>
                <Edit3 size={14} />
              </i>
            </div>

            <div className="premium-profile-main-copy">
              <h2>{displayName}</h2>
              <p>{user?.email}</p>

              <span>
                <MapPin size={15} />
                {preferences.location ||
                  "Add your home city"}
              </span>

              <em>
                <Sparkles size={15} />
                TRAVA AI Premium
              </em>
            </div>

            <ChevronRight
              className="premium-profile-main-arrow"
              size={22}
            />

            <div className="premium-profile-stats">
              <article>
                <Plane size={22} />
                <strong>{stats.trips}</strong>
                <span>Trips</span>
              </article>

              <article>
                <Globe2 size={22} />
                <strong>{stats.countries}</strong>
                <span>Countries</span>
              </article>

              <article>
                <Building2 size={22} />
                <strong>{stats.cities}</strong>
                <span>Cities</span>
              </article>

              <article>
                <Award size={22} />
                <strong>
                  {stats.points.toLocaleString()}
                </strong>
                <span>Points</span>
              </article>
            </div>
          </button>

          <button
            type="button"
            className="passport-memories-card"
            onClick={openPassport}
          >
            <div className="passport-memories-copy">
              <h2>
                Passport
                <br />
                Memories <Sparkles size={20} />
              </h2>

              <p>
                Your journey, beautifully
                <br />
                collected.
              </p>

              <span>
                Open Passport
                <ChevronRight size={17} />
              </span>
            </div>

            <img
              src={passportVisual}
              alt="TRAVA AI travel passport with tickets and memories"
            />
          </button>

          <section className="travel-streak-card">
            <div className="travel-streak-copy">
              <span>
                Monthly Travel Streak <Flame size={16} />
              </span>

              <h2>{currentStreak}-day streak</h2>

              <p>
                {currentStreak
                  ? `You’ve explored ${monthlyActivityCount} ${
                      monthlyActivityCount === 1
                        ? "time"
                        : "times"
                    } this month. Keep it up!`
                  : "Check in today and begin your monthly travel streak."}
              </p>

              <button
                type="button"
                onClick={() => setModal("challenges")}
              >
                <Trophy size={16} />
                View Challenges
                <ChevronRight size={16} />
              </button>
            </div>

            <img
              className="travel-streak-mascot"
              src={streakMascot}
              alt="TRAVA AI travel mascot sitting on luggage"
            />

            <div
              className="travel-streak-ring"
              style={{
                "--streak-progress": `${Math.min(
                  100,
                  (monthlyActivityCount / 30) * 100,
                )}%`,
              }}
            >
              <span>
                <Flame size={17} fill="currentColor" />
                <strong>{currentStreak}</strong>
                <small>days</small>
              </span>
            </div>

            <div className="travel-streak-days">
              {lastFourteenDays.map((item) => (
                <div
                  key={item.key}
                  className={[
                    item.completed ? "completed" : "",
                    item.today ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <i>
                    {item.completed && <Check size={12} />}
                  </i>
                  <span>{item.day}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="premium-profile-menu">
            <button
              type="button"
              onClick={openSettings}
            >
              <span className="menu-icon blue">
                <Settings size={19} />
              </span>
              <strong>Settings</strong>
              <ChevronRight size={19} />
            </button>

            <button
              type="button"
              onClick={openFavorites}
            >
              <span className="menu-icon pink">
                <Heart size={19} />
              </span>
              <strong>Favorites</strong>
              <em>{favorites.length || ""}</em>
              <ChevronRight size={19} />
            </button>

            <button
              type="button"
              onClick={() => setModal("wallet")}
            >
              <span className="menu-icon purple">
                <WalletCards size={19} />
              </span>
              <strong>Payments & Wallet</strong>
              <small>Coming soon</small>
              <ChevronRight size={19} />
            </button>

            <button
              type="button"
              onClick={openReviews}
            >
              <span className="menu-icon orange">
                <Star size={19} />
              </span>
              <strong>Reviews</strong>
              <em>{feedback.length || ""}</em>
              <ChevronRight size={19} />
            </button>

            <button
              type="button"
              onClick={() => setModal("help")}
            >
              <span className="menu-icon teal">
                <CircleHelp size={19} />
              </span>
              <strong>Help & Support</strong>
              <ChevronRight size={19} />
            </button>
          </section>
        </>
      )}

      {modal === "settings" && (
        <ModalShell
          title="Profile Settings"
          subtitle="Update your account and travel preferences."
          onClose={() => {
            setModal(null);
            setNotice("");
          }}
        >
          <form
            className="profile-settings-form"
            onSubmit={saveSettings}
          >
            <div className="profile-avatar-editor">
              <div>
                {settingsForm.profile_picture_url ? (
                  <img
                    src={
                      settingsForm.profile_picture_url
                    }
                    alt={settingsForm.full_name}
                  />
                ) : (
                  <span>
                    {getInitials(
                      settingsForm.full_name,
                    )}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  avatarInputRef.current?.click()
                }
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <LoaderCircle
                    className="spin"
                    size={16}
                  />
                ) : (
                  <Camera size={16} />
                )}
                Change photo
              </button>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];
                  if (file) uploadAvatar(file);
                  event.target.value = "";
                }}
              />
            </div>

            <label>
              Full name
              <input
                required
                value={settingsForm.full_name}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Home city
              <input
                value={settingsForm.location}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Cebu City, Philippines"
              />
            </label>

            <label>
              Travel style
              <select
                value={settingsForm.travel_style}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    travel_style: event.target.value,
                  }))
                }
              >
                {TRAVEL_STYLES.map((style) => (
                  <option value={style} key={style}>
                    {style}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Short bio
              <textarea
                value={settingsForm.bio}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    bio: event.target.value,
                  }))
                }
                placeholder="Tell fellow travelers what you love exploring."
              />
            </label>

            <label className="profile-toggle-row">
              <span>
                <strong>Travel notifications</strong>
                <small>
                  Receive trip and passport reminders.
                </small>
              </span>

              <input
                type="checkbox"
                checked={
                  settingsForm.notification_enabled
                }
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    notification_enabled:
                      event.target.checked,
                  }))
                }
              />
            </label>

            {notice && (
              <div className="profile-inline-notice">
                {notice}
              </div>
            )}

            <footer>
              <button
                type="button"
                className="profile-signout-button"
                onClick={handleSignOut}
              >
                <LogOut size={17} />
                Sign out
              </button>

              <button
                type="submit"
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <LoaderCircle
                    className="spin"
                    size={17}
                  />
                ) : (
                  <Save size={17} />
                )}
                Save changes
              </button>
            </footer>
          </form>
        </ModalShell>
      )}

      {modal === "favorites" && (
        <ModalShell
          title="Favorites"
          subtitle="Packages and agencies you saved from Explore."
          onClose={() => setModal(null)}
          wide
        >
          {catalogLoading ? (
            <div className="premium-profile-loading">
              <LoaderCircle className="spin" size={23} />
              <span>Loading your saved travel items…</span>
            </div>
          ) : favoriteListings.length ? (
            <div className="profile-favorites-list">
              {favoriteListings.map((item) => (
                <article key={item.key}>
                  <div className="profile-favorite-thumb">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                      />
                    ) : (
                      <Heart size={22} />
                    )}
                  </div>

                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                    <small>
                      {item.type === "tour"
                        ? "Tour package"
                        : "Travel agency"}
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeFavorite(item.key)
                    }
                    aria-label={`Remove ${item.title} from favorites`}
                  >
                    <Heart
                      size={20}
                      fill="currentColor"
                    />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyPanel
              icon={Heart}
              title="No favorites yet"
              text="Tap the heart on a package or agency in Explore and it will appear here."
            />
          )}
        </ModalShell>
      )}

      {modal === "wallet" && (
        <ModalShell
          title="Payments & Wallet"
          subtitle="A secure travel wallet is being prepared."
          onClose={() => setModal(null)}
        >
          <div className="profile-coming-soon">
            <span>
              <WalletCards size={34} />
            </span>
            <h3>Coming soon</h3>
            <p>
              Future versions will support saved payment
              methods, trip balances, refunds, and agency
              payments.
            </p>

            <div>
              <ShieldCheck size={17} />
              No payment information is collected yet.
            </div>
          </div>
        </ModalShell>
      )}

      {modal === "reviews" && (
        <ModalShell
          title="Your Reviews"
          subtitle="Create, edit, and remove feedback for packages and agencies."
          onClose={() => {
            setModal(null);
            setNotice("");
          }}
          wide
        >
          <div className="profile-reviews-layout">
            <form
              className="profile-review-form"
              onSubmit={saveReview}
            >
              <label>
                Review type
                <select
                  value={reviewForm.listing_type}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      listing_type:
                        event.target.value,
                      package_id: "",
                      agency_id: "",
                    }))
                  }
                >
                  <option value="tour">
                    Tour package
                  </option>
                  <option value="agency">
                    Travel agency
                  </option>
                </select>
              </label>

              <label>
                Select listing
                <select
                  required
                  disabled={catalogLoading}
                  value={
                    reviewForm.listing_type ===
                    "agency"
                      ? reviewForm.agency_id
                      : reviewForm.package_id
                  }
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      [current.listing_type ===
                      "agency"
                        ? "agency_id"
                        : "package_id"]:
                        event.target.value,
                    }))
                  }
                >
                  <option value="">
                    {catalogLoading
                      ? "Loading listings…"
                      : "Choose one"}
                  </option>
                  {reviewOptions.map((option) => (
                    <option
                      value={option.id}
                      key={option.id}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset>
                <legend>Rating</legend>
                <div className="profile-star-picker">
                  {[1, 2, 3, 4, 5].map(
                    (rating) => (
                      <button
                        type="button"
                        key={rating}
                        className={
                          rating <= reviewForm.rating
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setReviewForm(
                            (current) => ({
                              ...current,
                              rating,
                            }),
                          )
                        }
                        aria-label={`${rating} stars`}
                      >
                        <Star
                          size={24}
                          fill="currentColor"
                        />
                      </button>
                    ),
                  )}
                </div>
              </fieldset>

              <label>
                Review
                <textarea
                  required
                  value={reviewForm.comment}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      comment: event.target.value,
                    }))
                  }
                  placeholder="Share what made the experience memorable."
                />
              </label>

              {notice && (
                <div className="profile-inline-notice">
                  {notice}
                </div>
              )}

              <div className="profile-review-actions">
                {reviewForm.feedback_id && (
                  <button
                    type="button"
                    onClick={resetReviewForm}
                  >
                    Cancel edit
                  </button>
                )}

                <button
                  type="submit"
                  disabled={savingReview}
                >
                  {savingReview ? (
                    <LoaderCircle
                      className="spin"
                      size={17}
                    />
                  ) : reviewForm.feedback_id ? (
                    <Save size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                  {reviewForm.feedback_id
                    ? "Save review"
                    : "Add review"}
                </button>
              </div>
            </form>

            <div className="profile-review-list">
              {feedback.length ? (
                feedback.map((review) => (
                  <article key={review.feedback_id}>
                    <header>
                      <div>
                        <strong>
                          {reviewTitle(review)}
                        </strong>
                        <span>
                          {formatDate(
                            review.created_at,
                          )}
                        </span>
                      </div>

                      <div className="profile-review-stars">
                        {Array.from(
                          { length: 5 },
                          (_, index) => (
                            <Star
                              key={index}
                              size={14}
                              fill={
                                index <
                                Number(
                                  review.rating || 0,
                                )
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          ),
                        )}
                      </div>
                    </header>

                    <p>{review.comment}</p>

                    <footer>
                      <button
                        type="button"
                        onClick={() =>
                          editReview(review)
                        }
                      >
                        <Edit3 size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteReview(review)
                        }
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </footer>
                  </article>
                ))
              ) : (
                <EmptyPanel
                  icon={MessageCircle}
                  title="No reviews yet"
                  text="Your submitted package and agency feedback will appear here."
                />
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {modal === "notifications" && (
        <ModalShell
          title="Notifications"
          subtitle="Travel updates collected for your account."
          onClose={() => setModal(null)}
        >
          <div className="profile-notification-list">
            <article>
              <span className="blue">
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>
                  {trips.length
                    ? `${trips.length} ${
                        trips.length === 1
                          ? "trip"
                          : "trips"
                      } in your planner`
                    : "Your planner is ready"}
                </strong>
                <p>
                  Open Trips to continue planning dates,
                  flights, budgets, and checklists.
                </p>
              </div>
            </article>

            <article>
              <span className="pink">
                <Heart size={19} />
              </span>
              <div>
                <strong>
                  {favorites.length} saved favorites
                </strong>
                <p>
                  Your liked packages and agencies are
                  available from this profile.
                </p>
              </div>
            </article>

            <article>
              <span className="orange">
                <Flame size={19} />
              </span>
              <div>
                <strong>
                  {todayCheckedIn
                    ? "Today’s streak is complete"
                    : "Your daily streak is waiting"}
                </strong>
                <p>
                  {todayCheckedIn
                    ? "Great job keeping your travel momentum."
                    : "Open Travel Streak and check in for today."}
                </p>
              </div>
            </article>
          </div>
        </ModalShell>
      )}

      {modal === "challenges" && (
        <ModalShell
          title="Monthly Travel Streak"
          subtitle="Build momentum throughout the current month."
          onClose={() => {
            setModal(null);
            setNotice("");
          }}
          wide
        >
          <div className="profile-challenge-summary">
            <article>
              <Flame size={23} />
              <strong>{currentStreak}</strong>
              <span>Current streak</span>
            </article>

            <article>
              <Trophy size={23} />
              <strong>{longestStreak}</strong>
              <span>Longest streak</span>
            </article>

            <article>
              <CalendarDays size={23} />
              <strong>{monthlyActivityCount}</strong>
              <span>Active days</span>
            </article>
          </div>

          <button
            type="button"
            className={`profile-checkin-button ${
              todayCheckedIn ? "complete" : ""
            }`}
            onClick={checkInToday}
            disabled={
              todayCheckedIn || checkingIn
            }
          >
            {checkingIn ? (
              <LoaderCircle
                className="spin"
                size={18}
              />
            ) : todayCheckedIn ? (
              <Check size={18} />
            ) : (
              <Flame size={18} />
            )}
            {todayCheckedIn
              ? "Checked in today"
              : "Check in for today"}
          </button>

          <div className="profile-month-grid">
            {Array.from(
              {
                length: new Date(
                  new Date().getFullYear(),
                  new Date().getMonth() + 1,
                  0,
                ).getDate(),
              },
              (_, index) => {
                const date = new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  index + 1,
                  12,
                );
                const key = toLocalDateKey(date);
                const completed =
                  activityDates.includes(key);
                const today =
                  key ===
                  toLocalDateKey(new Date());

                return (
                  <div
                    key={key}
                    className={[
                      completed
                        ? "completed"
                        : "",
                      today ? "today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span>{index + 1}</span>
                    {completed && (
                      <Check size={12} />
                    )}
                  </div>
                );
              },
            )}
          </div>

          {notice && (
            <div className="profile-inline-notice">
              {notice}
            </div>
          )}

          <div className="profile-challenge-milestones">
            <article>
              <Award size={21} />
              <div>
                <strong>7 days</strong>
                <span>Weekend Wanderer</span>
              </div>
            </article>

            <article>
              <Trophy size={21} />
              <div>
                <strong>14 days</strong>
                <span>City Explorer</span>
              </div>
            </article>

            <article>
              <Sparkles size={21} />
              <div>
                <strong>30 days</strong>
                <span>TRAVA Trailblazer</span>
              </div>
            </article>
          </div>
        </ModalShell>
      )}

      {modal === "help" && (
        <ModalShell
          title="Help & Support"
          subtitle="Quick answers and ways to reach the TRAVA team."
          onClose={() => setModal(null)}
        >
          <div className="profile-help-list">
            <details>
              <summary>
                How does Passport Memories work?
              </summary>
              <p>
                Each trip receives a shared album. You can
                upload memories, favorite photos, remove your
                uploads, and create a shareable collage.
              </p>
            </details>

            <details>
              <summary>
                How is the Travel Streak counted?
              </summary>
              <p>
                A daily check-in records one active travel day.
                Consecutive active dates increase your streak.
              </p>
            </details>

            <details>
              <summary>
                Where are my favorites stored?
              </summary>
              <p>
                Favorites use the same saved package and agency
                list as the Explore screen.
              </p>
            </details>

            <a href="mailto:support@trava.ai?subject=TRAVA%20AI%20Support">
              <BellRing size={18} />
              Contact support
            </a>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
