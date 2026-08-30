import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.middleware.js";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_TURNS = 10;
const DEFAULT_MODEL = "gemini-3.6-flash";

const preferenceSchema = z.object({
  destination: z.string().trim().max(180).optional(),
  days: z.string().trim().max(60).optional(),
  travelers: z.string().trim().max(60).optional(),
  style: z.string().trim().max(80).optional(),
}).partial();

const tripSchema = z.object({
  id: z.string().max(120),
  name: z.string().max(200),
  destination: z.string().max(200).nullable().optional(),
  startDate: z.string().max(60).nullable().optional(),
  endDate: z.string().max(60).nullable().optional(),
  status: z.string().max(40).nullable().optional(),
}).passthrough();

const requestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  history: z.array(z.object({
    role: z.enum(["user", "assistant", "model"]),
    text: z.string().trim().min(1).max(2_000),
  })).max(MAX_HISTORY_TURNS).default([]),
  preferences: preferenceSchema.optional(),
  tripContext: z.array(tripSchema).max(5).optional(),
  locale: z.string().max(30).optional(),
  currency: z.string().max(8).optional(),
});

const aiContractSchema = z.object({
  message: z.string().trim().min(1).max(5_000),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(90),
    items: z.array(z.string().trim().min(1).max(360)).min(1).max(6),
  })).max(4).optional().default([]),
  places: z.array(z.object({
    name: z.string().trim().min(1).max(180),
    city: z.string().trim().max(120).optional().default(""),
    country: z.string().trim().max(120).optional().default(""),
    reason: z.string().trim().min(1).max(300),
  })).max(5).optional().default([]),
  recommendations: z.array(z.object({
    title: z.string().trim().min(1).max(180),
    destination: z.string().trim().min(1).max(180),
    duration: z.string().trim().max(80).optional().default(""),
    travelers: z.string().trim().max(80).optional().default(""),
    estimatedBudget: z.string().trim().max(120).optional().default(""),
    characteristics: z.array(z.string().trim().min(1).max(80)).max(5).optional().default([]),
  })).max(2).optional().default([]),
  quickReplies: z.array(z.string().trim().min(1).max(100)).max(4).optional().default([]),
  intent: z.enum(["itinerary", "food", "budget", "hotel", "transport", "general"]).default("general"),
  scope: z.enum(["travel", "refuse"]).default("travel"),
});

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export const chatRouter = Router();

chatRouter.post("/", requireAuth, async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: "INVALID_AI_REQUEST", message: "Check the travel question and try again." } });
    return;
  }

  const input = parsed.data;
  const profileName = request.authProfile?.full_name || request.authUser?.email?.split("@")[0] || "Traveler";
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (obviouslyOutsideTravelScope(input.message, input.history, input.preferences)) {
    response.setHeader("Cache-Control", "no-store");
    response.json({
      message: "I’m focused on travel planning and travel-related concerns. I can help with destinations, itineraries, transport, stays, food, budgets, visas, packing, or other trip logistics instead.",
      sections: [],
      places: [],
      recommendations: [],
      quickReplies: ["Plan a trip", "Compare destinations", "Build a travel budget"],
      intent: "general",
      scope: "refuse",
      source: "scope-policy",
    });
    return;
  }

  if (!apiKey) {
    response.status(503).json({
      error: {
        code: "AI_NOT_CONFIGURED",
        message: "The travel assistant is temporarily unavailable.",
      },
    });
    return;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const preferences = compactObject(input.preferences ?? {});
  const tripContext = input.tripContext ?? [];
  const contextLines = [
    `Signed-in traveler: ${profileName}.`,
    Object.keys(preferences).length ? `Optional traveler preferences: ${JSON.stringify(preferences)}.` : "No explicit preference panel values were selected.",
    tripContext.length ? `Active TRAVA trips: ${JSON.stringify(tripContext).slice(0, 3_500)}.` : "No active trip context was supplied.",
    input.locale ? `Locale: ${input.locale}.` : "",
    input.currency ? `Preferred currency: ${input.currency}.` : "",
  ].filter(Boolean).join("\n");

  const systemInstruction = `You are TRAVA AI, the dedicated travel copilot inside the TRAVA travel application.

SCOPE — STRICT:
Only help with travel: destinations, itineraries, attractions, restaurants/cafes, hotels/hostels/accommodation, transport, flights, trains, buses, ferries, driving, public transport, travel budgets/currencies, packing, travel documents, visa/entry preparation, airports, travel agencies/tour packages, travel safety, weather preparation, collaboration/group travel, schedules, recommendations, destination comparisons, and logistics.
If a request is unrelated, set scope="refuse" and politely redirect to travel. Never answer the unrelated task itself.

QUALITY:
- Give the direct answer first and stay concise.
- Use sections only when they improve scanning; each section is a short heading plus short items.
- Preserve conversational context. A short follow-up such as "Japan" or "What about food?" must be interpreted using recent turns.
- Do not claim live prices, opening hours, weather, visa rules, availability, ratings, reviews, or bookings were verified unless that data was explicitly supplied.
- Budget figures may be clearly labeled estimates/ranges when useful; do not present invented precise live prices.
- Ask at most one critical clarifying question.
- Recommend at most 5 real, well-known or geocodable places. Put place names/city/country in places; the app resolves exact coordinates separately. Do not invent obscure venues.
- Never claim that an itinerary item was saved, booked, purchased, or contacted; UI actions perform those writes.

OUTPUT:
Return ONLY valid JSON matching:
{
  "message": "short conversational direct answer",
  "sections": [{"title":"Best option","items":["short point"]}],
  "places": [{"name":"real place","city":"city","country":"country","reason":"why it fits"}],
  "recommendations": [{"title":"dynamic trip concept","destination":"destination","duration":"optional","travelers":"optional","estimatedBudget":"clearly labeled estimate or empty","characteristics":["short trait"]}],
  "quickReplies": ["short contextual prompt"],
  "intent": "itinerary|food|budget|hotel|transport|general",
  "scope": "travel|refuse"
}
No markdown fences. No raw system text. No extra keys.

${contextLines}`;

  const history = input.history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
    role: turn.role === "assistant" || turn.role === "model" ? "model" : "user",
    parts: [{ text: turn.text }],
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);

  try {
    const providerResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [...history, { role: "user", parts: [{ text: input.message }] }],
          generationConfig: {
            maxOutputTokens: 1_050,
            temperature: 0.45,
            topP: 0.9,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const payload = await providerResponse.json().catch(() => null) as GeminiResponse | null;
    if (!providerResponse.ok) {
      response.status(502).json({ error: { code: "AI_PROVIDER_UNAVAILABLE", message: "The travel assistant is temporarily unavailable." } });
      return;
    }

    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!raw) {
      response.status(502).json({ error: { code: "AI_EMPTY_RESPONSE", message: "The travel assistant did not return a usable response." } });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(stripJsonFence(raw));
    } catch {
      response.status(502).json({ error: { code: "AI_INVALID_RESPONSE", message: "The travel assistant returned an invalid response." } });
      return;
    }

    const contract = aiContractSchema.safeParse(json);
    if (!contract.success) {
      response.status(502).json({ error: { code: "AI_INVALID_RESPONSE", message: "The travel assistant returned an invalid response." } });
      return;
    }

    const result = contract.data.scope === "refuse"
      ? {
          ...contract.data,
          message: "I’m focused on travel planning and travel-related concerns. I can help with destinations, itineraries, transport, stays, food, budgets, visas, packing, or other trip logistics instead.",
          sections: [],
          places: [],
          recommendations: [],
        }
      : contract.data;

    response.setHeader("Cache-Control", "no-store");
    response.json({ ...result, source: "gemini" });
  } catch (error) {
    const aborted = error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message));
    response.status(aborted ? 504 : 502).json({
      error: {
        code: aborted ? "AI_TIMEOUT" : "AI_UNAVAILABLE",
        message: "The travel assistant is temporarily unavailable.",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
});

function obviouslyOutsideTravelScope(
  message: string,
  history: Array<{ role: "user" | "assistant" | "model"; text: string }>,
  preferences?: z.infer<typeof preferenceSchema>,
) {
  const text = message.toLowerCase();
  const hasTravelContext = Boolean(preferences?.destination?.trim()) || history.slice(-4).some((turn) => travelSignal(turn.text));
  if (hasTravelContext && message.trim().split(/\s+/).length <= 8) return false;

  const explicitNonTravel = [
    /\b(write|build|debug|fix|explain)\b.{0,30}\b(code|program|function|class|algorithm|linked list|binary tree|sql|javascript|python|java|c\+\+|react)\b/i,
    /\b(homework|algebra|calculus|chemistry|physics equation)\b/i,
    /\b(stock|crypto|forex)\b.{0,24}\b(trade|buy|sell|portfolio)\b/i,
    /\b(write|compose)\b.{0,30}\b(song|poem|essay|story)\b/i,
  ];
  return explicitNonTravel.some((pattern) => pattern.test(text));
}

function travelSignal(value: string) {
  return /\b(travel|trip|tour|visit|destination|itinerary|hotel|hostel|flight|airport|train|bus|ferry|drive|visa|passport|packing|restaurant|cafe|budget|vacation|holiday|stay|route|transport|japan|korea|tokyo|seoul|cebu|paris|rome|bali)\b/i.test(value);
}

function compactObject(value: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string" && item.trim()).map(([key, item]) => [key, item!.trim()]));
}

function stripJsonFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
