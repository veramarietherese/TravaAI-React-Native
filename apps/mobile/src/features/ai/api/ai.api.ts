import { apiRequest } from "@/lib/api-client";
import type { AiPreferences, AiServerResponse } from "../types/ai.types";

export type AiHistoryTurn = { role:"user"|"assistant";text:string };
export type AiTripContext = { id:string;name:string;destination?:string|null;startDate?:string|null;endDate?:string|null;status?:string|null;currencyCode?:string|null };

export async function sendAiMessage(input:{message:string;history:AiHistoryTurn[];preferences:AiPreferences;tripContext:AiTripContext[];signal?:AbortSignal}) {
  return apiRequest<AiServerResponse>("/api/chat",{
    method:"POST",
    signal:input.signal,
    body:JSON.stringify({
      message:input.message,
      history:input.history.slice(-10),
      preferences:compactPreferences(input.preferences),
      tripContext:input.tripContext.slice(0,5),
      locale:deviceLocale(),
      currency:input.tripContext.find((trip)=>trip.currencyCode?.trim())?.currencyCode?.trim() || undefined,
    }),
  }, 22_000);
}

function compactPreferences(value:AiPreferences){return Object.fromEntries(Object.entries(value).filter(([,item])=>item.trim()).map(([key,item])=>[key,item.trim()]));}

function deviceLocale(){try{return Intl.DateTimeFormat().resolvedOptions().locale||undefined;}catch{return undefined;}}
