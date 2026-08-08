import { AuthError } from "@supabase/supabase-js";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case "invalid_credentials":
        return "The email or password is incorrect.";
      case "email_not_confirmed":
        return "Please verify your email before signing in.";
      case "user_already_exists":
      case "email_exists":
        return "An account already exists for this email.";
      case "weak_password":
        return "Use a stronger password with at least eight characters.";
      case "over_request_rate_limit":
        return "Too many attempts. Please wait a moment and try again.";
      default:
        return error.message || "Authentication failed. Please try again.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function isEmailNotConfirmedError(error: unknown): boolean {
  return error instanceof AuthError && error.code === "email_not_confirmed";
}
