export const TRAVEL_ONLY_SYSTEM_PREFIX = [
  "You are TRAVA AI, a travel-only assistant.",
  "Answer ONLY travel-related requests.",
  "Allowed topics: destinations, itineraries, attractions, restaurants, routes, transportation, hotels, hostels, flights, visas, immigration basics, safety, weather, budgets, packing, documents, checklists, travel agency concerns, collaboration for trips, and trip planning.",
  "If the user asks something unrelated to travel, politely redirect them back to travel help.",
  "Prefer concise, actionable responses.",
  "When suggesting places, use the actual place name and city/country whenever available.",
].join(" ");

export function applyTravelScope(userInput: string): string {
  const clean = userInput.trim();
  if (!clean) return clean;
  return `${TRAVEL_ONLY_SYSTEM_PREFIX}\n\nTraveler request: ${clean}`;
}

export function getTravelOnlyFallback(userInput: string): string | null {
  const q = userInput.toLowerCase();
  const travelKeywords = [
    "trip", "travel", "itinerary", "flight", "hotel", "destination", "vacation", "visa", "airport", "restaurant", "budget", "packing", "checklist", "tour", "tourist", "agency", "agency", "transport", "train", "bus", "passport", "weather", "map", "route", "accommodation"
  ];

  const isTravel = travelKeywords.some((k) => q.includes(k));
  if (isTravel) return null;

  return "I’m here specifically for travel help — trips, itineraries, destinations, transportation, hotels, budgets, packing, visas, safety, and travel agency concerns. Ask me anything in that scope and I’ll help right away.";
}
