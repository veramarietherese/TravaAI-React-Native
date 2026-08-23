import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";

interface ChatTurn {
  role?: unknown;
  text?: unknown;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_TURNS = 10;

export const chatRouter = Router();

chatRouter.post("/", requireAuth, async (request, response) => {
  const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
  const rawHistory = Array.isArray(request.body?.history) ? request.body.history as ChatTurn[] : [];
  const tripContext = request.body?.tripContext ?? null;

  if (!message) {
    response.status(400).json({ error: { code: "INVALID_MESSAGE", message: "Message is required." } });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    response.status(400).json({ error: { code: "MESSAGE_TOO_LONG", message: `Keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.` } });
    return;
  }

  const profileName = request.authProfile?.full_name || request.authUser?.email?.split("@")[0] || "Traveler";
  const history = rawHistory
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role === "assistant" || turn.role === "model" ? "model" : "user",
      text: typeof turn.text === "string" ? turn.text.slice(0, 2_000) : "",
    }))
    .filter((turn) => turn.text);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    response.json(buildFallback(message, profileName));
    return;
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const systemInstruction = [
    "You are TRAVA AI, a concise, practical travel copilot inside the TRAVA trip-planning application.",
    "Help with itineraries, destination choices, budgeting, packing, weather preparation, transport, visas as general guidance, and trip organization.",
    "Never claim a booking, price, visa rule, opening hour, weather condition, or live availability was verified unless the user supplied it or a connected feature explicitly provides it.",
    "Prefer actionable plans and short grouped bullets. Ask at most one clarifying question when a critical trip constraint is missing.",
    `The signed-in traveler is ${profileName}.`,
    tripContext ? `Current trip context: ${JSON.stringify(tripContext).slice(0, 3_000)}` : "",
  ].filter(Boolean).join("\n");

  const contents = [
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 24_000);

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            maxOutputTokens: 900,
          },
        }),
      },
    );

    const payload = await geminiResponse.json().catch(() => null) as GeminiResponse | null;
    const reply = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!geminiResponse.ok || !reply) {
      response.json(buildFallback(message, profileName));
      return;
    }

    response.setHeader("Cache-Control", "no-store");
    response.json({
      reply,
      source: "gemini",
      quickReplies: buildQuickReplies(message),
    });
  } catch {
    response.json(buildFallback(message, profileName));
  } finally {
    clearTimeout(timeout);
  }
});

function buildFallback(message: string, name: string) {
  const lower = message.toLowerCase();
  let reply = `I can still help, ${name}. Tell me the destination, trip length, and approximate budget, and I’ll turn it into a practical TRAVA plan.`;

  if (/pack|weather|rain|cold|hot/.test(lower)) {
    reply = "For weather preparation, build around layers, a compact rain layer, comfortable walking shoes, sun protection, and any destination-specific essentials. Open the trip overview for TRAVA’s live weather-preparation card when your itinerary has a mapped stop.";
  } else if (/budget|cost|cheap|money/.test(lower)) {
    reply = "A clean travel budget starts with five buckets: transport, stay, food, activities, and buffer. Keep 10–15% unassigned for changes, then add real expenses in the trip workspace so TRAVA can show remaining balance and participant splits.";
  } else if (/itinerary|plan|day/.test(lower)) {
    reply = "A strong itinerary keeps each day geographically tight: one anchor activity, nearby food stops, realistic transit time, and an open recovery block. Give me your destination and number of days and I’ll outline it day by day.";
  }

  return { reply, source: "fallback", quickReplies: buildQuickReplies(message) };
}

function buildQuickReplies(message: string) {
  const lower = message.toLowerCase();
  if (/japan|tokyo|osaka|kyoto/.test(lower)) return ["Build a 5-day Japan plan", "Estimate a Japan budget", "What should I pack?", "Best areas to stay"];
  return ["Plan my next trip", "Build a realistic budget", "What should I pack?", "Improve my itinerary"];
}
