import type { UserProfile, UserRole } from "@trava/shared";
import * as WebBrowser from "expo-web-browser";

import { getSupabaseClient } from "@/lib/supabase";
import type {
  EmailSignInInput,
  EmailSignUpInput,
  GoogleSignInOutcome,
  SignUpOutcome,
} from "../types";
import { getAuthRedirectUri } from "../utils/auth-redirect";
import { getPendingOAuthRole, setPendingOAuthRole } from "../utils/auth-storage";

WebBrowser.maybeCompleteAuthSession();

const PROFILE_COLUMNS =
  "id,email,full_name,avatar_url,role,phone,bio,onboarding_completed,verification_deferred,created_at,updated_at";

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserProfile | null;
}

function portalName(role: UserRole): string {
  return role === "agency" ? "Travel Agency" : "Traveler";
}

export async function ensureAccountRole(expectedRole: UserRole): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw userError ?? new Error("Your session expired. Please sign in again.");

  let profile = await fetchProfile(user.id);
  if (!profile) {
    throw new Error("Your account profile is not ready. Apply the TRAVA AI auth database migration, then try again.");
  }

  if (!profile.role) {
    await setMyRole(expectedRole);
    profile = await fetchProfile(user.id);
    if (!profile?.role) throw new Error("TRAVA AI could not finish setting up your account portal.");
  }

  if (profile.role !== expectedRole) {
    await supabase.auth.signOut();
    throw new Error(
      `This account belongs to the ${portalName(profile.role)} portal. Open that portal to sign in.`,
    );
  }

  return profile;
}

export async function signInWithEmail(input: EmailSignInInput): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) throw error;

  await ensureAccountRole(input.role);
}

export async function signUpWithEmail(input: EmailSignUpInput): Promise<SignUpOutcome> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: getAuthRedirectUri("email-confirmation"),
      data: {
        full_name: input.fullName.trim(),
        role: input.role,
      },
    },
  });

  if (error) throw error;

  if (data.session) await ensureAccountRole(input.role);

  return {
    email,
    needsEmailVerification: !data.session,
    session: data.session,
  };
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function resendVerification(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: getAuthRedirectUri("email-confirmation"),
    },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: getAuthRedirectUri("recovery") },
  );
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function setMyRole(role: UserRole, fullName?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("set_my_role", { p_role: role });
  if (error) throw error;

  if (fullName?.trim()) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Your session expired. Please sign in again.");

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (profileError) throw profileError;
  }
}

function getParam(url: URL, name: string): string | null {
  return url.searchParams.get(name) || new URLSearchParams(url.hash.replace(/^#/, "")).get(name);
}

export async function completeAuthCallback(
  callbackUrl: string,
): Promise<{ intent: string | null }> {
  const parsed = new URL(callbackUrl);
  const code = getParam(parsed, "code");
  const accessToken = getParam(parsed, "access_token");
  const refreshToken = getParam(parsed, "refresh_token");
  const intent = getParam(parsed, "intent") || getParam(parsed, "type");
  const errorDescription = getParam(parsed, "error_description");

  if (errorDescription) throw new Error(decodeURIComponent(errorDescription));

  if (code) {
    const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (accessToken && refreshToken) {
    const { error } = await getSupabaseClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  } else {
    throw new Error("The authentication callback did not include a valid session code.");
  }

  const pendingRole = await getPendingOAuthRole();
  if (pendingRole) {
    try {
      await ensureAccountRole(pendingRole);
    } finally {
      await setPendingOAuthRole(null);
    }
  }

  return { intent };
}

export async function signInWithGoogle(role: UserRole): Promise<GoogleSignInOutcome> {
  const redirectTo = getAuthRedirectUri("oauth");
  await setPendingOAuthRole(role);

  try {
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error("Google did not return an authorization URL.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      await setPendingOAuthRole(null);
      return { cancelled: true };
    }

    await completeAuthCallback(result.url);
    return { cancelled: false };
  } catch (error) {
    await setPendingOAuthRole(null);
    throw error;
  }
}
