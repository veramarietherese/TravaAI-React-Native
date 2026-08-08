import * as AuthSession from "expo-auth-session";

export type AuthRedirectIntent = "oauth" | "email-confirmation" | "recovery";

export function getAuthRedirectUri(intent: AuthRedirectIntent): string {
  const base = AuthSession.makeRedirectUri({
    scheme: "travaai",
    path: "auth/callback",
  });

  return `${base}${base.includes("?") ? "&" : "?"}intent=${encodeURIComponent(intent)}`;
}
