import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

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
};
export type WorkspaceState = {
  activities: LocalActivity[];
  expenses: LocalExpense[];
  checklist: LocalChecklistItem[];
  documents: LocalDocument[];
  totalBudget: number;
};

const seed: WorkspaceState = {
  totalBudget: 90000,
  activities: [
    { id: "a1", dayNumber: 1, title: "Departure from Cebu", category: "flight", locationName: "Mactan–Cebu International Airport", detail: "CEB Terminal 2", latitude: 10.3075, longitude: 123.9794, startTime: "08:00", estimatedCost: 0 },
    { id: "a2", dayNumber: 1, title: "Arrival in Tokyo", category: "sightseeing", locationName: "Narita International Airport", detail: "NRT Terminal 1", latitude: 35.7720, longitude: 140.3929, startTime: "14:30", estimatedCost: 0 },
    { id: "a3", dayNumber: 1, title: "Check-in at Hotel", category: "stay", locationName: "Shinjuku Granbell Hotel", detail: "Shinjuku, Tokyo", latitude: 35.6952, longitude: 139.7037, startTime: "17:00", estimatedCost: 85 },
    { id: "a4", dayNumber: 1, title: "Dinner", category: "food", locationName: "Ichiran Ramen Shinjuku", detail: "Shinjuku, Tokyo", latitude: 35.6918, longitude: 139.7046, startTime: "19:30", estimatedCost: 18 },
  ],
  expenses: [
    { id: "e1", title: "Shibuya Dinner", category: "Food & Dining", amount: 3434, date: "Mar 22, 2025", shared: true, paid: true },
    { id: "e2", title: "Hotel", category: "Accommodation", amount: 30000, date: "Mar 21, 2025" },
    { id: "e3", title: "Flight Expense", category: "Transportation", amount: 9000, date: "Mar 20, 2025" },
    { id: "e4", title: "Taxi", category: "Transportation", amount: 234, date: "Mar 20, 2025" },
  ],
  checklist: [
    { id: "c1", title: "Chargers and power bank", category: "Packing", completed: false },
    { id: "c2", title: "Cash, cards, and travel budget", category: "Money", completed: false },
    { id: "c3", title: "Weather-ready clothes", category: "Packing", completed: false },
    { id: "c4", title: "Passport and valid IDs", category: "Documents", completed: true },
    { id: "c5", title: "Flight and hotel confirmations", category: "Travel", completed: true },
    { id: "c6", title: "Medicines and basic first aid", category: "Health", completed: true },
  ],
  documents: [
    { id: "d1", title: "Passport", type: "Identity", size: "1.2 MB", updated: "Mar 08" },
    { id: "d2", title: "Flight Ticket — PR2334", type: "Flight", size: "842 KB", updated: "Mar 09" },
    { id: "d3", title: "Shinjuku Granbell Booking", type: "Hotel", size: "644 KB", updated: "Mar 09" },
    { id: "d4", title: "Travel Insurance", type: "Insurance", size: "1.8 MB", updated: "Mar 09" },
  ],
};

function key(tripId: string) { return `trava:pixel-workspace:v1:${tripId || "local-japan"}`; }
function cloneSeed(): WorkspaceState { return JSON.parse(JSON.stringify(seed)) as WorkspaceState; }

let sequence = 0;
function makeId(prefix: "a" | "e" | "c" | "d") {
  sequence = (sequence + 1) % 1679616;
  const now = Date.now().toString(36);
  const seq = sequence.toString(36).padStart(4, "0");
  const random = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
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
    activities: ensureUniqueIds(Array.isArray(input?.activities) ? input.activities : fallback.activities, "a"),
    expenses: ensureUniqueIds(Array.isArray(input?.expenses) ? input.expenses : fallback.expenses, "e"),
    checklist: ensureUniqueIds(Array.isArray(input?.checklist) ? input.checklist : fallback.checklist, "c"),
    documents: ensureUniqueIds(Array.isArray(input?.documents) ? input.documents : fallback.documents, "d"),
  };
}

export function useLocalTripWorkspace(tripId: string) {
  const [state, setState] = useState<WorkspaceState>(() => cloneSeed());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    (async () => {
      try {
        const storageKey = key(tripId);
        const raw = await AsyncStorage.getItem(storageKey);
        const parsed = raw ? (JSON.parse(raw) as Partial<WorkspaceState>) : cloneSeed();
        const repaired = sanitizeWorkspace(parsed);
        if (alive) setState(repaired);
        // Persist the repaired form once so duplicate legacy IDs do not come back on refresh.
        await AsyncStorage.setItem(storageKey, JSON.stringify(repaired));
      } catch {
        const fallback = cloneSeed();
        if (alive) setState(fallback);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [tripId]);

  const commit = useCallback((updater: (current: WorkspaceState) => WorkspaceState) => {
    setState((current) => {
      const next = sanitizeWorkspace(updater(current));
      void AsyncStorage.setItem(key(tripId), JSON.stringify(next));
      return next;
    });
  }, [tripId]);

  const api = useMemo(() => ({
    setTotalBudget(value: number) { commit((s) => ({ ...s, totalBudget: Math.max(0, value) })); },
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
    addDocument(title: string, type = "Document") { commit((s) => ({ ...s, documents: [{ id: makeId("d"), title, type, size: "Local", updated: "Today" }, ...s.documents] })); },
    deleteDocument(id: string) { commit((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) })); },
    reset() {
      const fresh = cloneSeed();
      setState(fresh);
      void AsyncStorage.setItem(key(tripId), JSON.stringify(fresh));
    },
  }), [commit, tripId]);

  return { state, ready, ...api };
}
