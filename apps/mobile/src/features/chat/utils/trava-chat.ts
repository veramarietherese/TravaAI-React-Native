import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSupabaseClient } from "@/lib/supabase";

export type TravaChatMessageKind = "text" | "package" | "system";
export type TravaChatContextType = "agency" | "booking" | "package" | "itinerary";

export interface TravaChatPackageMeta {
  packageId: string;
  packageTitle: string;
  packagePrice: string;
  currencyCode: string;
  packageDays: string;
  packageNights: string;
  destination: string;
  packageImage?: string;
}

export interface TravaChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  kind: TravaChatMessageKind;
  packageMeta?: TravaChatPackageMeta;
}

export interface TravaChatRoomSummary {
  roomId: string;
  agencyId?: string;
  agencyName: string;
  travelerId?: string;
  travelerName?: string;
  contactName?: string;
  lastMessage: string;
  updatedAt: string;
  packageMeta?: TravaChatPackageMeta;
  contextType?: TravaChatContextType;
  contextLabel?: string;
  bookingStatus?: string;
  isPinned?: boolean;
  unreadCount?: number;
  lastReadAt?: string;
}

const ROOMS_KEY = "trava-chat-v4:rooms";
const roomKey = (roomId: string) => `trava-chat-v4:room:${roomId}`;

function parseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export async function readRoomMessages(roomId: string): Promise<TravaChatMessage[]> {
  return parseArray<TravaChatMessage>(await AsyncStorage.getItem(roomKey(roomId)));
}

export async function writeRoomMessages(roomId: string, messages: TravaChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(roomKey(roomId), JSON.stringify(messages.slice(-300)));
}

export async function readRoomIndex(): Promise<TravaChatRoomSummary[]> {
  const rooms = parseArray<TravaChatRoomSummary>(await AsyncStorage.getItem(ROOMS_KEY));
  return rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Upserts while preserving inbox-only metadata (read state, pinning and context)
 * that older ChatScreen callers do not know about yet.
 */
export async function upsertRoomIndex(room: TravaChatRoomSummary): Promise<void> {
  const rooms = await readRoomIndex();
  const previous = rooms.find((item) => item.roomId === room.roomId);
  const merged: TravaChatRoomSummary = {
    ...previous,
    ...room,
    contextType:
      room.contextType ??
      previous?.contextType ??
      (room.packageMeta || previous?.packageMeta ? "package" : "agency"),
  };
  const next = [merged, ...rooms.filter((item) => item.roomId !== room.roomId)].slice(0, 100);
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(next));
}

export async function markRoomRead(roomId: string): Promise<void> {
  const rooms = await readRoomIndex();
  const now = new Date().toISOString();
  const next = rooms.map((room) =>
    room.roomId === roomId
      ? { ...room, unreadCount: 0, lastReadAt: now }
      : room,
  );
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(next));
}

export async function markRoomUnread(roomId: string): Promise<void> {
  const rooms = await readRoomIndex();
  const next = rooms.map((room) =>
    room.roomId === roomId
      ? { ...room, unreadCount: Math.max(1, room.unreadCount ?? 0) }
      : room,
  );
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(next));
}

export async function toggleRoomPinned(roomId: string): Promise<void> {
  const rooms = await readRoomIndex();
  const next = rooms.map((room) =>
    room.roomId === roomId ? { ...room, isPinned: !room.isPinned } : room,
  );
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(next));
}

export function roomUnreadCount(room: TravaChatRoomSummary): number {
  return Math.max(0, Math.floor(room.unreadCount ?? 0));
}

export function roomContextLabel(room: TravaChatRoomSummary): string {
  if (room.contextLabel?.trim()) return room.contextLabel.trim();
  if (room.contextType === "booking" && room.packageMeta) {
    return `Booking • ${room.packageMeta.packageTitle}`;
  }
  if (room.contextType === "itinerary" && room.packageMeta) {
    return `Shared itinerary • ${room.packageMeta.packageTitle}`;
  }
  if (room.packageMeta) return `Shared package • ${room.packageMeta.packageTitle}`;
  return "Agency conversation";
}

export async function countUnreadRooms(): Promise<number> {
  const rooms = await readRoomIndex();
  return rooms.reduce((sum, room) => sum + roomUnreadCount(room), 0);
}

export function makeMessage(input: Omit<TravaChatMessage, "id" | "createdAt">): TravaChatMessage {
  return {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
}

export function appendUnique(messages: TravaChatMessage[], incoming: TravaChatMessage): TravaChatMessage[] {
  if (messages.some((item) => item.id === incoming.id)) return messages;
  return [...messages, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-300);
}

export function createRoomRealtime(
  roomId: string,
  onMessage: (message: TravaChatMessage) => void,
) {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`trava-chat-v4:${roomId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "message" }, ({ payload }) => {
      const message = payload as TravaChatMessage;
      if (message?.roomId === roomId && message?.id) onMessage(message);
    })
    .subscribe();

  return {
    async send(message: TravaChatMessage) {
      await channel.send({ type: "broadcast", event: "message", payload: message });
    },
    async close() {
      await supabase.removeChannel(channel);
    },
  };
}

export function looksLikePaymentScam(text: string): boolean {
  const normalized = text.toLowerCase();
  const risky = [
    "send money",
    "bank transfer",
    "wire transfer",
    "otp",
    "one-time password",
    "password",
    "gcash",
    "maya account",
    "crypto",
    "gift card",
    "outside trava",
    "off-platform payment",
  ];
  return risky.some((term) => normalized.includes(term));
}
