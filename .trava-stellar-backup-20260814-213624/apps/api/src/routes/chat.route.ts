import { Router } from "express";

export const chatRouter = Router();
chatRouter.post("/", (_request, response) => {
  response.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "Chat migration is pending." } });
});
