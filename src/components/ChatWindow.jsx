// src/components/ChatWindow.jsx
import React, { useEffect, useState, useRef } from "react";
import "./ChatWindow.css";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../auth/AuthContext"; // Adjust path if needed

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export default function ChatWindow({ room, onGoBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const { user } = useAuth();
  const currentUserId = user?.id || user?.user_id;

  // Ref to automatically scroll to the bottom on new messages
  const streamBottomRef = useRef(null);

  // Auto scroll to bottom whenever the messages array updates
  useEffect(() => {
    streamBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!room?.room_id) return;

    // 1. Fetch historical messages for this specific room
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", room.room_id)
        .order("created_at", { ascending: true });

      if (error) console.error("Error loading messages:", error);
      else setMessages(data || []);
    };

    fetchMessages();

    // 2. Set up a real-time subscription for incoming messages
    const channel = supabase
      .channel(`room-${room.room_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${room.room_id}`,
        },
        (payload) => {
          // Append the new message to our local state instantly
          setMessages((prev) => [...prev, payload.new]);
        },
      )
      .subscribe();

    // Cleanup subscription when the room is closed or changed
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.room_id]);

  // 3. Handle sending a new text message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    const messageToSend = newMessage.trim();
    setNewMessage(""); // Optimistically clear input field
    console.log("roomId: ", room.room_id);
    const { error } = await supabase.from("messages").insert({
      room_id: room.room_id,
      sender_id: currentUserId,
      message_text: messageToSend,
    });

    if (error) {
      console.error("Error sending message:", error);
    }
  };

  // Find the other participant's name for the header title banner
  const otherParticipant = room.chatroom_participants?.find(
    (p) => p.user_id !== currentUserId,
  );
  const titleName = otherParticipant?.users?.full_name || "Chat Room";

  return (
    <div className="chat-window-container">
      {/* Header with back button */}
      <header className="chat-header">
        <button className="back-btn" onClick={onGoBack}>
          ← Back
        </button>
        <h3>{titleName}</h3>
      </header>

      {/* Message Stream area */}
      <div className="messages-stream">
        {messages.length === 0 ? (
          <p className="system-note">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            console.log("msg: ", msg);
            return (
              <div
                key={msg.message_id || msg.id}
                className={`message-bubble-wrapper ${isMe ? "me" : "them"}`}
              >
                <div className="message-bubble">
                  <p className="message-text">{msg.message_text}</p>
                  <span className="message-timestamp">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {/* Invisible anchor div for the auto-scroller */}
        <div ref={streamBottomRef} />
      </div>

      {/* Input section */}
      <form className="chat-footer" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
