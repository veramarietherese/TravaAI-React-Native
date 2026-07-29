import cors from "cors";
import express from "express";
import { chatRouter } from "./routes/chat.route.js";
import { flightsRouter } from "./routes/flights.route.js";
import { healthRouter } from "./routes/health.route.js";
import { itineraryRouter } from "./routes/itinerary.route.js";
import { recommendationsRouter } from "./routes/recommendations.route.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/chat", chatRouter);
app.use("/api/itinerary", itineraryRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/flights", flightsRouter);

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});
