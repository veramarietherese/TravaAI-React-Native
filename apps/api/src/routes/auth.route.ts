import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.get("/me", requireAuth, async (request, response) => {
  const user = request.authUser;
  const profile = request.authProfile;

  if (!user || !profile) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "No authenticated user was found." } });
    return;
  }

  response.status(200).json({
    user: {
      id: user.id,
      email: user.email ?? null,
      emailConfirmed: Boolean(user.email_confirmed_at),
      provider: user.app_metadata.provider ?? null,
    },
    profile,
    access: {
      portal: profile.role,
      traveler: profile.role === "traveler",
      agency: profile.role === "agency",
    },
  });
});
