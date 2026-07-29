import { Router } from "express";

export const recommendationsRouter = Router();
recommendationsRouter.post("/", (_request, response) => {
  response.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "Recommendations migration is pending." } });
});
