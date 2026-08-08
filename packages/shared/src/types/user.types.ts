export type UserRole = "traveler" | "agency";

export interface UserProfile {
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
