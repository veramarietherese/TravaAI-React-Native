import type { DiscoverPlace } from "@/features/explore/components/DiscoverMap.types";

export type AiIntent = "itinerary" | "food" | "budget" | "hotel" | "transport" | "general";
export type AiPreferences = { destination:string;days:string;travelers:string;style:string };
export type AiSection = { title:string;items:string[] };
export type AiPlaceSpec = { name:string;city?:string;country?:string;reason:string };
export type AiTripRecommendation = { title:string;destination:string;duration?:string;travelers?:string;estimatedBudget?:string;characteristics?:string[] };
export type AiResolvedPlace = { place:DiscoverPlace;reason:string };

export type AiServerResponse = {
  message:string;
  sections:AiSection[];
  places:AiPlaceSpec[];
  recommendations:AiTripRecommendation[];
  quickReplies:string[];
  intent:AiIntent;
  scope:"travel"|"refuse";
  source?:string;
};

export type AiChatMessage = {
  id:string;
  role:"user"|"assistant";
  text:string;
  sections?:AiSection[];
  places?:AiResolvedPlace[];
  recommendations?:AiTripRecommendation[];
  quickReplies?:string[];
  intent?:AiIntent;
  createdAt:number;
};
