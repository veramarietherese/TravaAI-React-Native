import { useCallback, useEffect, useMemo, useState } from "react";

import { loadChecklist } from "@/features/checklist/utils/checklist-storage";
import { listLocalDocuments } from "@/features/documents/utils/local-documents";
import { countUnreadRooms } from "@/features/chat/utils/trava-chat";

export interface TravelerHomePulseState {
  checklistTotal: number;
  checklistCompleted: number;
  documentCount: number;
  unreadMessages: number;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

export function useTravelerHomePulse(
  tripId: string | number | null | undefined,
  userId: string | undefined,
): TravelerHomePulseState {
  const [checklistTotal, setChecklistTotal] = useState(0);
  const [checklistCompleted, setChecklistCompleted] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedTripId = tripId === null || tripId === undefined ? null : String(tripId);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roomCountPromise = countUnreadRooms();
      if (!normalizedTripId || !userId) {
        setChecklistTotal(0);
        setChecklistCompleted(0);
        setDocumentCount(0);
        setUnreadMessages(await roomCountPromise);
        return;
      }

      const [checklistResult, documentsResult, unreadResult] = await Promise.allSettled([
        loadChecklist(normalizedTripId, userId),
        listLocalDocuments(normalizedTripId, userId),
        roomCountPromise,
      ]);

      if (checklistResult.status === "fulfilled") {
        setChecklistTotal(checklistResult.value.length);
        setChecklistCompleted(checklistResult.value.filter((item) => item.completed).length);
      }
      if (documentsResult.status === "fulfilled") setDocumentCount(documentsResult.value.length);
      if (unreadResult.status === "fulfilled") setUnreadMessages(unreadResult.value);

      const failures = [checklistResult, documentsResult, unreadResult].filter((result) => result.status === "rejected");
      if (failures.length) setError("Some traveler status data could not be refreshed.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to refresh traveler status.");
    } finally {
      setLoading(false);
    }
  }, [normalizedTripId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({
    checklistTotal,
    checklistCompleted,
    documentCount,
    unreadMessages,
    loading,
    error,
    refresh,
  }), [checklistCompleted, checklistTotal, documentCount, error, loading, refresh, unreadMessages]);
}
