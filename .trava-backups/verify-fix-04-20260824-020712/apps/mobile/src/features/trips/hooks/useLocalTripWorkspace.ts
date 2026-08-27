import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/api-client";
import { getSupabaseClient } from "@/lib/supabase";

type ActivityCategory = "flight" | "stay" | "food" | "sightseeing" | "transport" | "shopping" | "meeting" | "other";
export type LocalActivity = {
  id: string;
  dayNumber: number;
  title: string;
  category: ActivityCategory;
  locationName: string;
  detail?: string;
  latitude: number | null;
  longitude: number | null;
  startTime: string;
  estimatedCost: number;
};
export type LocalExpense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  shared?: boolean;
  paid?: boolean;
};
export type LocalChecklistItem = {
  id: string;
  title: string;
  category: "Packing" | "Money" | "Documents" | "Travel" | "Health" | "General";
  completed: boolean;
};
export type LocalDocument = {
  id: string;
  title: string;
  type: string;
  size: string;
  updated: string;
  mimeType?: string | null;
  uri?: string | null;
  dataUrl?: string | null;
  blobKey?: string | null;
};
export type WorkspaceState = {
  activities: LocalActivity[];
  expenses: LocalExpense[];
  checklist: LocalChecklistItem[];
  documents: LocalDocument[];
  totalBudget: number;
  dayCountOverride?: number;
};
export type WorkspaceSyncStatus = "local" | "connecting" | "live" | "offline";

const seed: WorkspaceState = {
  totalBudget: 0,
  dayCountOverride: 1,
  activities: [],
  expenses: [],
  checklist: [],
  documents: [],
};

const LEGACY_DEMO_ACTIVITY_IDS = new Set(["a1","a2","a3","a4"]);
const LEGACY_DEMO_EXPENSE_IDS = new Set(["e1","e2","e3","e4"]);
const LEGACY_DEMO_CHECKLIST_IDS = new Set(["c1","c2","c3","c4","c5","c6"]);

function removeLegacyDemoSeed(state: WorkspaceState): WorkspaceState {
  const activities = state.activities.filter((item) => !LEGACY_DEMO_ACTIVITY_IDS.has(item.id));
  const expenses = state.expenses.filter((item) => !LEGACY_DEMO_EXPENSE_IDS.has(item.id));
  const checklist = state.checklist.filter((item) => !LEGACY_DEMO_CHECKLIST_IDS.has(item.id));
  const onlyLegacy = activities.length === 0 && expenses.length === 0 && checklist.length === 0 && state.documents.length === 0;
  return { ...state, activities, expenses, checklist, totalBudget: onlyLegacy && state.totalBudget === 90000 ? 0 : state.totalBudget };
}

function isUuidTripId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function key(tripId: string) { return `trava:pixel-workspace:v2:${tripId || "local-japan"}`; }
function legacyKey(tripId: string) { return `trava:pixel-workspace:v1:${tripId || "local-japan"}`; }
function cloneSeed(): WorkspaceState { return JSON.parse(JSON.stringify(seed)) as WorkspaceState; }

let sequence = 0;
function makeId(prefix: "a" | "e" | "c" | "d") {
  sequence = (sequence + 1) % 1679616;
  const now = Date.now().toString(36);
  const seq = sequence.toString(36).padStart(4, "0");
  const random = Math.random().toString(36).slice(2, 9).padEnd(7, "0");
  return `${prefix}-${now}-${seq}-${random}`;
}
function ensureUniqueIds<T extends { id: string }>(items: T[], prefix: "a" | "e" | "c" | "d"): T[] {
  const seen = new Set<string>();
  return items.map((item) => {
    let nextId = typeof item.id === "string" ? item.id.trim() : "";
    while (!nextId || seen.has(nextId)) nextId = makeId(prefix);
    seen.add(nextId);
    return nextId === item.id ? item : { ...item, id: nextId };
  });
}
function sanitizeWorkspace(input: Partial<WorkspaceState> | null | undefined): WorkspaceState {
  const fallback = cloneSeed();
  const totalBudget = Number(input?.totalBudget);
  return {
    totalBudget: Number.isFinite(totalBudget) && totalBudget >= 0 ? totalBudget : fallback.totalBudget,
    dayCountOverride: Number.isFinite(Number(input?.dayCountOverride)) ? Math.max(1, Math.floor(Number(input?.dayCountOverride))) : (fallback.dayCountOverride ?? 1),
    activities: ensureUniqueIds(Array.isArray(input?.activities) ? input.activities : fallback.activities, "a"),
    expenses: ensureUniqueIds(Array.isArray(input?.expenses) ? input.expenses : fallback.expenses, "e"),
    checklist: ensureUniqueIds(Array.isArray(input?.checklist) ? input.checklist : fallback.checklist, "c"),
    documents: ensureUniqueIds(Array.isArray(input?.documents) ? input.documents : fallback.documents, "d"),
  };
}
function cloudSafe(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    documents: state.documents.map(({ dataUrl: _dataUrl, uri: _uri, blobKey: _blobKey, ...doc }) => doc),
  };
}

export function useLocalTripWorkspace(tripId: string) {
  const [state, setState] = useState<WorkspaceState>(() => cloneSeed());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<WorkspaceSyncStatus>("local");
  const [onlineCount, setOnlineCount] = useState(1);
  const stateRef = useRef(state);
  const revisionRef = useRef(0);
  const senderInstanceId = useId();
  const senderRef = useRef<string>(`anon-${senderInstanceId.replace(/:/g, "")}`);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let alive = true;
// eslint-disable-next-line react-hooks/set-state-in-effect -- trip changes intentionally reset readiness before asynchronous workspace hydration
    setReady(false);
    (async () => {
      try {
        const storageKey = key(tripId);
        let raw = await AsyncStorage.getItem(storageKey);
        if (!raw) raw = await AsyncStorage.getItem(legacyKey(tripId));
        const parsed = raw ? (JSON.parse(raw) as Partial<WorkspaceState>) : cloneSeed();
        let repaired = removeLegacyDemoSeed(sanitizeWorkspace(parsed));
        revisionRef.current = Date.now();

        if (isUuidTripId(tripId)) {
          try {
            const cloud = await apiRequest<{ data: { workspace?: Partial<WorkspaceState>; updatedAt?: string } }>(
              `/api/trips/${tripId}/workspace-state`,
            );
            if (cloud.data.workspace && Object.keys(cloud.data.workspace).length) {
              repaired = removeLegacyDemoSeed(sanitizeWorkspace(cloud.data.workspace));
              const cloudRevision = Date.parse(String(cloud.data.updatedAt ?? ""));
              if (Number.isFinite(cloudRevision)) revisionRef.current = cloudRevision;
            }
          } catch {
            // Offline/API unavailable: the locally persisted copy remains authoritative until reconnect.
          }
        }

        if (alive) setState(repaired);
        await AsyncStorage.setItem(storageKey, JSON.stringify(repaired));
      } catch {
        if (alive) setState(cloneSeed());
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [tripId]);

  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null = null;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (disposed || !data.user || !isUuidTripId(tripId)) { setSyncStatus("local"); return; }
        senderRef.current = data.user.id;
        setSyncStatus("connecting");
        channel = supabase.channel(`trava-trip-live:${tripId}`, { config: { broadcast: { self: false }, presence: { key: data.user.id } } });
        channelRef.current = channel;
        channel
          .on("broadcast", { event: "workspace-request" }, ({ payload }) => {
            if (payload?.sender === senderRef.current) return;
            void channel?.send({ type: "broadcast", event: "workspace-state", payload: { sender: senderRef.current, revision: revisionRef.current, state: cloudSafe(stateRef.current) } });
          })
          .on("broadcast", { event: "workspace-state" }, ({ payload }) => {
            if (!payload || payload.sender === senderRef.current || !payload.state) return;
            const revision = Number(payload.revision || 0);
            if (revision < revisionRef.current) return;
            const incoming = sanitizeWorkspace(payload.state as Partial<WorkspaceState>);
            // Keep local-only file bytes/URIs while applying shared metadata.
            const localDocs = new Map(stateRef.current.documents.map((doc) => [doc.id, doc]));
            incoming.documents = incoming.documents.map((doc) => ({ ...doc, uri: localDocs.get(doc.id)?.uri ?? doc.uri, dataUrl: localDocs.get(doc.id)?.dataUrl ?? doc.dataUrl, blobKey: localDocs.get(doc.id)?.blobKey ?? doc.blobKey }));
            revisionRef.current = revision || Date.now();
            applyingRemoteRef.current = true;
            stateRef.current = incoming;
            setState(incoming);
            void AsyncStorage.setItem(key(tripId), JSON.stringify(incoming)).finally(() => { applyingRemoteRef.current = false; });
          })
          .on("presence", { event: "sync" }, () => {
            setSyncStatus("live");
            const presence = channel?.presenceState() ?? {};
            const count = Object.values(presence).reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0);
            setOnlineCount(Math.max(1, count));
          });

        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            setSyncStatus("live");
            await channel?.track({ user_id: data.user.id, online_at: new Date().toISOString() });
            await channel?.send({ type: "broadcast", event: "workspace-request", payload: { sender: data.user.id } });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setSyncStatus("offline");
          }
        });
      } catch {
        if (!disposed) setSyncStatus("offline");
      }
    })();
    return () => {
      disposed = true;
      if (channel) void getSupabaseClient().removeChannel(channel);
      channelRef.current = null;
      setOnlineCount(1);
    };
  }, [tripId]);

  const commit = useCallback((updater: (current: WorkspaceState) => WorkspaceState) => {
    setState((current) => {
      const next = sanitizeWorkspace(updater(current));
      const revision = Date.now();
      revisionRef.current = revision;
      stateRef.current = next;
      void AsyncStorage.setItem(key(tripId), JSON.stringify(next));
      if (!applyingRemoteRef.current && channelRef.current) {
        void channelRef.current.send({ type: "broadcast", event: "workspace-state", payload: { sender: senderRef.current, revision, state: cloudSafe(next) } });
      }
      if (!applyingRemoteRef.current && isUuidTripId(tripId)) {
        void apiRequest(`/api/trips/${tripId}/workspace-state`, {
          method: "PATCH",
          body: JSON.stringify({ workspace: cloudSafe(next) }),
        }).catch(() => undefined);
      }
      return next;
    });
  }, [tripId]);

  const api = useMemo(() => ({
    setTotalBudget(value: number) { commit((s) => ({ ...s, totalBudget: Math.max(0, value) })); },
    setDayCount(value: number) { commit((s) => ({ ...s, dayCountOverride: Math.max(1, Math.floor(value)) })); },
    addExpense(expense: Omit<LocalExpense, "id">) { commit((s) => ({ ...s, expenses: [{ ...expense, id: makeId("e") }, ...s.expenses] })); },
    updateExpense(id: string, patch: Partial<LocalExpense>) { commit((s) => ({ ...s, expenses: s.expenses.map((e) => e.id === id ? { ...e, ...patch } : e) })); },
    deleteExpense(id: string) { commit((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) })); },
    addChecklist(title: string, category: LocalChecklistItem["category"]) { commit((s) => ({ ...s, checklist: [{ id: makeId("c"), title, category, completed: false }, ...s.checklist] })); },
    toggleChecklist(id: string) { commit((s) => ({ ...s, checklist: s.checklist.map((i) => i.id === id ? { ...i, completed: !i.completed } : i) })); },
    updateChecklist(id: string, patch: Partial<LocalChecklistItem>) { commit((s) => ({ ...s, checklist: s.checklist.map((i) => i.id === id ? { ...i, ...patch } : i) })); },
    deleteChecklist(id: string) { commit((s) => ({ ...s, checklist: s.checklist.filter((i) => i.id !== id) })); },
    addActivity(activity: Omit<LocalActivity, "id">) { commit((s) => ({ ...s, activities: [...s.activities, { ...activity, id: makeId("a") }] })); },
    updateActivity(id: string, patch: Partial<LocalActivity>) { commit((s) => ({ ...s, activities: s.activities.map((a) => a.id === id ? { ...a, ...patch } : a) })); },
    deleteActivity(id: string) { commit((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) })); },
    addDocument(input: string | Omit<LocalDocument, "id" | "updated">, type = "Document", size = "Local") {
      const doc = typeof input === "string" ? { title: input, type, size } : input;
      commit((s) => ({ ...s, documents: [{ id: makeId("d"), updated: "Today", ...doc }, ...s.documents] }));
    },
    updateDocument(id: string, patch: Partial<LocalDocument>) { commit((s) => ({ ...s, documents: s.documents.map((d) => d.id === id ? { ...d, ...patch, updated: "Today" } : d) })); },
    deleteDocument(id: string) { commit((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) })); },
    reset() { const fresh = cloneSeed(); setState(fresh); stateRef.current = fresh; void AsyncStorage.setItem(key(tripId), JSON.stringify(fresh)); },
  }), [commit, tripId]);

  return { state, ready, syncStatus, onlineCount, ...api };
}
