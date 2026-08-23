import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface ChatRoomSummary {
  id: string;
  tripId: string | null;
  title: string;
  updatedAt: string;
  lastMessage: string | null;
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    senderId: String(row.sender_id),
    body: String(row.body ?? ""),
    attachmentUrl: typeof row.attachment_url === "string" ? row.attachment_url : null,
    createdAt: String(row.created_at),
  };
}

export async function ensureTripChatRoom(tripId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("ensure_trip_chat_room", { p_trip_id: tripId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Unable to prepare trip chat.");
  return String(data);
}

export async function listMyChatRooms(): Promise<ChatRoomSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_my_chat_rooms");
  if (error) throw new Error(error.message);
  return (data ?? []).map((room: Record<string, unknown>) => ({
    id: String(room.id),
    tripId: room.trip_id ? String(room.trip_id) : null,
    title: String(room.title || "TRAVA chat"),
    updatedAt: String(room.updated_at),
    lastMessage: typeof room.last_message === "string" ? room.last_message : null,
  }));
}

export async function listMessages(roomId: string): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,room_id,sender_id,body,attachment_url,created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapMessage(row as Record<string, unknown>));
}

export async function sendMessage(roomId: string, body: string, attachmentUrl?: string | null): Promise<ChatMessage> {
  const supabase = getSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in to send messages.");
  const clean = body.trim();
  if (!clean && !attachmentUrl) throw new Error("Message is empty.");

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: auth.user.id, body: clean, attachment_url: attachmentUrl ?? null })
    .select("id,room_id,sender_id,body,attachment_url,created_at")
    .single();
  if (error) throw new Error(error.message);
  return mapMessage(data as Record<string, unknown>);
}

export async function getRoomTitle(roomId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("chat_rooms").select("title").eq("id", roomId).single();
  if (error) return "Trip Chat";
  return String(data?.title || "Trip Chat");
}

export function subscribeToRoom(roomId: string, onMessage: (message: ChatMessage) => void): RealtimeChannel {
  const supabase = getSupabaseClient();
  return supabase
    .channel(`chat-room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
      (payload) => onMessage(mapMessage(payload.new as Record<string, unknown>)),
    )
    .subscribe();
}
