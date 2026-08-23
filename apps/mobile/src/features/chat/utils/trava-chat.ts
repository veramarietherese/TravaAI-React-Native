import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSupabaseClient } from "@/lib/supabase";

export type TravaChatMessageKind = "text" | "package" | "system";

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
  lastMessage: string;
  updatedAt: string;
  packageMeta?: TravaChatPackageMeta;
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

export async function upsertRoomIndex(room: TravaChatRoomSummary): Promise<void> {
  const rooms = await readRoomIndex();
  const next = [room, ...rooms.filter((item) => item.roomId !== room.roomId)].slice(0, 100);
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(next));
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
