import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserRole } from "@trava/shared";

const ONBOARDING_KEY = "trava:onboarding:v1";
const ONBOARDING_STEP_KEY = "trava:onboarding:step:v1";
const AUTH_PORTAL_KEY = "trava:auth:last-portal:v1";
const PENDING_OAUTH_ROLE_KEY = "trava:auth:pending-oauth-role:v1";
const PENDING_VERIFICATION_KEY = "trava:auth:pending-verification:v2";
const DRAFT_PREFIX = "trava:auth:draft:v2";
const EMAIL_PREFIX = "trava:auth:remembered-email:v2";

export interface AuthDraft {
  fullName: string;
  email: string;
  acceptedTerms: boolean;
}

export interface PendingVerification {
  email: string;
  role: UserRole;
}

function isUserRole(value: unknown): value is UserRole {
  return value === "traveler" || value === "agency";
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.multiSet([
    [ONBOARDING_KEY, "true"],
    [ONBOARDING_STEP_KEY, "0"],
  ]);
}

export async function getOnboardingStep(): Promise<number> {
  const value = Number(await AsyncStorage.getItem(ONBOARDING_STEP_KEY));
  return Number.isInteger(value) && value >= 0 && value <= 1 ? value : 0;
}

export async function setOnboardingStep(step: number): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STEP_KEY, String(Math.max(0, Math.min(1, step))));
}

export async function getLastPortal(): Promise<UserRole> {
  const value = await AsyncStorage.getItem(AUTH_PORTAL_KEY);
  return isUserRole(value) ? value : "traveler";
}

export async function setLastPortal(role: UserRole): Promise<void> {
  await AsyncStorage.setItem(AUTH_PORTAL_KEY, role);
}

export async function getRememberedEmail(role: UserRole): Promise<string> {
  const current = await AsyncStorage.getItem(`${EMAIL_PREFIX}:${role}`);
  if (current) return current;

  // Backward compatibility with the first authentication migration.
  return (await AsyncStorage.getItem("trava:auth:remembered-email")) ?? "";
}

export async function setRememberedEmail(role: UserRole, email: string | null): Promise<void> {
  const key = `${EMAIL_PREFIX}:${role}`;
  if (email?.trim()) {
    await AsyncStorage.setItem(key, email.trim().toLowerCase());
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function getAuthDraft(role: UserRole): Promise<AuthDraft> {
  const value = safeParse<Partial<AuthDraft>>(await AsyncStorage.getItem(`${DRAFT_PREFIX}:${role}`));
  return {
    fullName: typeof value?.fullName === "string" ? value.fullName : "",
    email: typeof value?.email === "string" ? value.email : "",
    acceptedTerms: value?.acceptedTerms === true,
  };
}

export async function setAuthDraft(role: UserRole, draft: AuthDraft): Promise<void> {
  await AsyncStorage.setItem(`${DRAFT_PREFIX}:${role}`, JSON.stringify(draft));
}

export async function clearAuthDraft(role: UserRole): Promise<void> {
  await AsyncStorage.removeItem(`${DRAFT_PREFIX}:${role}`);
}

export async function getPendingVerification(): Promise<PendingVerification | null> {
  const value = safeParse<Partial<PendingVerification>>(await AsyncStorage.getItem(PENDING_VERIFICATION_KEY));
  if (value && typeof value.email === "string" && isUserRole(value.role)) {
    return { email: value.email, role: value.role };
  }

  // Backward compatibility with the first authentication migration.
  const legacyEmail = await AsyncStorage.getItem("trava:auth:pending-verification");
  if (legacyEmail) return { email: legacyEmail, role: await getLastPortal() };
  return null;
}

export async function setPendingVerification(value: PendingVerification | null): Promise<void> {
  if (value?.email.trim()) {
    await AsyncStorage.setItem(
      PENDING_VERIFICATION_KEY,
      JSON.stringify({ email: value.email.trim().toLowerCase(), role: value.role }),
    );
    return;
  }
  await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
  await AsyncStorage.removeItem("trava:auth:pending-verification");
}

export async function setPendingOAuthRole(role: UserRole | null): Promise<void> {
  if (role) {
    await AsyncStorage.setItem(PENDING_OAUTH_ROLE_KEY, role);
    return;
  }
  await AsyncStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
}

export async function getPendingOAuthRole(): Promise<UserRole | null> {
  const value = await AsyncStorage.getItem(PENDING_OAUTH_ROLE_KEY);
  return isUserRole(value) ? value : null;
}
