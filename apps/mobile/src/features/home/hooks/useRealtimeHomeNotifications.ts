import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
let notificationChannelSequence = 0;
export function useRealtimeHomeNotifications(userId: string | undefined, refresh: () => Promise<void>, enabled = true) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!userId || !enabled) return;
    const supabase = getSupabaseClient(); let debounce: ReturnType<typeof setTimeout> | null = null; let disposed = false;
    const safeRefresh = () => { if (!disposed) void refreshRef.current().catch(() => undefined); };
    const scheduleRefresh = () => { if (disposed) return; if (debounce) clearTimeout(debounce); debounce = setTimeout(safeRefresh, 180); };
    notificationChannelSequence += 1;
    const channel = supabase.channel(`trava-notifications:${userId}:${notificationChannelSequence}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, scheduleRefresh);
    channel.subscribe((status) => { if (disposed && status === "SUBSCRIBED") void supabase.removeChannel(channel); });
    const poll = setInterval(safeRefresh, 30_000);
    return () => { disposed = true; if (debounce) clearTimeout(debounce); clearInterval(poll); void supabase.removeChannel(channel); };
  }, [enabled, userId]);
}
