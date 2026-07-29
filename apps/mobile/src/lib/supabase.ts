import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { env } from "./env";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  client ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  return client;
}
