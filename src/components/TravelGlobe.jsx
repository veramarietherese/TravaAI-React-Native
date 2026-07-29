import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";
import { geoCentroid } from "d3-geo";
import {
  Check,
  Expand,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import world from "../data/countries-110m.json";
import "./travel-globe-purple.css";

const VISITED_COUNTRIES_KEY = "trava-visited-countries-v2";

const ROUTE_COLORS = [
  "#ffffff",
  "#ffd6f1",
  "#d5d0ff",
  "#c4f1ff",
  "#f7e3ff",
];

const DEFAULT_VIEW = {
  lat: 18,
  lng: 20,
  altitude: 2.14,
};

function readVisitedCountries() {
  try {
    const value = window.localStorage.getItem(VISITED_COUNTRIES_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function saveVisitedCountries(countries) {
  try {
    window.localStorage.setItem(
      VISITED_COUNTRIES_KEY,
      JSON.stringify(countries),
    );
  } catch {
    // The globe remains usable when browser storage is unavailable.
  }
}

function getCountryName(country) {
  return (
    country?.properties?.name ||
    country?.properties?.NAME ||
    country?.properties?.admin ||
    country?.id ||
    "Unknown country"
  );
}

function createCountryId(country) {
  return String(
    country?.id ||
      getCountryName(country)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
  );
}

function createGlobeTexture() {
  if (typeof document === "undefined") return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;

  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  gradient.addColorStop(0, "#b9bcff");
  gradient.addColorStop(0.32, "#8f8af8");
  gradient.addColorStop(0.68, "#7169ed");
  gradient.addColorStop(1, "#a7afff");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const highlight = context.createRadialGradient(
    canvas.width * 0.28,
    canvas.height * 0.22,
    10,
    canvas.width * 0.28,
    canvas.height * 0.22,
    canvas.width * 0.7,
  );

  highlight.addColorStop(0, "rgba(255,255,255,0.32)");
  highlight.addColorStop(0.38, "rgba(255,255,255,0.08)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = highlight;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255,255,255,0.18)";

  for (let y = 4; y < canvas.height; y += 8) {
    for (let x = 4; x < canvas.width; x += 8) {
      const offset = (y / 8) % 2 === 0 ? 0 : 4;
      context.beginPath();
      context.arc(x + offset, y, 1.15, 0, Math.PI * 2);
      context.fill();
    }
  }

  return canvas.toDataURL("image/png");
}

function normalizeFlight(flight, index) {
  const origin = flight?.origin;
  const destination = flight?.destination;

  if (!origin || !destination) return null;

  const values = [
    Number(origin.lat),
    Number(origin.lng),
    Number(destination.lat),
    Number(destination.lng),
  ];

  if (!values.every(Number.isFinite)) return null;

  return {
    id:
      flight.flight_id ||
      flight.id ||
      `flight-${index}-${origin.code || "origin"}-${destination.code || "destination"}`,
    type: "flight",
    startLat: Number(origin.lat),
    startLng: Number(origin.lng),
    endLat: Number(destination.lat),
    endLng: Number(destination.lng),
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
  };
}

export default function TravelGlobe({
  flights = [],
  onVisitedCountriesChange,
}) {
  const wrapRef = useRef(null);
  const globeRef = useRef(null);

  const [countries, setCountries] = useState([]);
  const [size, setSize] = useState({
    width: 720,
    height: 440,
  });

  const [visitedCountries, setVisitedCountries] = useState(
    readVisitedCountries,
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [altitude, setAltitude] = useState(DEFAULT_VIEW.altitude);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const globeTexture = useMemo(createGlobeTexture, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(entry.contentRect.width || 720, 320);
      const height = Math.max(entry.contentRect.height || 440, 320);

      setSize({
        width,
        height,
      });
    });

    if (wrapRef.current) observer.observe(wrapRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const countryFeatures = feature(
      world,
      world.objects.countries,
    ).features;

    const normalizedCountries = countryFeatures
      .map((country) => {
        const [lng, lat] = geoCentroid(country);

        return {
          id: createCountryId(country),
          name: getCountryName(country),
          lat,
          lng,
          geometry: country,
        };
      })
      .filter(
        (country) =>
          Number.isFinite(country.lat) &&
          Number.isFinite(country.lng),
      )
      .sort((first, second) =>
        first.name.localeCompare(second.name),
      );

    setCountries(normalizedCountries);
  }, []);

  useEffect(() => {
    saveVisitedCountries(visitedCountries);
    onVisitedCountriesChange?.(visitedCountries);
  }, [visitedCountries, onVisitedCountriesChange]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange,
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    const controls = globeRef.current?.controls?.();

    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.26;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 155;
      controls.maxDistance = 620;
      controls.dampingFactor = 0.08;
    }

    globeRef.current?.pointOfView(
      {
        lat: DEFAULT_VIEW.lat,
        lng: DEFAULT_VIEW.lng,
        altitude,
      },
      550,
    );
  }, [altitude, size, isFullscreen]);

  const visitedCountryMap = useMemo(
    () =>
      new Map(
        visitedCountries.map((country) => [
          country.countryId,
          country,
        ]),
      ),
    [visitedCountries],
  );

  const filteredCountries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) return countries;

    return countries.filter((country) =>
      country.name.toLowerCase().includes(normalizedQuery),
    );
  }, [countries, searchQuery]);

  const flightArcs = useMemo(
    () =>
      flights
        .map(normalizeFlight)
        .filter(Boolean),
    [flights],
  );

  const visitedArcs = useMemo(() => {
    if (visitedCountries.length < 2) return [];

    return visitedCountries.slice(1).map((country, index) => {
      const previousCountry = visitedCountries[index];

      return {
        id: `visited-${previousCountry.countryId}-${country.countryId}`,
        type: "visited",
        startLat: previousCountry.lat,
        startLng: previousCountry.lng,
        endLat: country.lat,
        endLng: country.lng,
        color: ROUTE_COLORS[(index + 1) % ROUTE_COLORS.length],
      };
    });
  }, [visitedCountries]);

  const arcs = useMemo(
    () => [...flightArcs, ...visitedArcs],
    [flightArcs, visitedArcs],
  );

  const routePoints = useMemo(() => {
    const airportMap = new Map();

    flights.forEach((flight) => {
      if (flight?.origin?.code) {
        airportMap.set(flight.origin.code, {
          ...flight.origin,
          markerType: "airport",
        });
      }

      if (flight?.destination?.code) {
        airportMap.set(flight.destination.code, {
          ...flight.destination,
          markerType: "airport",
        });
      }
    });

    const airports = [...airportMap.values()]
      .filter((point) =>
        [Number(point.lat), Number(point.lng)].every(Number.isFinite),
      )
      .map((point, index) => ({
        ...point,
        markerId: `airport-${point.code || index}`,
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        label: `${point.city || point.code || "Airport"}${
          point.country ? `, ${point.country}` : ""
        }`,
      }));

    const visited = visitedCountries.map((country, index) => ({
      ...country,
      markerType: "visited",
      markerId: `visited-${country.countryId}`,
      color: ROUTE_COLORS[(index + 2) % ROUTE_COLORS.length],
      label: country.name,
    }));

    return [...airports, ...visited];
  }, [flights, visitedCountries]);

  function setGlobeView({
    lat = DEFAULT_VIEW.lat,
    lng = DEFAULT_VIEW.lng,
    nextAltitude = altitude,
    duration = 600,
  } = {}) {
    setAltitude(nextAltitude);

    globeRef.current?.pointOfView(
      {
        lat,
        lng,
        altitude: nextAltitude,
      },
      duration,
    );
  }

  function zoomIn() {
    setGlobeView({
      nextAltitude: Math.max(0.9, altitude - 0.18),
      duration: 300,
    });
  }

  function zoomOut() {
    setGlobeView({
      nextAltitude: Math.min(2.65, altitude + 0.18),
      duration: 300,
    });
  }

  function resetView() {
    setGlobeView({
      lat: DEFAULT_VIEW.lat,
      lng: DEFAULT_VIEW.lng,
      nextAltitude: DEFAULT_VIEW.altitude,
      duration: 700,
    });
  }

  async function toggleFullscreen() {
    if (!wrapRef.current) return;

    try {
      if (document.fullscreenElement === wrapRef.current) {
        await document.exitFullscreen();
      } else {
        await wrapRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen is unavailable:", error);
    }
  }

  function focusCountry(country) {
    setGlobeView({
      lat: country.lat,
      lng: country.lng,
      nextAltitude: 1.2,
      duration: 800,
    });
  }

  function chooseCountry(country) {
    setSelectedCountryId(country.id);
    setSearchQuery(country.name);
  }

  function addSelectedCountry() {
    const selectedCountry = countries.find(
      (country) => country.id === selectedCountryId,
    );

    if (!selectedCountry) return;

    setVisitedCountries((current) => {
      if (
        current.some(
          (country) =>
            country.countryId === selectedCountry.id,
        )
      ) {
        return current;
      }

      return [
        ...current,
        {
          countryId: selectedCountry.id,
          name: selectedCountry.name,
          lat: selectedCountry.lat,
          lng: selectedCountry.lng,
          visitedAt: new Date().toISOString(),
        },
      ];
    });

    focusCountry(selectedCountry);
    setSelectedCountryId("");
    setSearchQuery("");
    setPickerOpen(false);
  }

  function removeVisitedCountry(countryId) {
    setVisitedCountries((current) =>
      current.filter(
        (country) => country.countryId !== countryId,
      ),
    );
  }

  function handleSearchKeyDown(event) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const firstAvailableCountry = filteredCountries.find(
      (country) => !visitedCountryMap.has(country.id),
    );

    if (firstAvailableCountry) {
      chooseCountry(firstAvailableCountry);
    }
  }

  function createMarkerElement(point) {
    const element = document.createElement("button");
    element.type = "button";
    element.className =
      point.markerType === "visited"
        ? "trava-globe-pin"
        : "trava-globe-airport-dot";

    element.setAttribute("aria-label", point.label || "Travel location");
    element.title = point.label || "Travel location";

    if (point.markerType === "visited") {
      const markerCore = document.createElement("span");
      markerCore.className = "trava-globe-pin-core";
      element.appendChild(markerCore);

      element.addEventListener("click", () => focusCountry(point));
    }

    return element;
  }

  return (
    <div
      className={`premium-globe-wrap ${
        isFullscreen ? "is-fullscreen" : ""
      }`}
      ref={wrapRef}
    >
      <div className="premium-globe-background-stars" />
      <div className="premium-globe-glow" />
      <div className="premium-globe-platform" />

      <button
        type="button"
        className="globe-add-country-button"
        onClick={() => setPickerOpen(true)}
      >
        <Plus size={15} />
        Add country
      </button>

      <div className="globe-control-stack">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={19} />
        </button>

        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={19} />
        </button>

        <button
          type="button"
          onClick={resetView}
          aria-label="Reset globe view"
          title="Reset view"
        >
          <Maximize2 size={17} />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={
            isFullscreen
              ? "Exit fullscreen globe"
              : "Open fullscreen globe"
          }
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <X size={18} /> : <Expand size={18} />}
        </button>
      </div>

      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={globeTexture}
        bumpImageUrl={null}
        showAtmosphere
        atmosphereColor="#ffffff"
        atmosphereAltitude={0.16}
        polygonsData={countries.map(
          (country) => country.geometry,
        )}
        polygonCapColor={(polygon) =>
          visitedCountryMap.has(createCountryId(polygon))
            ? "rgba(255,255,255,0.98)"
            : "rgba(255,255,255,0.90)"
        }
        polygonSideColor={() => "rgba(255,255,255,0.03)"}
        polygonStrokeColor={(polygon) =>
          visitedCountryMap.has(createCountryId(polygon))
            ? "rgba(127,103,245,0.78)"
            : "rgba(120,105,226,0.18)"
        }
        polygonAltitude={(polygon) =>
          visitedCountryMap.has(createCountryId(polygon))
            ? 0.012
            : 0.005
        }
        polygonsTransitionDuration={250}
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(arc) => arc.color}
        arcDashLength={(arc) =>
          arc.type === "visited" ? 0.045 : 0.065
        }
        arcDashGap={(arc) =>
          arc.type === "visited" ? 0.028 : 0.04
        }
        arcDashAnimateTime={(arc) =>
          arc.type === "visited" ? 3200 : 2450
        }
        arcStroke={(arc) =>
          arc.type === "visited" ? 0.9 : 1.2
        }
        arcAltitude={(arc) =>
          arc.type === "visited" ? 0.12 : 0.17
        }
        htmlElementsData={routePoints}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(point) =>
          point.markerType === "visited" ? 0.055 : 0.045
        }
        htmlElement={createMarkerElement}
        labelsData={routePoints}
        labelLat="lat"
        labelLng="lng"
        labelAltitude={0.08}
        labelText={(point) => point.label}
        labelColor={() => "rgba(255,255,255,0.95)"}
        labelSize={0.58}
        labelDotRadius={0.18}
        labelResolution={2}
      />

      {pickerOpen &&
        createPortal(
          <div
            className="globe-country-modal-backdrop"
            onMouseDown={() => setPickerOpen(false)}
          >
            <section
              className="globe-country-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span>TRAVEL FOOTPRINT</span>
                  <h3>Add a visited country</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  aria-label="Close country picker"
                >
                  <X size={19} />
                </button>
              </header>

              <label className="globe-country-search">
                Search for a country
                <div>
                  <Search size={17} />

                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSelectedCountryId("");
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Start typing, e.g. Japan"
                    autoFocus
                  />
                </div>
              </label>

              <label className="globe-country-select">
                Or select from the dropdown
                <select
                  value={selectedCountryId}
                  onChange={(event) => {
                    const country = countries.find(
                      (item) => item.id === event.target.value,
                    );

                    setSelectedCountryId(event.target.value);

                    if (country) {
                      setSearchQuery(country.name);
                    }
                  }}
                >
                  <option value="">Select a country</option>

                  {filteredCountries.map((country) => (
                    <option
                      key={country.id}
                      value={country.id}
                      disabled={visitedCountryMap.has(country.id)}
                    >
                      {country.name}
                      {visitedCountryMap.has(country.id)
                        ? " — already added"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {searchQuery.trim() && (
                <div className="globe-country-results">
                  <span>
                    {filteredCountries.length} matching{" "}
                    {filteredCountries.length === 1
                      ? "country"
                      : "countries"}
                  </span>

                  <div>
                    {filteredCountries.slice(0, 7).map((country) => {
                      const alreadyAdded =
                        visitedCountryMap.has(country.id);

                      return (
                        <button
                          type="button"
                          key={country.id}
                          disabled={alreadyAdded}
                          className={
                            selectedCountryId === country.id
                              ? "selected"
                              : ""
                          }
                          onClick={() => chooseCountry(country)}
                        >
                          <MapPin size={15} />

                          <strong>{country.name}</strong>

                          {alreadyAdded && <small>Added</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {visitedCountries.length > 0 && (
                <div className="globe-visited-list">
                  <span>Visited countries</span>

                  {visitedCountries.map((country, index) => (
                    <article key={country.countryId}>
                      <button
                        type="button"
                        onClick={() => focusCountry(country)}
                      >
                        <MapPin size={15} />

                        <strong>
                          {index + 1}. {country.name}
                        </strong>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeVisitedCountry(country.countryId)
                        }
                        aria-label={`Remove ${country.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              )}

              <footer>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!selectedCountryId}
                  onClick={addSelectedCountry}
                >
                  <Check size={17} />
                  Add to globe
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}