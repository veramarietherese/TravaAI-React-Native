import cors from "cors";
import express from "express";

import { errorMiddleware } from "./middleware/error.middleware.js";
import { authRouter } from "./routes/auth.route.js";
import { homeRouter } from "./routes/home.route.js";
import { chatRouter } from "./routes/chat.route.js";
import { flightsRouter } from "./routes/flights.route.js";
import { healthRouter } from "./routes/health.route.js";
import { itineraryRouter } from "./routes/itinerary.route.js";
import { placesRouter } from "./routes/places.route.js";
import { tripsRouter } from "./routes/trips.route.js";
import { recommendationsRouter } from "./routes/recommendations.route.js";

const configuredOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Native apps and server-to-server requests do not send Origin.
  if (configuredOrigins.has(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      || /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin);
  }
  return false;
}

export const app = express();

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) callback(null, true);
    else callback(new Error("Origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/home", homeRouter);
app.use("/api/chat", chatRouter);
app.use("/api/itinerary", itineraryRouter);
app.use("/api/places", placesRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/flights", flightsRouter);

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});
app.use(errorMiddleware);
