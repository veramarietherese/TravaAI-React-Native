import { useEffect, useRef } from "react";

import { getSupabaseClient } from "@/lib/supabase";

export function useRealtimeHomeNotifications(
  userId: string | undefined,
  refresh: () => Promise<void>,
  enabled = true,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!userId || !enabled) return;

    const supabase = getSupabaseClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void refreshRef.current(), 180);
    };

    const channel = supabase
      .channel(`trava-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    // Polling is an intentional fallback if the linked Supabase project has not
    // applied the Realtime publication migration yet or the socket is interrupted.
    const poll = setInterval(() => void refreshRef.current(), 30_000);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId]);
}
