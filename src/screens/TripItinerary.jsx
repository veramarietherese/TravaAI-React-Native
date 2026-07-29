import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  Edit3,
  Expand,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"

import TripMap from "../components/TripMap"
import { geocodePlace, searchPlaces } from "../services/geocode"
import "./TripItinerary.css"

const assetLibrary = [
  { id: "plane", label: "Plane", emoji: "✈️", keywords: ["airport", "flight", "terminal", "departure", "arrival"] },
  { id: "tower", label: "Landmark", emoji: "🗼", keywords: ["tower", "landmark", "view", "observatory"] },
  { id: "hotel", label: "Hotel", emoji: "🏨", keywords: ["hotel", "hostel", "resort", "stay", "check-in"] },
  { id: "ramen", label: "Food", emoji: "🍜", keywords: ["food", "restaurant", "ramen", "dinner", "lunch", "cafe"] },
  { id: "temple", label: "Temple", emoji: "🏯", keywords: ["temple", "shrine", "castle", "heritage", "museum"] },
  { id: "train", label: "Train", emoji: "🚄", keywords: ["train", "station", "rail", "metro", "subway"] },
  { id: "shopping", label: "Shopping", emoji: "🛍️", keywords: ["mall", "market", "shopping", "store"] },
  { id: "cafe", label: "Cafe", emoji: "☕", keywords: ["coffee", "cafe", "breakfast"] },
]

const currencies = [
  { code: "USD", flag: "🇺🇸", symbol: "$" },
  { code: "PHP", flag: "🇵🇭", symbol: "₱" },
  { code: "JPY", flag: "🇯🇵", symbol: "¥" },
  { code: "EUR", flag: "🇪🇺", symbol: "€" },
]

const fallbackRates = {
  USD: 1,
  PHP: 58,
  JPY: 157,
  EUR: 0.92,
}

const emptyActivity = {
  time: "",
  title: "",
  place: "",
  note: "",
  city: "",
  country: "",
  lat: "",
  lng: "",
  asset: "tower",
  costUSD: "",
}

export function createPlaceholderItinerary() {
  return [
    {
      id: crypto.randomUUID(),
      day: 1,
      date: "Tue, Mar 10",
      activities: [
        {
          id: crypto.randomUUID(),
          time: "08:00 AM",
          title: "Departure from Cebu",
          place: "Mactan-Cebu International Airport",
          note: "CEB Terminal 2",
          city: "Cebu",
          country: "Philippines",
          lat: 10.3157,
          lng: 123.8854,
          asset: "plane",
          costUSD: 0,
        },
        {
          id: crypto.randomUUID(),
          time: "02:30 PM",
          title: "Arrival in Tokyo",
          place: "Narita International Airport",
          note: "NRT Terminal 1",
          city: "Narita",
          country: "Japan",
          lat: 35.772,
          lng: 140.3929,
          asset: "tower",
          costUSD: 0,
        },
        {
          id: crypto.randomUUID(),
          time: "05:00 PM",
          title: "Check-in at Hotel",
          place: "Shinjuku Granbell Hotel",
          note: "Shinjuku, Tokyo",
          city: "Tokyo",
          country: "Japan",
          lat: 35.6938,
          lng: 139.7034,
          asset: "hotel",
          costUSD: 85,
        },
        {
          id: crypto.randomUUID(),
          time: "07:30 PM",
          title: "Dinner",
          place: "Ichiran Ramen Shinjuku",
          note: "Shinjuku, Tokyo",
          city: "Tokyo",
          country: "Japan",
          lat: 35.6909,
          lng: 139.7003,
          asset: "ramen",
          costUSD: 18,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      day: 2,
      date: "Wed, Mar 11",
      activities: [
        {
          id: crypto.randomUUID(),
          time: "10:00 AM",
          title: "Explore Osaka Castle",
          place: "Osaka Castle",
          note: "Chuo Ward, Osaka",
          city: "Osaka",
          country: "Japan",
          lat: 34.6873,
          lng: 135.5262,
          asset: "temple",
          costUSD: 8,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      day: 3,
      date: "Thu, Mar 12",
      activities: [
        {
          id: crypto.randomUUID(),
          time: "09:30 AM",
          title: "Kyoto Temple Walk",
          place: "Fushimi Inari Shrine",
          note: "Kyoto, Japan",
          city: "Kyoto",
          country: "Japan",
          lat: 34.9671,
          lng: 135.7727,
          asset: "temple",
          costUSD: 0,
        },
      ],
    },
  ]
}

export default function TripItinerary({ itinerary, onChange, destination = "" }) {
  const safeItinerary = itinerary?.length ? itinerary : createPlaceholderItinerary()

  const [activeDay, setActiveDay] = useState(safeItinerary[0]?.id)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [selectedCurrency, setSelectedCurrency] = useState("USD")
  const [rates, setRates] = useState(fallbackRates)
  const [currencyOpen, setCurrencyOpen] = useState(false)

  useEffect(() => {
    async function loadRates() {
      try {
        const res = await fetch(
          "https://api.frankfurter.dev/v2/rates?base=USD&symbols=PHP,JPY,EUR",
        )
        const data = await res.json()

        setRates({
          USD: 1,
          PHP: data.rates?.PHP || fallbackRates.PHP,
          JPY: data.rates?.JPY || fallbackRates.JPY,
          EUR: data.rates?.EUR || fallbackRates.EUR,
        })
      } catch {
        setRates(fallbackRates)
      }
    }

    loadRates()
  }, [])

  const selectedDay = useMemo(() => {
    return safeItinerary.find((day) => day.id === activeDay) || safeItinerary[0]
  }, [safeItinerary, activeDay])

  const routeStops = useMemo(() => {
    return safeItinerary
      .flatMap((day) => day.activities)
      .filter((activity) => activity.lat && activity.lng)
      .map((activity) => ({
        ...activity,
        assetEmoji:
          assetLibrary.find((asset) => asset.id === activity.asset)?.emoji || "📍",
      }))
  }, [safeItinerary])

  function updateItinerary(next) {
    onChange?.(next)
  }

  function convertAmount(amountUSD) {
    const currency = currencies.find((item) => item.code === selectedCurrency)
    const amount = Number(amountUSD || 0) * (rates[selectedCurrency] || 1)

    if (!amount) return ""

    return `${currency.symbol}${amount.toLocaleString(undefined, {
      maximumFractionDigits: selectedCurrency === "JPY" ? 0 : 2,
    })}`
  }

  function openAddModal() {
    setEditingActivity(null)
    setModalOpen(true)
  }

  function openEditModal(activity) {
    setEditingActivity(activity)
    setModalOpen(true)
  }

  async function saveActivity(activityData) {
    let lat = activityData.lat ? Number(activityData.lat) : ""
    let lng = activityData.lng ? Number(activityData.lng) : ""

    if (!lat || !lng) {
      const geocoded = await geocodePlace(
        `${activityData.place || activityData.title}, ${activityData.city || ""}`,
      )

      if (geocoded) {
        lat = geocoded.lat
        lng = geocoded.lng
      }
    }

    const normalizedActivity = {
      ...activityData,
      lat,
      lng,
      costUSD: activityData.costUSD ? Number(activityData.costUSD) : 0,
    }

    const next = safeItinerary.map((day) => {
      if (day.id !== selectedDay.id) return day

      const exists = day.activities.some(
        (activity) => activity.id === normalizedActivity.id,
      )

      return {
        ...day,
        activities: exists
          ? day.activities.map((activity) =>
              activity.id === normalizedActivity.id
                ? normalizedActivity
                : activity,
            )
          : [
              ...day.activities,
              {
                ...normalizedActivity,
                id: crypto.randomUUID(),
              },
            ],
      }
    })

    updateItinerary(next)
    setModalOpen(false)
    setEditingActivity(null)
  }

  function deleteActivity(activityId) {
    const next = safeItinerary.map((day) => {
      if (day.id !== selectedDay.id) return day

      return {
        ...day,
        activities: day.activities.filter(
          (activity) => activity.id !== activityId,
        ),
      }
    })

    updateItinerary(next)
    setModalOpen(false)
    setEditingActivity(null)
  }

  function addDay() {
    const nextDayNumber = safeItinerary.length + 1

    const next = [
      ...safeItinerary,
      {
        id: crypto.randomUUID(),
        day: nextDayNumber,
        date: "New day",
        activities: [],
      },
    ]

    updateItinerary(next)
    setActiveDay(next[next.length - 1].id)
  }

  return (
    <section className="itinerary-tab">
      <div className="itinerary-card">
        <div className="itinerary-card-head">
          <h2>Itinerary</h2>

          <div className="itinerary-actions">
            <CurrencySelector
              selectedCurrency={selectedCurrency}
              currencyOpen={currencyOpen}
              setCurrencyOpen={setCurrencyOpen}
              setSelectedCurrency={setSelectedCurrency}
            />

            <button type="button" className="map-expand-btn">
              <Expand size={17} />
            </button>
          </div>
        </div>

        <div className="route-mini-map">
          <TripMap stops={routeStops} destination={destination} />
        </div>

        <div className="day-tabs">
          {safeItinerary.map((day) => (
            <button
              type="button"
              key={day.id}
              className={selectedDay.id === day.id ? "active" : ""}
              onClick={() => setActiveDay(day.id)}
            >
              Day {day.day}
            </button>
          ))}

          <button type="button" className="add-day-btn" onClick={addDay}>
            <Plus size={16} />
          </button>
        </div>

        <div className="day-title-row">
          <h3>
            Day {selectedDay.day} <span>– {selectedDay.date}</span>
          </h3>
        </div>

        {selectedDay.activities.length > 0 ? (
          <div className="activity-timeline">
            {selectedDay.activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                convertedCost={convertAmount(activity.costUSD)}
                onEdit={() => openEditModal(activity)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-itinerary">
            <span>✨</span>
            <h3>No activities yet</h3>
            <p>Add your first activity for Day {selectedDay.day}.</p>
          </div>
        )}

        <button type="button" className="add-activity-btn" onClick={openAddModal}>
          <Plus size={22} />
          Add Activity
        </button>
      </div>

      {modalOpen && (
        <ActivityModal
          activity={editingActivity}
          onClose={() => setModalOpen(false)}
          onSave={saveActivity}
          onDelete={deleteActivity}
        />
      )}
    </section>
  )
}

function CurrencySelector({
  selectedCurrency,
  currencyOpen,
  setCurrencyOpen,
  setSelectedCurrency,
}) {
  const current = currencies.find((currency) => currency.code === selectedCurrency)

  return (
    <div className="currency-selector">
      <button
        type="button"
        className="currency-pill"
        onClick={() => setCurrencyOpen((open) => !open)}
      >
        {current.flag} {current.code}
        <ChevronDown size={15} />
      </button>

      {currencyOpen && (
        <div className="currency-menu">
          {currencies.map((currency) => (
            <button
              type="button"
              key={currency.code}
              onClick={() => {
                setSelectedCurrency(currency.code)
                setCurrencyOpen(false)
              }}
            >
              <span>{currency.flag}</span>
              {currency.code}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityCard({ activity, convertedCost, onEdit }) {
  return (
    <article className="activity-row">
      <div className="activity-time">
        <strong>{activity.time || "--:--"}</strong>
      </div>

      <div className="timeline-node">
        <span />
      </div>

      <button type="button" className="activity-card" onClick={onEdit}>
        <AssetIcon asset={activity.asset} />

        <div className="activity-copy">
          <div>
            <h4>{activity.title || "Untitled Activity"}</h4>
            {convertedCost && <em>{convertedCost}</em>}
          </div>

          <p>{activity.place || "No location yet"}</p>
          <span>{activity.note || activity.city || "Tap to edit details"}</span>
        </div>

        <Edit3 size={16} />
      </button>
    </article>
  )
}

function ActivityModal({ activity, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(activity || emptyActivity)
  const [placeQuery, setPlaceQuery] = useState(activity?.place || "")
  const [placeResults, setPlaceResults] = useState([])
  const [placeLoading, setPlaceLoading] = useState(false)
  const [searchTouched, setSearchTouched] = useState(false)

  useEffect(() => {
    if (!searchTouched) return

    const query = placeQuery.trim()

    if (query.length < 3) {
      setPlaceResults([])
      setPlaceLoading(false)
      return
    }

    const timeout = setTimeout(async () => {
      setPlaceLoading(true)

      try {
        const results = await searchPlaces(query)
        setPlaceResults(results)
      } catch {
        setPlaceResults([])
      } finally {
        setPlaceLoading(false)
      }
    }, 350)

    return () => clearTimeout(timeout)
  }, [placeQuery, searchTouched])

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function inferAssetFromText(text) {
    const clean = text.toLowerCase()

    const matched = assetLibrary.find((asset) =>
      asset.keywords.some((keyword) => clean.includes(keyword)),
    )

    return matched?.id || form.asset || "tower"
  }

  function handlePlaceInput(value) {
    setSearchTouched(true)
    setPlaceQuery(value)

    setForm((current) => ({
      ...current,
      place: value,
      note: "",
      city: "",
      country: "",
      lat: "",
      lng: "",
    }))
  }

  function selectPlace(place) {
    const guessedAsset = inferAssetFromText(
      `${place.name} ${place.displayName} ${form.title}`,
    )

    setForm((current) => ({
      ...current,
      place: place.name,
      note: place.displayName,
      city: place.city || place.country || "",
      country: place.country || "",
      lat: place.lat,
      lng: place.lng,
      asset: guessedAsset,
    }))

    setPlaceQuery(place.name)
    setPlaceResults([])
    setSearchTouched(false)
  }

  function submitForm(event) {
    event.preventDefault()

    onSave({
      ...form,
      id: activity?.id,
    })
  }

  return (
    <div className="activity-modal-backdrop">
      <form className="activity-modal premium-location-modal" onSubmit={submitForm}>
        <div className="modal-head">
          <div>
            <h2>{activity ? "Edit Activity" : "Add Activity"}</h2>
            <p>Search a location instead of typing coordinates.</p>
          </div>

          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-scroll-body">
          <div className="form-grid two">
            <label>
              Time
              <input
                value={form.time}
                onChange={(event) => updateField("time", event.target.value)}
                placeholder="08:00 AM"
              />
            </label>

            <label>
              Cost in USD
              <input
                type="number"
                min="0"
                value={form.costUSD}
                onChange={(event) => updateField("costUSD", event.target.value)}
                placeholder="25"
              />
            </label>
          </div>

          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Arrival, Dinner, Hotel Check-in..."
              required
            />
          </label>

          <label className="place-search-field">
            Location
            <div className="location-search-shell">
              <Search size={17} />
              <input
                value={placeQuery}
                onChange={(event) => handlePlaceInput(event.target.value)}
                placeholder="Search any city, airport, hotel, attraction or restaurant..."
                autoComplete="off"
              />
            </div>

            {placeLoading && (
              <small className="place-loading">Searching locations...</small>
            )}

            {placeResults.length > 0 && (
              <div className="place-results">
                {placeResults.map((place) => (
                  <button
                    type="button"
                    key={place.id}
                    onClick={() => selectPlace(place)}
                  >
                    <MapPin size={16} />
                    <span>
                      <strong>{place.name}</strong>
                      <em>{place.displayName}</em>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </label>

          {(form.place || form.city || form.lat || form.lng) && (
            <div className="selected-location-card">
              <MapPin size={18} />
              <div>
                <strong>{form.place || "Selected location"}</strong>
                <span>{form.city || form.country || "Location saved"}</span>
                {form.lat && form.lng && (
                  <small>
                    {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}
                  </small>
                )}
              </div>
            </div>
          )}

          <label>
            Note
            <input
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="Terminal, reservation note, address, reminder..."
            />
          </label>

          <div className="asset-picker">
            <p>3D Asset</p>

            <div>
              {assetLibrary.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className={form.asset === asset.id ? "active" : ""}
                  onClick={() => updateField("asset", asset.id)}
                >
                  <span>{asset.emoji}</span>
                  {asset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          {activity && (
            <button
              type="button"
              className="delete-btn"
              onClick={() => onDelete(activity.id)}
            >
              <Trash2 size={17} />
              Delete
            </button>
          )}

          <button type="submit" className="save-btn">
            <Save size={17} />
            Save Activity
          </button>
        </div>
      </form>
    </div>
  )
}

function AssetIcon({ asset }) {
  const found = assetLibrary.find((item) => item.id === asset) || assetLibrary[0]

  return (
    <div className={`asset-icon asset-${found.id}`}>
      <span>{found.emoji}</span>
    </div>
  )
}