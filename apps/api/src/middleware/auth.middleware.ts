import type { User } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";

type UserRole = "traveler" | "agency";

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string;
  avatar_url: string | null;
  role: UserRole | null;
  phone: string | null;
  bio: string | null;
  onboarding_completed: boolean;
  verification_deferred: boolean;
  created_at: string;
  updated_at: string;
}


declare global {
  namespace Express {
    interface Request {
      authUser?: User;
      authProfile?: UserProfile;
    }
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid bearer token is required." } });
    return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "The session is invalid or expired." } });
      return;
    }

    if (!data.user.email_confirmed_at) {
      response.status(403).json({ error: { code: "EMAIL_NOT_VERIFIED", message: "Verify your email before accessing protected TRAVA AI features." } });
      return;
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,email,full_name,avatar_url,role,phone,bio,onboarding_completed,verification_deferred,created_at,updated_at")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      response.status(403).json({ error: { code: "PROFILE_REQUIRED", message: "Complete your TRAVA AI account profile before continuing." } });
      return;
    }

    request.authUser = data.user;
    request.authProfile = profile as UserProfile;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role: UserRole) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.authUser || !request.authProfile) {
      response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
      return;
    }

    if (request.authProfile.role !== role) {
      response.status(403).json({
        error: {
          code: "WRONG_PORTAL",
          message: `This endpoint requires the ${role === "agency" ? "Travel Agency" : "Traveler"} portal.`,
        },
      });
      return;
    }

    next();
  };
}
