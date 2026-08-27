import { useEffect, useRef } from "react";

import { getSupabaseClient } from "@/lib/supabase";

let notificationChannelSequence = 0;

export function useRealtimeHomeNotifications(
  userId: string | undefined,
  refresh: () => Promise<void>,
  enabled = true,
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!userId || !enabled) return;

    const supabase = getSupabaseClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const safeRefresh = () => {
      if (disposed) return;
      void refreshRef.current().catch(() => undefined);
    };

    const scheduleRefresh = () => {
      if (disposed) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(safeRefresh, 180);
    };

    // Each effect execution gets its own topic. This prevents React StrictMode,
    // kept-mounted tabs, or an async removeChannel() cleanup from reusing an
    // already-subscribed Supabase channel.
    notificationChannelSequence += 1;
    const channelTopic = `trava-notifications:${userId}:${notificationChannelSequence}`;

    const channel = supabase.channel(channelTopic);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      scheduleRefresh,
    );

    channel.subscribe((status) => {
      // If cleanup happened while the socket was still joining, remove the
      // channel as soon as Supabase reports it subscribed.
      if (disposed && status === "SUBSCRIBED") {
        void supabase.removeChannel(channel);
      }
    });

    // Realtime is primary. Polling keeps notifications usable if publication,
    // connectivity, or the websocket is temporarily unavailable.
    const poll = setInterval(safeRefresh, 30_000);

    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId]);
}
