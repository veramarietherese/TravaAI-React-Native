import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile, UserRole } from "@trava/shared";

export interface EmailSignInInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface EmailSignUpInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface SignUpOutcome {
  email: string;
  needsEmailVerification: boolean;
  session: Session | null;
}

export interface GoogleSignInOutcome {
  cancelled: boolean;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isInitializing: boolean;
  isProfileLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  signInWithEmail(input: EmailSignInInput): Promise<void>;
  signUpWithEmail(input: EmailSignUpInput): Promise<SignUpOutcome>;
  signInWithGoogle(role: UserRole): Promise<GoogleSignInOutcome>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  chooseRole(role: UserRole, fullName?: string): Promise<void>;
  refreshProfile(): Promise<UserProfile | null>;
  completeAuthCallback(url: string): Promise<{ intent: string | null }>;
}
