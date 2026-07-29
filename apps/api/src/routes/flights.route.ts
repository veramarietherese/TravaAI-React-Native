import { Router } from "express";

export const flightsRouter = Router();
flightsRouter.get("/", (_request, response) => {
  response.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "Flight integration is pending." } });
});
