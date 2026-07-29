import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Heart,
  Search,
  SlidersHorizontal,
  Star,
  UsersRound,
} from "lucide-react";

import "./explore.css";

const PACKAGES = [
  {
    id: "santorini",
    title: "Santorini, Greece",
    days: 5,
    nights: 4,
    price: 68900,
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=85&w=1200&auto=format&fit=crop",
    tag: "Romantic",
  },
  {
    id: "swiss",
    title: "Swiss Alps Adventure",
    days: 6,
    nights: 5,
    price: 89500,
    image:
      "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?q=85&w=1200&auto=format&fit=crop",
    tag: "Adventure",
  },
  {
    id: "bali",
    title: "Bali Escape",
    days: 4,
    nights: 3,
    price: 42300,
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=85&w=1200&auto=format&fit=crop",
    tag: "Beach",
  },
  {
    id: "japan",
    title: "Japan Sakura Escape",
    days: 7,
    nights: 6,
    price: 72450,
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=85&w=1200&auto=format&fit=crop",
    tag: "Culture",
  },
  {
    id: "seoul",
    title: "Seoul City Lights",
    days: 6,
    nights: 5,
    price: 51300,
    image:
      "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=85&w=1200&auto=format&fit=crop",
    tag: "City",
  },
  {
    id: "maldives",
    title: "Maldives Retreat",
    days: 5,
    nights: 4,
    price: 98300,
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=85&w=1200&auto=format&fit=crop",
    tag: "Luxury",
  },
];

const AGENCIES = [
  {
    id: "wanderlust",
    name: "Wanderlust Travels",
    subtitle: "Crafting unforgettable journeys",
    rating: 4.8,
    badge: "Trusted",
    logo: "✈️",
  },
  {
    id: "globetrotters",
    name: "GlobeTrotters",
    subtitle: "Explore more, worry less",
    rating: 4.9,
    badge: "Premium",
    logo: "🌴",
  },
  {
    id: "dreamescape",
    name: "Dream Escape",
    subtitle: "Your journey, our passion",
    rating: 4.7,
    badge: "Verified",
    logo: "⛰️",
  },
  {
    id: "tripandgo",
    name: "Trip & Go",
    subtitle: "Fast, friendly, and flexible",
    rating: 4.9,
    badge: "Fast Reply",
    logo: "🛫",
  },
];

export default function ExploreScreen({
  onBack,
  onOpenPackage,
  onOpenAgency,
  onNotifications,
}) {
  const [query, setQuery] = useState("");
  const [favoritePackages, setFavoritePackages] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Beach", "City", "Culture", "Adventure", "Luxury"];

  const visiblePackages = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return PACKAGES.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.title.toLowerCase().includes(normalized) ||
        item.tag.toLowerCase().includes(normalized);

      const matchesFilter =
        activeFilter === "All" || item.tag === activeFilter;

      return matchesQuery && matchesFilter;
    });
  }, [query, activeFilter]);

  function toggleFavorite(id) {
    setFavoritePackages((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <div className="scroll-area explore-exact-screen">
      <header className="explore-exact-header">
        <button
          type="button"
          className="explore-back-button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <span>DISCOVER MORE</span>
          <h1>Explore</h1>
        </div>

        <button
          type="button"
          className="explore-notification-button"
          onClick={onNotifications}
          aria-label="Notifications"
        >
          <Bell size={21} />
          <i />
        </button>
      </header>

      <section className="explore-search-panel">
        <div className="explore-search-copy">
          <span>Find your next escape</span>
          <h2>Where will TRAVA AI take you next?</h2>
          <p>Search curated tours and trusted agencies in one place.</p>
        </div>

        <label className="explore-search-box">
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search destinations or tour styles"
          />
          <button type="button" aria-label="Filters">
            <SlidersHorizontal size={18} />
          </button>
        </label>

        <div className="explore-filter-row">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter}
              className={activeFilter === filter ? "active" : ""}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="explore-section">
        <div className="explore-section-heading">
          <div>
            <span>CURATED FOR YOU</span>
            <h2>Tour Packages</h2>
          </div>

          <button type="button">
            Explore all
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="explore-package-grid">
          {visiblePackages.map((item) => {
            const favorite = favoritePackages.includes(item.id);

            return (
              <article className="explore-package-card" key={item.id}>
                <div className="explore-package-image">
                  <img src={item.image} alt={item.title} />

                  <span className="explore-package-tag">{item.tag}</span>

                  <button
                    type="button"
                    className={favorite ? "favorite" : ""}
                    onClick={() => toggleFavorite(item.id)}
                    aria-label="Save package"
                  >
                    <Heart
                      size={20}
                      fill={favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>

                <div className="explore-package-body">
                  <h3>{item.title}</h3>

                  <p>
                    {item.days} Days • {item.nights} Nights
                  </p>

                  <div>
                    <strong>
                      ₱{item.price.toLocaleString("en-PH")}
                    </strong>

                    <button
                      type="button"
                      onClick={() => onOpenPackage?.(item)}
                    >
                      Explore
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!visiblePackages.length && (
          <div className="explore-empty-state">
            <Search size={30} />
            <strong>No matching tours</strong>
            <span>Try another destination or travel style.</span>
          </div>
        )}
      </section>

      <section className="explore-section explore-agencies-section">
        <div className="explore-section-heading">
          <div>
            <span>TRUSTED PARTNERS</span>
            <h2>Travel Agencies</h2>
          </div>

          <button type="button">
            Explore all
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="explore-agency-grid">
          {AGENCIES.map((agency) => (
            <article className="explore-agency-card" key={agency.id}>
              <div className="explore-agency-logo">{agency.logo}</div>

              <div className="explore-agency-copy">
                <h3>{agency.name}</h3>
                <p>{agency.subtitle}</p>

                <div className="explore-agency-meta">
                  <span>{agency.badge}</span>

                  <span>
                    <Star size={14} fill="currentColor" />
                    {agency.rating}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenAgency?.(agency)}
                aria-label={`Open ${agency.name}`}
              >
                <ChevronRight size={18} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}