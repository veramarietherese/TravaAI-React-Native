import { useState } from "react"
import {
  ArrowLeft,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Filter,
  Heart,
  Home,
  MapPin,
  PieChart,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react"
import {
  discoverCategories,
  discoverPlaces,
  featuredDestinations,
  quickActions,
  trendingDeals,
  trip,
} from "./data/mockData"
import "./index.css"

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("home")

  const goToHome = () => setCurrentScreen("home")
  const goToDiscover = () => setCurrentScreen("discover")

  return (
    <main className="app-shell">
      <section className="phone">
        <StatusBar />

        {currentScreen === "discover" ? (
          <DiscoverScreen onBack={goToHome} />
        ) : (
          <HomeScreen onDiscover={goToDiscover} />
        )}

        <BottomNav
          currentScreen={currentScreen}
          onHome={goToHome}
          onDiscover={goToDiscover}
        />
      </section>
    </main>
  )
}

function StatusBar() {
  return (
    <div className="status-bar">
      <strong>9:41</strong>
      <div className="status-icons">
        <span className="signal">▮▮▮</span>
        <span>⌁</span>
        <span className="battery" />
      </div>
    </div>
  )
}

function HomeScreen({ onDiscover }) {
  const progress = Math.round((trip.spent / trip.budget) * 100)

  return (
    <div className="scroll-area">
      <header className="header">
        <div className="profile">
          <div className="profile-avatar">🧑🏻</div>
          <div>
            <p>Hey, Dhan! 👋</p>
            <h1>Where to next?</h1>
          </div>
        </div>

        <button className="bell-btn" aria-label="Notifications" type="button">
          <Bell size={30} strokeWidth={2.5} />
          <span />
        </button>
      </header>

      <section className="section-title">
        <h2>Upcoming Trips</h2>
        <button type="button">
          View All <ChevronRight size={24} />
        </button>
      </section>

      <article className="trip-card">
        <div className="trip-photo" style={{ backgroundImage: `url(${trip.image})` }}>
          <div className="trip-shade" />
          <div className="trip-info">
            <h3>{trip.title}</h3>
            <p>
              <CalendarDays size={24} />
              {trip.date}
            </p>

            <div className="people">
              {trip.people.map((person, index) => (
                <span key={`${person}-${index}`}>{person}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="budget-row">
          <div>
            <span>Budget used</span>
            <strong>
              ₱{trip.spent.toLocaleString()} / ₱{trip.budget.toLocaleString()}
            </strong>
          </div>

          <div className="progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </article>

      <section className="quick">
        <h2>Quick Actions</h2>

        <div className="quick-grid">
          {quickActions.map((action) => (
            <button
              type="button"
              className={`quick-card ${action.className}`}
              key={action.title}
              onClick={() => {
                if (action.title.includes("Explore")) onDiscover()
              }}
            >
              <img src={action.image} alt="" />
              <span>{action.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="discover">
        <div className="section-title discover-title">
          <h2>Discover</h2>
          <button type="button" onClick={onDiscover}>
            Search <ChevronRight size={24} />
          </button>
        </div>

        <div className="discover-grid">
          {discoverPlaces.map((place) => (
            <article className="place-card" key={place.city}>
              <img src={place.image} alt={place.city} />
              <button className="heart" type="button" aria-label={`Save ${place.city}`}>
                <Heart size={22} />
              </button>
              <div>
                <h3>{place.city}</h3>
                <p>{place.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function DiscoverScreen({ onBack }) {
  return (
    <div className="scroll-area discover-screen">
      <header className="discover-header">
        <button className="round-icon" onClick={onBack} aria-label="Go back" type="button">
          <ArrowLeft size={22} />
        </button>
        <h1>Discover</h1>
        <button className="round-icon" aria-label="Filters" type="button">
          <Filter size={21} />
        </button>
      </header>

      <section className="discover-search">
        <Search size={22} />
        <span>Where do you want to go?</span>
      </section>

      <section className="category-row">
        {discoverCategories.map((category) => (
          <button
            type="button"
            className={category.active ? "category-chip active" : "category-chip"}
            key={category.label}
          >
            <span>{category.icon}</span>
            {category.label}
          </button>
        ))}
      </section>

      <section className="section-title discover-section-title">
        <h2>Featured Destinations</h2>
        <button type="button">
          View All <ChevronRight size={22} />
        </button>
      </section>

      <section className="destination-grid">
        {featuredDestinations.map((destination) => (
          <article className="destination-card" key={destination.city}>
            <img src={destination.image} alt={`${destination.city}, ${destination.country}`} />
            <div className="destination-overlay" />
            <button className="destination-heart" type="button">
              <Heart size={18} />
            </button>
            <div className="destination-content">
              <h3>{destination.city}</h3>
              <p>
                <MapPin size={13} />
                {destination.country}
              </p>
              <span>{destination.price}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="section-title discover-section-title compact">
        <h2>Trending Deals</h2>
        <button type="button">
          See All <ChevronRight size={22} />
        </button>
      </section>

      <section className="deals-row">
        {trendingDeals.map((deal) => (
          <article className="deal-card" key={deal.title}>
            <div className="deal-icon">{deal.icon}</div>
            <div>
              <h3>{deal.title}</h3>
              <p>{deal.subtitle}</p>
            </div>
            <strong>{deal.price}</strong>
          </article>
        ))}
      </section>

      <section className="ai-trip-card">
        <div className="ai-copy">
          <span>
            <Sparkles size={16} /> Smart Match
          </span>
          <h2>Not sure where to go?</h2>
          <p>Answer 3 quick questions and we’ll suggest your perfect trip.</p>
          <button type="button">Find My Trip</button>
        </div>

        <div className="ai-visual">
          <img src="/src/assets/luggage.png" alt="" />
        </div>
      </section>
    </div>
  )
}

function BottomNav({ currentScreen, onHome, onDiscover }) {
  return (
    <nav className="bottom-nav">
      <button
        type="button"
        className={currentScreen === "home" ? "active" : ""}
        onClick={onHome}
      >
        <Home size={30} fill="currentColor" />
        <span>Home</span>
      </button>

      <button
        type="button"
        className={currentScreen === "discover" ? "active" : ""}
        onClick={onDiscover}
      >
        <Briefcase size={30} />
        <span>Trips</span>
      </button>

      <button type="button">
        <PieChart size={31} />
        <span>Budget</span>
      </button>

      <button type="button">
        <UserRound size={30} />
        <span>Profile</span>
      </button>
    </nav>
  )
}