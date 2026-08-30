import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

import type { DiscoverPlace } from "../components/DiscoverMap";

export type ExploreCategory =
  | "Attractions"
  | "Food"
  | "Cafés"
  | "Activities"
  | "Hidden Gems"
  | "Shopping";

export type ExploreIconName = ComponentProps<typeof Ionicons>["name"];

export type DemoPackage = {
  id: string;
  title: string;
  destination: string;
  agency: string;
  price: string;
  category: string;
  imageUrl: string;
  duration: string;
};

export type DemoAgency = {
  id: string;
  name: string;
  tagline: string;
  specialty: string;
  rating: string;
  imageUrl: string;
  initials: string;
};

export const CEBU_CENTER = { latitude: 10.3157, longitude: 123.8854 };

export const EXPLORE_CATEGORIES: ReadonlyArray<{
  name: ExploreCategory;
  icon: ExploreIconName;
  api: string;
}> = [
  { name: "Attractions", icon: "business-outline", api: "attractions" },
  { name: "Food", icon: "restaurant-outline", api: "food" },
  { name: "Cafés", icon: "cafe-outline", api: "cafes" },
  { name: "Activities", icon: "walk-outline", api: "activities" },
  { name: "Hidden Gems", icon: "location-outline", api: "hidden" },
  { name: "Shopping", icon: "bag-handle-outline", api: "shopping" },
];

function commons(fileName: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1000`;
}

/**
 * Default Cebu discovery cards use real places, real coordinates and images
 * of the named location. Live text search and category discovery still come
 * from the existing OpenStreetMap/Photon utilities.
 */
export const CURATED_CEBU_PICKS: DiscoverPlace[] = [
  {
    id: "cebu-temple-of-leah",
    name: "Temple of Leah",
    subtitle: "Cebu Transcentral Highway, Busay, Cebu City",
    latitude: 10.368992,
    longitude: 123.873428,
    imageUrl: commons("Temple of Leah, Cebu City, Jan 2024.jpg"),
    rating: 4.6,
    distance: "Busay · Cebu City",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-taoist-temple",
    name: "Cebu Taoist Temple",
    subtitle: "Beverly Hills Subdivision, Lahug, Cebu City",
    latitude: 10.3308,
    longitude: 123.8867,
    imageUrl: commons("Taoist Temple, Cebu.jpg"),
    rating: 4.6,
    distance: "Lahug · Cebu City",
    category: "Hidden Gems",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-ayala-center",
    name: "Ayala Center Cebu",
    subtitle: "Cebu Business Park, Cebu City",
    latitude: 10.3174,
    longitude: 123.9053,
    imageUrl: commons("Ayala Center Cebu (10-05-2022).jpg"),
    rating: 4.6,
    distance: "Cebu Business Park",
    category: "Shopping",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-sirao-garden",
    name: "Sirao Garden",
    subtitle: "Sirao, Cebu City — hillside flower gardens",
    latitude: 10.407069,
    longitude: 123.866697,
    imageUrl: commons("Sirao Garden.jpg"),
    rating: 4.5,
    distance: "Sirao · Cebu City",
    category: "Activities",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-magellans-cross",
    name: "Magellan's Cross",
    subtitle: "P. Burgos Street, Cebu City",
    latitude: 10.293419,
    longitude: 123.901869,
    imageUrl: commons("Magellan's Cross in Cebu.jpg"),
    rating: 4.4,
    distance: "Downtown Cebu",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-fort-san-pedro",
    name: "Fort San Pedro",
    subtitle: "A. Pigafetta Street, Plaza Independencia, Cebu City",
    latitude: 10.2929,
    longitude: 123.9058,
    imageUrl: commons("Cebu City Fort San Pedro.jpg"),
    rating: 4.5,
    distance: "Plaza Independencia",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-santo-nino",
    name: "Basilica Minore del Santo Niño",
    subtitle: "Osmeña Boulevard, Cebu City",
    latitude: 10.2944,
    longitude: 123.9015,
    imageUrl: commons("Basilica Minore del Santo Niño Cebu.jpg"),
    rating: 4.8,
    distance: "Downtown Cebu",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-casa-gorordo",
    name: "Casa Gorordo Museum",
    subtitle: "Eduardo Aboitiz Street, Cebu City",
    latitude: 10.3006,
    longitude: 123.9001,
    imageUrl: commons("Casa Gorordo Museum Cebu.jpg"),
    rating: 4.5,
    distance: "Parian · Cebu City",
    category: "Hidden Gems",
    city: "Cebu City",
    country: "Philippines",
  },
  {
    id: "cebu-plaza-independencia",
    name: "Plaza Independencia",
    subtitle: "M. J. Cuenco Avenue, Cebu City",
    latitude: 10.2925,
    longitude: 123.9061,
    imageUrl: commons("Plaza Independencia Cebu.jpg"),
    rating: 4.4,
    distance: "Downtown Cebu",
    category: "Attractions",
    city: "Cebu City",
    country: "Philippines",
  },
];

export const CATEGORY_FALLBACK_IMAGES: Record<ExploreCategory, string> = {
  Attractions:
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=84",
  Food:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=84",
  Cafés:
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=84",
  Activities:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=84",
  "Hidden Gems":
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=84",
  Shopping:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=84",
};

export const DEMO_PACKAGES: DemoPackage[] = [
  {
    id: "demo-cebu-city-trail",
    title: "Cebu Heritage & Food Trail",
    destination: "Cebu City",
    agency: "Skyline Adventures",
    price: "₱1,499",
    category: "Culture + Food",
    imageUrl:
      "https://images.unsplash.com/photo-1552560880-2482cef14240?auto=format&fit=crop&w=1000&q=84",
    duration: "6 hours",
  },
  {
    id: "demo-moalboal",
    title: "Moalboal Ocean Day",
    destination: "Moalboal",
    agency: "Wanderlust Travels",
    price: "₱2,899",
    category: "Ocean Adventure",
    imageUrl:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=84",
    duration: "Full day",
  },
  {
    id: "demo-osmena",
    title: "Osmeña Peak Sunrise",
    destination: "Dalaguete",
    agency: "Vera Journey Co.",
    price: "₱1,199",
    category: "Hiking",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=84",
    duration: "7 hours",
  },
  {
    id: "demo-bantayan",
    title: "Bantayan Island Escape",
    destination: "Bantayan",
    agency: "Islandbound Cebu",
    price: "₱2,499",
    category: "Island Day",
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=84",
    duration: "Full day",
  },
  {
    id: "demo-canyoneering",
    title: "Canyoneering Adventure",
    destination: "Badian",
    agency: "South Cebu Trails",
    price: "₱2,699",
    category: "Adventure",
    imageUrl:
      "https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1000&q=84",
    duration: "8 hours",
  },
  {
    id: "demo-bohol",
    title: "Bohol Countryside Day",
    destination: "Bohol",
    agency: "Visayas Gateway",
    price: "₱3,299",
    category: "Day Trip",
    imageUrl:
      "https://images.unsplash.com/photo-1531761535209-180857e963b9?auto=format&fit=crop&w=1000&q=84",
    duration: "Full day",
  },
  {
    id: "demo-mactan",
    title: "Mactan Island Hopping",
    destination: "Lapu-Lapu City",
    agency: "Islandbound Cebu",
    price: "₱2,199",
    category: "Island Hopping",
    imageUrl:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1000&q=84",
    duration: "6 hours",
  },
  {
    id: "demo-food-night",
    title: "Cebu Night Market Crawl",
    destination: "Cebu City",
    agency: "Skyline Adventures",
    price: "₱999",
    category: "Food",
    imageUrl:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1000&q=84",
    duration: "4 hours",
  },
];

export const DEMO_AGENCIES: DemoAgency[] = [
  {
    id: "agency-skyline",
    name: "Skyline Adventures",
    tagline: "Curated city, culture and island escapes.",
    specialty: "Cebu · Bohol · Siargao",
    rating: "4.8",
    imageUrl:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=84",
    initials: "SA",
  },
  {
    id: "agency-wanderlust",
    name: "Wanderlust Travels",
    tagline: "Adventure-first itineraries around the Visayas.",
    specialty: "Moalboal · Badian · Bantayan",
    rating: "4.7",
    imageUrl:
      "https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1000&q=84",
    initials: "WT",
  },
  {
    id: "agency-vera",
    name: "Vera Journey Co.",
    tagline: "Slow travel and thoughtfully paced escapes.",
    specialty: "Culture · Food · Wellness",
    rating: "4.9",
    imageUrl:
      "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1000&q=84",
    initials: "VJ",
  },
  {
    id: "agency-islandbound",
    name: "Islandbound Cebu",
    tagline: "Beach transfers, day tours and island hopping.",
    specialty: "Mactan · Bantayan · Camotes",
    rating: "4.6",
    imageUrl:
      "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1000&q=84",
    initials: "IC",
  },
  {
    id: "agency-southcebu",
    name: "South Cebu Trails",
    tagline: "Local-led outdoor adventures in southern Cebu.",
    specialty: "Badian · Oslob · Dalaguete",
    rating: "4.8",
    imageUrl:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=84",
    initials: "SC",
  },
  {
    id: "agency-visayas",
    name: "Visayas Gateway",
    tagline: "Multi-island planning without the logistics headache.",
    specialty: "Cebu · Bohol · Dumaguete",
    rating: "4.7",
    imageUrl:
      "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=1000&q=84",
    initials: "VG",
  },
  {
    id: "agency-northstar",
    name: "Northstar Travel Studio",
    tagline: "Premium private transfers and family itineraries.",
    specialty: "Family · Private Tours · Transfers",
    rating: "4.8",
    imageUrl:
      "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1000&q=84",
    initials: "NS",
  },
  {
    id: "agency-roam",
    name: "Roam Cebu Collective",
    tagline: "Independent local guides for neighborhood experiences.",
    specialty: "Hidden Gems · Food · Local Guides",
    rating: "4.9",
    imageUrl:
      "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1000&q=84",
    initials: "RC",
  },
];

export function inferExploreCategory(text: string): ExploreCategory {
  const value = text.toLowerCase();
  if (value.includes("cafe") || value.includes("coffee")) return "Cafés";
  if (value.includes("food") || value.includes("restaurant") || value.includes("eat")) return "Food";
  if (value.includes("shop") || value.includes("mall") || value.includes("store")) return "Shopping";
  if (value.includes("hike") || value.includes("trail") || value.includes("tour") || value.includes("activity")) return "Activities";
  if (value.includes("hidden") || value.includes("garden") || value.includes("local")) return "Hidden Gems";
  return "Attractions";
}

export function exploreCategoryIcon(category: string): ExploreIconName {
  if (category === "Food") return "restaurant-outline";
  if (category === "Cafés") return "cafe-outline";
  if (category === "Shopping") return "bag-handle-outline";
  if (category === "Activities") return "walk-outline";
  if (category === "Hidden Gems") return "location-outline";
  return "business-outline";
}

export function ratingCount(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum += id.charCodeAt(index);
  return 120 + (sum % 980);
}

export function humanDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((lat2 - lat1) * rad) / 2 +
    (Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (1 - Math.cos((lon2 - lon1) * rad))) / 2;
  const km = 12742 * Math.asin(Math.sqrt(a));
  return km < 1
    ? `${Math.max(20, Math.round((km * 1000) / 10) * 10)} m`
    : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
