// src/components/UserChatScreen.jsx
import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, MessageCircle, RefreshCw, X } from "lucide-react";
import ChatroomsList from "../components/ChatroomsList";
import ChatWindow from "../components/ChatWindow";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../auth/AuthContext";
import "./UserChatScreen.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export default function UserChatScreen({
  onBack,
  initialInquiry = null,
  inquiryContext = null,
}) {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [initialMessageText, setInitialMessageText] = useState("");
  const { user } = useAuth();
  const currentUserId = user?.id || user?.user_id;

  // 1. Handle incoming package / agency inquiries automatically
  const handleInquiryAutoStart = useCallback(
    async (inquiry) => {
      if (!currentUserId || !inquiry) return;

      const item = inquiry.item || {};
      const targetUserId =
        item.agency_id || item.owner_user_id || inquiry.agency?.owner_user_id;

      if (!targetUserId) {
        console.warn("Inquiry object missing target user ID:", inquiry);
        return;
      }

      const packageTitle = inquiry.type === "tour" ? item.title : null;
      const defaultText = packageTitle
        ? `Hi! I’m interested in the "${packageTitle}" package. Could you share availability and booking details?`
        : `Hi! I’d like to inquire about your travel services.`;

      try {
        // Step A: Check if a chatroom already exists between these 2 users
        const { data: myRooms } = await supabase
          .from("chatroom_participants")
          .select("room_id")
          .eq("user_id", currentUserId);

        const myRoomIds = (myRooms || []).map((r) => r.room_id);

        let existingRoomId = null;

        if (myRoomIds.length > 0) {
          const { data: commonRooms } = await supabase
            .from("chatroom_participants")
            .select("room_id")
            .eq("user_id", targetUserId)
            .in("room_id", myRoomIds);

          existingRoomId = commonRooms?.[0]?.room_id || null;
        }

        if (existingRoomId) {
          // Fetch existing room payload
          const { data: existingRoomData } = await supabase
            .from("chat_rooms")
            .select(
              `
              room_id,
              created_at,
              chatroom_participants (
                user_id,
                user_type,
                users ( full_name )
              )
            `,
            )
            .eq("room_id", existingRoomId)
            .single();

          setSelectedRoom(existingRoomData);
          setInitialMessageText(""); // Existing chat, no need to auto-fill draft
          return;
        }

        // Step B: Create a brand new room if none exists
        const generatedRoomId = crypto.randomUUID();

        const [{ data: myProfile }, { data: targetProfile }] =
          await Promise.all([
            supabase
              .from("users")
              .select("user_type, full_name")
              .eq("user_id", currentUserId)
              .maybeSingle(),
            supabase
              .from("users")
              .select("user_type, full_name")
              .eq("user_id", targetUserId)
              .maybeSingle(),
          ]);

        const myUserType = myProfile?.user_type || "traveler";
        const targetUserType = targetProfile?.user_type || "traveler";

        const { data: newRoom, error: roomError } = await supabase
          .from("chat_rooms")
          .insert([{ room_id: generatedRoomId, trip_id: null }])
          .select()
          .single();

        if (roomError) throw roomError;

        await supabase.from("chatroom_participants").insert([
          {
            room_id: generatedRoomId,
            user_id: currentUserId,
            user_type: myUserType,
          },
          {
            room_id: generatedRoomId,
            user_id: targetUserId,
            user_type: targetUserType,
          },
        ]);

        const newRoomPayload = {
          room_id: generatedRoomId,
          created_at: newRoom?.created_at || new Date().toISOString(),
          chatroom_participants: [
            { user_id: currentUserId, user_type: myUserType, users: myProfile },
            {
              user_id: targetUserId,
              user_type: targetUserType,
              users: targetProfile || {
                full_name: item.name || "Travel Agency",
              },
            },
          ],
          messages: [],
        };

        setSelectedRoom(newRoomPayload);
        setInitialMessageText(defaultText); // Draft inquiry prompt
      } catch (err) {
        console.error("Failed to auto-start inquiry room:", err);
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    const activeInquiry = initialInquiry || inquiryContext;
    if (activeInquiry) {
      handleInquiryAutoStart(activeInquiry);
    }
  }, [initialInquiry, inquiryContext, handleInquiryAutoStart]);

  return (
    <section
      className={`agency-chat-screen ${selectedRoom ? "thread-open" : ""}`}
    >
      {/* LEFT SIDE: Conversations List & Search */}
      <aside className="agency-chat-sidebar">
        <header className="agency-chat-sidebar-header">
          <div>
            <h1>Messages</h1>
            <p>Direct Chat & Inquiries</p>
          </div>

          {onBack && (
            <button
              type="button"
              className="agency-chat-close-screen"
              onClick={onBack}
              aria-label="Close Messages"
            >
              <X size={19} />
            </button>
          )}
        </header>

        <ChatroomsList
          onSelectRoom={(room) => {
            setSelectedRoom(room);
            setInitialMessageText(""); // Clear pre-filled text on manual select
          }}
        />
      </aside>

      {/* RIGHT SIDE: Active Chat Stream */}
      <main className="agency-chat-thread">
        {selectedRoom ? (
          <ChatWindow
            room={selectedRoom}
            initialDraft={initialMessageText}
            onGoBack={() => {
              setSelectedRoom(null);
              setInitialMessageText("");
            }}
          />
        ) : (
          <div className="agency-chat-empty">
            <div className="agency-chat-empty-icon">
              <MessageCircle size={31} />
            </div>
            <h2>Select a conversation</h2>
            <p>
              Choose a thread from the left or search for people by name to
              begin chatting.
            </p>
          </div>
        )}
      </main>
    </section>
  );
}
