import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  ChevronRight,
  Heart,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plane,
  Search,
  Send,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { supabase } from "../auth/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import TravelGlobe from "../components/TravelGlobe";

import createTripAsset from "../assets/globe.png";
import destinationsAsset from "../assets/luggage.png";
import budgetAsset from "../assets/wallet.png";
import inviteAsset from "../assets/invite.png";

import "./home.css";

const QUICK_ACTIONS = [
  {
    key: "create-trip",
    title: "Create Trip",
    subtitle: "Plan your next adventure",
    image: createTripAsset,
  },
  {
    key: "destinations",
    title: "Explore Destinations",
    subtitle: "Find places you'll love",
    image: destinationsAsset,
  },
  {
    key: "budget",
    title: "Budget Planner",
    subtitle: "Plan smart, travel more",
    image: budgetAsset,
  },
  {
    key: "invite",
    title: "Invite Friends",
    subtitle: "Travel together",
    image: inviteAsset,
  },
];

const FAVORITES_STORAGE_KEY = "trava-listing-favorites";

function readFavorites() {
  try {
    const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(favorites),
    );
  } catch {
    // Favorites still work for the current session.
  }
}

function formatMoney(value, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatTripDate(startDate, endDate) {
  if (!startDate) return "Date not set";

  const start = new Date(`${startDate}T00:00:00`);
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null;

  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (!end) {
    return `${startText}, ${start.getFullYear()}`;
  }

  const endText = end.toLocaleDateString("en-US", {
    month: start.getMonth() === end.getMonth() ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startText} – ${endText}`;
}

function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
  );
}

function getUpcomingTrip(trips) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...trips]
    .filter((trip) => {
      if (!trip.start_date) return false;
      return new Date(`${trip.start_date}T00:00:00`) >= today;
    })
    .sort(
      (a, b) =>
        new Date(`${a.start_date}T00:00:00`) -
        new Date(`${b.start_date}T00:00:00`),
    )[0] || null;
}

function ActionImage({ action }) {
  return <img src={action.image} alt="" />;
}

export default function HomeScreen({
  onTrips,
  onCreateTrip,
  onBudget,
  onProfile,
  onInquire,
}) {
  const { user } = useAuth();

  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [flights, setFlights] = useState([]);
  const [tourPackages, setTourPackages] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [visitedCountries, setVisitedCountries] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [selectedListing, setSelectedListing] = useState(null);
  const [favorites, setFavorites] = useState(readFavorites);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      supabase.from("trips").select("*"),
      supabase.from("trip_members").select("*"),
      supabase.from("expense_tracking").select("*"),
      supabase.from("trip_flights").select("*"),
      supabase.from("tour_packages").select("*").eq("is_active", true),
      supabase.from("travel_agencies").select("*").eq("is_active", true),
    ]);

    const [tripResult, memberResult, expenseResult, flightResult, tourResult, agencyResult] =
      results;

    function rows(result) {
      if (result.status !== "fulfilled") return [];
      if (result.value.error) {
        console.warn(result.value.error);
        return [];
      }
      return result.value.data || [];
    }

    const tripRows = rows(tripResult);
    const memberRows = rows(memberResult);
    const expenseRows = rows(expenseResult);
    const flightRows = rows(flightResult);
    const tourRows = rows(tourResult);
    const agencyRows = rows(agencyResult);

    const hydratedFlights = flightRows.map((flight) => ({
      ...flight,
      origin: {
        code: flight.origin_code,
        city: flight.origin_city,
        country: flight.origin_country,
        lat: Number(flight.origin_lat),
        lng: Number(flight.origin_lng),
      },
      destination: {
        code: flight.destination_code,
        city: flight.destination_city,
        country: flight.destination_country,
        lat: Number(flight.destination_lat),
        lng: Number(flight.destination_lng),
      },
    }));

    setTrips(tripRows);
    setMembers(memberRows);
    setExpenses(expenseRows);
    setFlights(hydratedFlights);
    setTourPackages(tourRows);
    setAgencies(agencyRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  function getListingKey(type, item) {
    return type === "tour"
      ? `tour:${item.package_id}`
      : `agency:${item.agency_id}`;
  }

  function openListing(type, item) {
    const relatedAgency =
      type === "tour"
        ? agencies.find((agency) => agency.agency_id === item.agency_id) || null
        : null;

    setSelectedListing({
      type,
      item,
      agency: relatedAgency,
    });

    setFeedbackOpen(false);
    setFeedbackRating(5);
    setFeedbackComment("");
    setFeedbackStatus("");
  }

  function closeListing() {
    setSelectedListing(null);
    setFeedbackOpen(false);
    setFeedbackStatus("");
  }

  function toggleFavorite(type, item) {
    const key = getListingKey(type, item);

    setFavorites((current) =>
      current.includes(key)
        ? current.filter((favorite) => favorite !== key)
        : [...current, key],
    );
  }

  async function submitFeedback(event) {
    event.preventDefault();

    if (!selectedListing || !user?.id) return;

    setSavingFeedback(true);
    setFeedbackStatus("");

    const isTour = selectedListing.type === "tour";

    const { error: feedbackError } = await supabase
      .from("travel_listing_feedback")
      .insert({
        user_id: user.id,
        listing_type: selectedListing.type,
        package_id: isTour
          ? selectedListing.item.package_id
          : null,
        agency_id: isTour
          ? selectedListing.item.agency_id || null
          : selectedListing.item.agency_id,
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
      });

    if (feedbackError) {
      setFeedbackStatus(feedbackError.message);
      setSavingFeedback(false);
      return;
    }

    setFeedbackStatus("Thank you. Your feedback was submitted.");
    setFeedbackComment("");
    setSavingFeedback(false);
  }

  function beginInquiry() {
    if (!selectedListing) return;

    const inquiry = {
      type: selectedListing.type,
      item: selectedListing.item,
      agency: selectedListing.agency,
      createdAt: new Date().toISOString(),
    };

    try {
      window.sessionStorage.setItem(
        "travaPendingInquiry",
        JSON.stringify(inquiry),
      );
    } catch {
      // The chat redirect still works without session storage.
    }

    closeListing();
    onInquire?.(inquiry);
  }

  const upcomingTrip = useMemo(() => getUpcomingTrip(trips), [trips]);

  const upcomingMembers = useMemo(() => {
    if (!upcomingTrip) return [];

    return members.filter(
      (member) =>
        member.trip_id === upcomingTrip.trip_id &&
        ["accepted", "joined"].includes(
          String(member.status || "").toLowerCase(),
        ),
    );
  }, [members, upcomingTrip]);

  const upcomingSpent = useMemo(() => {
    if (!upcomingTrip) return 0;

    return expenses
      .filter(
        (expense) =>
          expense.trip_id === upcomingTrip.trip_id &&
          !expense.is_deleted,
      )
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [expenses, upcomingTrip]);

  const stats = useMemo(() => {
    const totalDistance = flights.reduce(
      (sum, flight) => sum + Number(flight.distance_km || 0),
      0,
    );

    const completedTrips = trips.filter((trip) => {
      if (!trip.end_date) return false;
      return new Date(`${trip.end_date}T23:59:59`) < new Date();
    });

    return {
      totalDistance,
      flights: flights.length,
      countries: new Set([
        ...visitedCountries.map((country) => country.name),
        ...flights.flatMap((flight) => [
          flight.origin?.country,
          flight.destination?.country,
        ]),
      ].filter(Boolean)).size,
      days: completedTrips.reduce(
        (sum, trip) => sum + daysBetween(trip.start_date, trip.end_date),
        0,
      ),
    };
  }, [flights, trips, visitedCountries]);

  const visibleTours = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tourPackages.filter((tour) => {
      if (!query) return true;

      return [
        tour.title,
        tour.destination,
        tour.country,
        tour.category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [tourPackages, search]);

  const visibleAgencies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return agencies.filter((agency) => {
      if (!query) return true;

      return [
        agency.name,
        agency.subtitle,
        agency.specialties,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [agencies, search]);

  function handleQuickAction(actionKey) {
    if (actionKey === "create-trip") {
      onCreateTrip?.();
      return;
    }

    if (actionKey === "destinations") {
      setSearch("");
      setView("tours");
      return;
    }

    if (actionKey === "budget") {
      onBudget?.();
      return;
    }

    if (actionKey === "invite") {
      setInviteOpen(true);
    }
  }

  async function sendInvite(event) {
    event.preventDefault();

    if (!upcomingTrip?.trip_id) {
      setInviteStatus("Create or select an upcoming trip first.");
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail) return;

    setInviteStatus("Sending...");

    const { data: invitedUser, error: userError } = await supabase
      .from("users")
      .select("user_id,email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (userError) {
      setInviteStatus(userError.message);
      return;
    }

    if (!invitedUser) {
      setInviteStatus("No TRAVA AI account uses that email yet.");
      return;
    }

    const { error: inviteError } = await supabase
      .from("trip_members")
      .upsert(
        {
          trip_id: upcomingTrip.trip_id,
          user_id: invitedUser.user_id,
          status: "pending",
        },
        {
          onConflict: "trip_id,user_id",
        },
      );

    if (inviteError) {
      setInviteStatus(inviteError.message);
      return;
    }

    setInviteStatus("Invitation sent.");
    setInviteEmail("");
    loadDashboard();
  }

  function switchView(nextView) {
    setSearch("");
    setView(nextView);
  }

  const totalBudget = Number(
    upcomingTrip?.total_budget ||
      upcomingTrip?.budget ||
      0,
  );

  const budgetProgress =
    totalBudget > 0
      ? Math.min(100, Math.round((upcomingSpent / totalBudget) * 100))
      : 0;

  const isDirectory = view === "tours" || view === "agencies";
  const isTours = view === "tours";

  return (
    <>
      {isDirectory ? (
        <div className="scroll-area trava-directory-screen">
          <header className="trava-directory-header">
            <button type="button" onClick={() => setView("dashboard")}>
              <ArrowLeft size={20} />
            </button>

            <div>
              <span>{isTours ? "TRAVEL DISCOVERY" : "TRUSTED PARTNERS"}</span>
              <h1>{isTours ? "Tour Packages" : "Travel Agencies"}</h1>
            </div>
          </header>

          <label className="trava-directory-search">
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isTours
                  ? "Search destination or tour style"
                  : "Search agency or specialty"
              }
            />
          </label>

          {isTours ? (
            <div className="trava-directory-tour-grid">
              {visibleTours.map((tour) => (
                <TourCard
                  key={tour.package_id}
                  tour={tour}
                  onOpen={() => openListing("tour", tour)}
                />
              ))}
            </div>
          ) : (
            <div className="trava-directory-agency-grid">
              {visibleAgencies.map((agency) => (
                <AgencyCard
                  key={agency.agency_id}
                  agency={agency}
                  onOpen={() => openListing("agency", agency)}
                />
              ))}
            </div>
          )}

          {!loading &&
            (isTours ? visibleTours.length === 0 : visibleAgencies.length === 0) && (
              <div className="trava-empty-content">
                <Search size={31} />
                <strong>No results found</strong>
                <span>Try another search term.</span>
              </div>
            )}
        </div>
      ) : (
        <div className="scroll-area trava-home-dashboard">
          <header className="trava-home-header">
            <div>
              <p>
                Hi,{" "}
                {user?.user_metadata?.full_name ||
                  user?.email?.split("@")[0] ||
                  "Explorer"}
                ! 👋
              </p>

              <h1>
                Where will TRAVA AI
                <br />
                take <em>you</em> next?
              </h1>
            </div>

            <button
              type="button"
              className="trava-notification-button"
              onClick={() => setNotificationsOpen((current) => !current)}
            >
              <Bell size={25} />
              <span />
            </button>

            {notificationsOpen && (
              <section className="trava-notification-popover">
                <header>
                  <strong>Notifications</strong>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <X size={17} />
                  </button>
                </header>

                {upcomingTrip ? (
                  <article>
                    <Sparkles size={18} />
                    <div>
                      <strong>{upcomingTrip.trip_name || "Upcoming trip"}</strong>
                      <span>
                        Starts {formatTripDate(upcomingTrip.start_date)}
                      </span>
                    </div>
                  </article>
                ) : (
                  <p>No new notifications.</p>
                )}
              </section>
            )}
          </header>

          {error && <div className="trava-home-error">{error}</div>}

          <section className="trava-footprint-card">
            <div className="trava-footprint-heading">
              <div className="trava-footprint-icon">🌿</div>

              <div>
                <h2>Travel Footprint</h2>
                <p>Your adventures around the world</p>
              </div>
            </div>

            <div className="trava-globe-stage">
              <TravelGlobe
                flights={flights}
                onVisitedCountriesChange={setVisitedCountries}
              />
            </div>

            <div className="trava-travel-stats">
              <article>
                <span>◉</span>
                <strong>{Math.round(stats.totalDistance).toLocaleString()} km</strong>
                <small>Total Miles</small>
              </article>

              <article>
                <Plane size={22} />
                <strong>{stats.flights}</strong>
                <small>Flights Taken</small>
              </article>

              <article>
                <MapPin size={22} />
                <strong>{stats.countries}</strong>
                <small>Countries</small>
              </article>

              <article>
                <CalendarDays size={22} />
                <strong>{stats.days}</strong>
                <small>Days Traveled</small>
              </article>
            </div>
          </section>

          <section className="trava-section-heading">
            <h2>Upcoming Trips</h2>

            <button type="button" onClick={onTrips}>
              View All <ChevronRight size={18} />
            </button>
          </section>

          {upcomingTrip ? (
            <button
              type="button"
              className="trava-upcoming-trip"
              onClick={onTrips}
            >
              <div
                className="trava-upcoming-photo"
                style={{
                  backgroundImage: `url(${
                    upcomingTrip.cover_image_url ||
                    upcomingTrip.image_url ||
                    ""
                  })`,
                }}
              >
                <div className="trava-upcoming-shade" />

                <div className="trava-upcoming-copy">
                  <h3>
                    {upcomingTrip.trip_name ||
                      upcomingTrip.destination ||
                      "Upcoming Trip"}
                  </h3>

                  <p>
                    <CalendarDays size={17} />
                    {formatTripDate(
                      upcomingTrip.start_date,
                      upcomingTrip.end_date,
                    )}
                  </p>

                  <div className="trava-member-stack">
                    {upcomingMembers.slice(0, 3).map((member, index) => (
                      <span key={member.member_id || `${member.user_id}-${index}`}>
                        {index === 0 ? "🧑🏻" : index === 1 ? "👩🏻" : "🧑🏽"}
                      </span>
                    ))}

                    {upcomingMembers.length > 3 && (
                      <span>+{upcomingMembers.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="trava-budget-strip">
                <div>
                  <span>Budget used</span>
                  <strong>
                    {formatMoney(
                      upcomingSpent,
                      upcomingTrip.currency_code || "PHP",
                    )}{" "}
                    /{" "}
                    {formatMoney(
                      totalBudget,
                      upcomingTrip.currency_code || "PHP",
                    )}
                  </strong>
                </div>

                <div className="trava-budget-progress">
                  <span style={{ width: `${budgetProgress}%` }} />
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="trava-no-upcoming-trip"
              onClick={onCreateTrip}
            >
              <CalendarDays size={30} />
              <strong>No upcoming trip yet</strong>
              <span>Create one to see it here automatically.</span>
            </button>
          )}

          <section className="trava-quick-actions">
            <h2>Quick Actions</h2>

            <div>
              {QUICK_ACTIONS.map((action) => (
                <button
                  type="button"
                  key={action.key}
                  onClick={() => handleQuickAction(action.key)}
                >
                  <ActionImage action={action} />
                  <strong>{action.title}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="trava-section-heading">
            <h2>Tour Packages for You</h2>

            <button type="button" onClick={() => switchView("tours")}>
              See All <ChevronRight size={18} />
            </button>
          </section>

          <div className="trava-tour-preview-grid">
            {tourPackages.slice(0, 3).map((tour) => (
              <TourCard
                key={tour.package_id}
                tour={tour}
                compact
                onOpen={() => openListing("tour", tour)}
              />
            ))}
          </div>

          {!loading && tourPackages.length === 0 && (
            <div className="trava-inline-empty">
              No tour packages are available yet.
            </div>
          )}

          <section className="trava-section-heading trava-agency-heading">
            <h2>Travel Agencies</h2>

            <button type="button" onClick={() => switchView("agencies")}>
              View All <ChevronRight size={18} />
            </button>
          </section>

          <div className="trava-agency-preview-grid">
            {agencies.slice(0, 3).map((agency) => (
              <AgencyCard
                key={agency.agency_id}
                agency={agency}
                compact
                onOpen={() => openListing("agency", agency)}
              />
            ))}
          </div>

          {loading && (
            <div className="trava-home-loading">
              <LoaderCircle className="spin" size={24} />
              Loading your travel dashboard...
            </div>
          )}
        </div>
      )}

      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          isFavorite={favorites.includes(
            getListingKey(
              selectedListing.type,
              selectedListing.item,
            ),
          )}
          feedbackOpen={feedbackOpen}
          feedbackRating={feedbackRating}
          feedbackComment={feedbackComment}
          feedbackStatus={feedbackStatus}
          savingFeedback={savingFeedback}
          onClose={closeListing}
          onToggleFavorite={() =>
            toggleFavorite(
              selectedListing.type,
              selectedListing.item,
            )
          }
          onToggleFeedback={() => {
            setFeedbackOpen((current) => !current);
            setFeedbackStatus("");
          }}
          onRatingChange={setFeedbackRating}
          onCommentChange={setFeedbackComment}
          onSubmitFeedback={submitFeedback}
          onInquire={beginInquiry}
          onOpenAgency={() => {
            if (selectedListing.agency) {
              openListing("agency", selectedListing.agency);
            }
          }}
        />
      )}

      {inviteOpen && (
        <div
          className="trava-modal-backdrop"
          onMouseDown={() => setInviteOpen(false)}
        >
          <form
            className="trava-invite-modal"
            onSubmit={sendInvite}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>TRIP INVITATION</span>
                <h2>Invite a friend</h2>
              </div>

              <button type="button" onClick={() => setInviteOpen(false)}>
                <X size={19} />
              </button>
            </header>

            <p>
              The invitation will be added to{" "}
              <strong>
                {upcomingTrip?.trip_name || "your upcoming trip"}
              </strong>
              .
            </p>

            <label>
              Friend's TRAVA AI email
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="friend@example.com"
              />
            </label>

            {inviteStatus && <div className="trava-invite-status">{inviteStatus}</div>}

            <footer>
              <button type="button" onClick={() => setInviteOpen(false)}>
                Cancel
              </button>

              <button type="submit">
                <Send size={17} />
                Send invite
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

function TourCard({ tour, compact = false, onOpen }) {
  return (
    <button
      type="button"
      className={`trava-tour-card ${compact ? "compact" : ""}`}
      onClick={onOpen}
      aria-label={`Open ${tour.title || "tour package"} details`}
    >
      <div className="trava-tour-image">
        {tour.image_url ? (
          <img src={tour.image_url} alt={tour.title || "Tour package"} />
        ) : (
          <div className="trava-tour-image-fallback">
            <MapPin size={26} />
          </div>
        )}
      </div>

      <div className="trava-tour-body">
        <h3>{tour.title}</h3>

        <p>
          {tour.duration_days || 0} Days
          {tour.duration_nights
            ? ` • ${tour.duration_nights} Nights`
            : ""}
        </p>

        <div>
          <strong>
            {formatMoney(
              tour.price,
              tour.currency_code || "PHP",
            )}
          </strong>

          <span className="trava-tour-open">
            Explore
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </button>
  );
}

function AgencyCard({ agency, compact = false, onOpen }) {
  return (
    <button
      type="button"
      className={`trava-agency-card ${compact ? "compact" : ""}`}
      onClick={onOpen}
      aria-label={`Open ${agency.name || "travel agency"} details`}
    >
      <div className="trava-agency-logo">
        {agency.logo_url ? (
          <img src={agency.logo_url} alt={agency.name || "Travel agency"} />
        ) : (
          <span>{agency.name?.slice(0, 1) || "A"}</span>
        )}
      </div>

      <div className="trava-agency-card-copy">
        <h3>{agency.name}</h3>
        <p>{agency.subtitle}</p>

        <div className="trava-agency-tags">
          {agency.badge && <span>{agency.badge}</span>}
          <span>
            {Number(agency.rating || 0).toFixed(1)} ★
          </span>
        </div>
      </div>

      <ChevronRight size={18} className="trava-agency-chevron" />
    </button>
  );
}

function ListingDetailModal({
  listing,
  isFavorite,
  feedbackOpen,
  feedbackRating,
  feedbackComment,
  feedbackStatus,
  savingFeedback,
  onClose,
  onToggleFavorite,
  onToggleFeedback,
  onRatingChange,
  onCommentChange,
  onSubmitFeedback,
  onInquire,
  onOpenAgency,
}) {
  const isTour = listing.type === "tour";
  const item = listing.item;
  const agency = isTour ? listing.agency : item;

  const heroImage = isTour ? item.image_url : null;
  const title = isTour ? item.title : item.name;
  const subtitle = isTour
    ? [
        item.destination,
        item.country,
      ]
        .filter(Boolean)
        .join(" • ")
    : item.subtitle;

  return (
    <div
      className="trava-listing-modal-backdrop"
      onMouseDown={onClose}
    >
      <section
        className="trava-listing-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={`trava-listing-hero ${
            isTour ? "tour" : "agency"
          }`}
          style={
            heroImage
              ? {
                  backgroundImage: `url(${heroImage})`,
                }
              : undefined
          }
        >
          <div className="trava-listing-hero-shade" />

          {!isTour && (
            <div className="trava-listing-agency-logo">
              {item.logo_url ? (
                <img src={item.logo_url} alt={item.name} />
              ) : (
                <span>{item.name?.slice(0, 1) || "A"}</span>
              )}
            </div>
          )}

          <button
            type="button"
            className="trava-listing-close"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={20} />
          </button>

          <button
            type="button"
            className={`trava-listing-heart ${
              isFavorite ? "active" : ""
            }`}
            onClick={onToggleFavorite}
            aria-label={
              isFavorite
                ? "Remove from favorites"
                : "Add to favorites"
            }
          >
            <Heart
              size={21}
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>

          <div className="trava-listing-hero-copy">
            <span>
              {isTour ? "TOUR PACKAGE" : "TRAVEL AGENCY"}
            </span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>

        <div className="trava-listing-content">
          {isTour ? (
            <>
              <div className="trava-listing-facts">
                <article>
                  <CalendarDays size={18} />
                  <strong>{item.duration_days || 0} days</strong>
                  <span>
                    {item.duration_nights || 0} nights
                  </span>
                </article>

                <article>
                  <MapPin size={18} />
                  <strong>{item.country || "Destination"}</strong>
                  <span>{item.category || "Tour"}</span>
                </article>

                <article>
                  <strong>
                    {formatMoney(
                      item.price,
                      item.currency_code || "PHP",
                    )}
                  </strong>
                  <span>Package price</span>
                </article>
              </div>

              {item.description && (
                <p className="trava-listing-description">
                  {item.description}
                </p>
              )}

              {agency && (
                <button
                  type="button"
                  className="trava-listing-provider"
                  onClick={onOpenAgency}
                >
                  <div className="trava-listing-provider-logo">
                    {agency.logo_url ? (
                      <img
                        src={agency.logo_url}
                        alt={agency.name}
                      />
                    ) : (
                      <span>
                        {agency.name?.slice(0, 1) || "A"}
                      </span>
                    )}
                  </div>

                  <div>
                    <span>Provided by</span>
                    <strong>{agency.name}</strong>
                  </div>

                  <ChevronRight size={18} />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="trava-listing-agency-summary">
                <div>
                  <Star size={19} fill="currentColor" />
                  <strong>
                    {Number(item.rating || 0).toFixed(1)}
                  </strong>
                  <span>Agency rating</span>
                </div>

                <div>
                  <strong>{item.badge || "Verified"}</strong>
                  <span>Agency status</span>
                </div>
              </div>

              {item.specialties && (
                <p className="trava-listing-description">
                  Specializes in {item.specialties}.
                </p>
              )}
            </>
          )}

          <div className="trava-listing-actions">
            <button
              type="button"
              onClick={onToggleFeedback}
            >
              <Star size={18} />
              Feedback
            </button>

            <button type="button" onClick={onInquire}>
              <MessageCircle size={18} />
              Inquire
            </button>
          </div>

          {feedbackOpen && (
            <form
              className="trava-feedback-form"
              onSubmit={onSubmitFeedback}
            >
              <header>
                <div>
                  <span>YOUR EXPERIENCE</span>
                  <h3>Send feedback</h3>
                </div>
              </header>

              <div className="trava-feedback-stars">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    type="button"
                    key={rating}
                    className={
                      rating <= feedbackRating ? "active" : ""
                    }
                    onClick={() => onRatingChange(rating)}
                    aria-label={`${rating} star rating`}
                  >
                    <Star
                      size={23}
                      fill={
                        rating <= feedbackRating
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={feedbackComment}
                onChange={(event) =>
                  onCommentChange(event.target.value)
                }
                placeholder="Share your thoughts..."
                maxLength={1000}
              />

              {feedbackStatus && (
                <div className="trava-feedback-status">
                  {feedbackStatus}
                </div>
              )}

              <button
                type="submit"
                disabled={savingFeedback}
              >
                {savingFeedback ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
                {savingFeedback
                  ? "Submitting..."
                  : "Submit feedback"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
