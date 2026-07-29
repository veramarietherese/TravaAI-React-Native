export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? ""
} as const;
