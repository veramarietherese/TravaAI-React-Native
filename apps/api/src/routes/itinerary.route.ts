import { Router } from "express";

export const itineraryRouter = Router();
itineraryRouter.post("/", (_request, response) => {
  response.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "Itinerary migration is pending." } });
});
