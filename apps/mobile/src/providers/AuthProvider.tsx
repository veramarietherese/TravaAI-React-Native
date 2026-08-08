import type { Session } from "@supabase/supabase-js";
import type { UserProfile, UserRole } from "@trava/shared";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import {
  completeAuthCallback as completeAuthCallbackRequest,
  fetchProfile,
  requestPasswordReset as requestPasswordResetRequest,
  resendVerification as resendVerificationRequest,
  setMyRole,
  signInWithEmail as signInWithEmailRequest,
  signInWithGoogle as signInWithGoogleRequest,
  signOut as signOutRequest,
  signUpWithEmail as signUpWithEmailRequest,
  updatePassword as updatePasswordRequest,
} from "@/features/auth/api/auth.api";
import type {
  AuthContextValue,
  EmailSignInInput,
  EmailSignUpInput,
  SignUpOutcome,
} from "@/features/auth/types";
import { getSupabaseClient } from "@/lib/supabase";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const hydrateProfile = useCallback(async (userId?: string): Promise<UserProfile | null> => {
    if (!userId) {
      setProfile(null);
      setIsProfileLoading(false);
      return null;
    }

    setIsProfileLoading(true);
    try {
      const nextProfile = await fetchProfile(userId);
      setProfile(nextProfile);
      return nextProfile;
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) console.warn("Unable to restore Supabase session:", error.message);
      setSession(data.session);
      try {
        await hydrateProfile(data.session?.user.id);
      } catch (profileError) {
        console.warn("Unable to load profile:", profileError);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setIsProfileLoading(false);
      } else {
        setTimeout(() => {
          void hydrateProfile(nextSession.user.id).catch((profileError) => {
            console.warn("Unable to refresh profile:", profileError);
          });
        }, 0);
      }
      setIsInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  const refreshProfile = useCallback(async () => {
    return hydrateProfile(session?.user.id);
  }, [hydrateProfile, session?.user.id]);

  const chooseRole = useCallback(
    async (role: UserRole, fullName?: string) => {
      await setMyRole(role, fullName);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const signInWithEmail = useCallback(async (input: EmailSignInInput) => {
    await signInWithEmailRequest(input);
    const {
      data: { session: nextSession },
    } = await getSupabaseClient().auth.getSession();
    setSession(nextSession);
    await hydrateProfile(nextSession?.user.id);
  }, [hydrateProfile]);

  const signInWithGoogle = useCallback(async (role: UserRole) => {
    const outcome = await signInWithGoogleRequest(role);
    if (!outcome.cancelled) {
      const {
        data: { session: nextSession },
      } = await getSupabaseClient().auth.getSession();
      setSession(nextSession);
      await hydrateProfile(nextSession?.user.id);
    }
    return outcome;
  }, [hydrateProfile]);

  const completeAuthCallback = useCallback(async (url: string) => {
    const result = await completeAuthCallbackRequest(url);
    const {
      data: { session: nextSession },
    } = await getSupabaseClient().auth.getSession();
    setSession(nextSession);
    await hydrateProfile(nextSession?.user.id);
    return result;
  }, [hydrateProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isInitializing,
      isProfileLoading,
      isAuthenticated: Boolean(session),
      isEmailVerified: Boolean(session?.user.email_confirmed_at),
      signInWithEmail,
      signUpWithEmail: (input: EmailSignUpInput): Promise<SignUpOutcome> =>
        signUpWithEmailRequest(input),
      signInWithGoogle,
      signOut: signOutRequest,
      resendVerification: resendVerificationRequest,
      requestPasswordReset: requestPasswordResetRequest,
      updatePassword: updatePasswordRequest,
      chooseRole,
      refreshProfile,
      completeAuthCallback,
    }),
    [
      chooseRole,
      completeAuthCallback,
      isInitializing,
      isProfileLoading,
      profile,
      refreshProfile,
      session,
      signInWithEmail,
      signInWithGoogle,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
