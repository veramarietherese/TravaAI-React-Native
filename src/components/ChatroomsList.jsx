// src/components/ChatroomsList.jsx
import React, { useState, useEffect } from "react";
import "./ChatroomsList.css";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../auth/AuthContext";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

const fetchChatRooms = async () => {
  const { data, error } = await supabase
    .from("chat_rooms")
    .select(
      `
      room_id,
      created_at,
      chatroom_participants (
        user_id,
        user_type,
        users (
          full_name 
        )
      ),
      messages (
        message_text,
        sender_id,
        created_at
      )
    `,
    )
    .order("created_at", { foreignTable: "messages", ascending: false })
    .limit(1, { foreignTable: "messages" });

  if (error) {
    console.error("Error fetching rooms:", error);
    return [];
  }
  return data;
};

export default function ChatroomsList({ onSelectRoom }) {
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const { user } = useAuth();
  const currentUserId = user?.id || user?.user_id;

  // 1. Load active chat rooms
  useEffect(() => {
    const loadRooms = async () => {
      const roomsData = await fetchChatRooms();
      console.log("Raw Database Rooms:", roomsData);

      if (!roomsData) return;

      // 1. Filter: Only keep rooms where YOU are actually a participant
      const myActiveRooms = roomsData.filter((room) =>
        room.chatroom_participants?.some((p) => p.user_id === currentUserId),
      );

      // 2. Deduplicate by the OTHER participant's ID
      const uniquePeopleMap = new Map();

      myActiveRooms.forEach((room) => {
        const participants = room.chatroom_participants || [];
        // Find the companion in this room
        const otherParticipant = participants.find(
          (p) => p.user_id !== currentUserId,
        );

        if (otherParticipant?.user_id) {
          // If we haven't added a chat room for this person yet, save it
          if (!uniquePeopleMap.has(otherParticipant.user_id)) {
            uniquePeopleMap.set(otherParticipant.user_id, room);
          } else {
            // Optional: If we find an older/empty room duplicate, keep the one with the newer message
            const existingRoom = uniquePeopleMap.get(otherParticipant.user_id);
            const existingMsgTime = new Date(
              existingRoom.messages?.[0]?.created_at || existingRoom.created_at,
            );
            const currentMsgTime = new Date(
              room.messages?.[0]?.created_at || room.created_at,
            );

            if (currentMsgTime > existingMsgTime) {
              uniquePeopleMap.set(otherParticipant.user_id, room);
            }
          }
        }
      });

      const cleanRooms = Array.from(uniquePeopleMap.values());
      console.log("Cleaned Unique Rooms per Person:", cleanRooms);

      setRooms(cleanRooms);
    };

    if (currentUserId) {
      loadRooms();
    }
  }, [currentUserId]);

  // 2. Query the global users table based on user input
  useEffect(() => {
    const searchGlobalUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("user_id, full_name")
        .ilike("full_name", `%${searchQuery}%`) // Case-insensitive partial match
        .not("user_id", "eq", currentUserId) // Don't show yourself in search
        .limit(10);

      if (error) {
        console.error("Error searching users:", error);
      } else {
        setSearchResults(data || []);
      }
    };

    // Simple debounce to avoid spamming network requests on every keystroke
    const delayDebounce = setTimeout(() => {
      searchGlobalUsers();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, currentUserId]);

  // 3. Resolve room destination when clicking a global search result
  const handleSelectUser = async (targetUser) => {
    // Check if a chat room already exists between current user and target user
    const existingRoom = rooms.find((room) =>
      room.chatroom_participants?.some((p) => p.user_id === targetUser.user_id),
    );

    if (existingRoom) {
      onSelectRoom(existingRoom);
      return;
    }

    try {
      const generatedRoomId = crypto.randomUUID();

      // 1. Fetch YOUR user_type from your own active session rows or profile data info
      const { data: currentUserProfile, error: myProfileError } = await supabase
        .from("users")
        .select("user_type")
        .eq("user_id", currentUserId)
        .single();

      if (myProfileError) throw myProfileError;
      const myUserType = currentUserProfile?.user_type;

      // 2. Fetch the TARGET user's type from the users table database record
      const { data: targetUserProfile, error: targetProfileError } =
        await supabase
          .from("users")
          .select("user_type")
          .eq("user_id", targetUser.user_id)
          .single();

      if (targetProfileError) throw targetProfileError;
      const targetUserType = targetUserProfile?.user_type;

      // 3. Create the chat room instance
      const { data: newRoom, error: roomError } = await supabase
        .from("chat_rooms")
        .insert([{ room_id: generatedRoomId, trip_id: null }])
        .select()
        .single();

      if (roomError) throw roomError;

      // 4. Insert both participants with their correct respective user_types!
      const { error: participantError } = await supabase
        .from("chatroom_participants")
        .insert([
          {
            room_id: generatedRoomId,
            user_id: currentUserId,
            user_type: myUserType,
          },
          {
            room_id: generatedRoomId,
            user_id: targetUser.user_id,
            user_type: targetUserType,
          },
        ]);

      if (participantError) throw participantError;

      // 5. Build mock UI wrapper payload state to instantly load selection screen
      const formattedRoom = {
        room_id: generatedRoomId,
        created_at: newRoom?.created_at || new Date().toISOString(),
        chatroom_participants: [
          { user_id: currentUserId, user_type: myUserType },
          {
            user_id: targetUser.user_id,
            user_type: targetUserType,
            users: { full_name: targetUser.full_name },
          },
        ],
        messages: [],
      };

      onSelectRoom(formattedRoom);
    } catch (err) {
      console.error(
        "Failed to create direct message room with user types:",
        err,
      );
    }
  };

  return (
    <div className="list-container">
      <header className="list-header">
          <div className="search-bar-container">
          <input
            type="text"
            className="room-search-input"
            placeholder="Search people by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="rooms-list">
        {/* GLOBAL SEARCH RESULTS MODE */}
        {searchQuery.trim() !== "" ? (
          searchResults.length > 0 ? (
            searchResults.map((targetUser) => {
              // Check if we ALREADY have an active conversation row for this search entry
              const existingRoom = rooms.find((room) =>
                room.chatroom_participants?.some(
                  (p) => p.user_id === targetUser.user_id,
                ),
              );

              let lastMessageText = "Click to start a brand new conversation";
              let displayTimestamp = null;

              // If known, map out live historical data structures inside search loop
              if (existingRoom) {
                const lastMessageObj = existingRoom.messages?.[0];
                let prefix = "";
                if (lastMessageObj) {
                  prefix =
                    lastMessageObj.sender_id === currentUserId
                      ? "You: "
                      : "Them: ";
                }
                lastMessageText = lastMessageObj
                  ? `${prefix}${lastMessageObj.message_text}`
                  : "No messages yet. Say hello!";
                displayTimestamp =
                  lastMessageObj?.created_at || existingRoom.created_at;
              }

              return (
                <button
                  key={targetUser.user_id}
                  className="room-card"
                  onClick={() => handleSelectUser(targetUser)}
                >
                  <div className="room-avatar">
                    {targetUser.full_name?.charAt(0) || "U"}
                  </div>
                  <div className="room-info">
                    <div className="room-top">
                      <span className="room-name">{targetUser.full_name}</span>
                      {displayTimestamp && (
                        <span className="room-time">
                          {new Date(displayTimestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="room-preview">{lastMessageText}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="system-note">
              No users found matching "{searchQuery}"
            </p>
          )
        ) : (
          /* STANDARD ACTIVE CONVERSATION THREADS MODE */
          rooms &&
          rooms.map((room) => {
            if (!room) return null;

            const participants = room.chatroom_participants || [];
            const otherParticipant = participants.find(
              (p) => p.user_id !== currentUserId,
            );

            const otherUserName = otherParticipant?.users?.full_name;
            const displayName = otherUserName || "Direct Message";

            const lastMessageObj = room.messages?.[0];
            let prefix = "";
            if (lastMessageObj) {
              prefix =
                lastMessageObj.sender_id === currentUserId ? "You: " : "Them: ";
            }

            const lastMessageText = lastMessageObj
              ? `${prefix}${lastMessageObj.message_text}`
              : "No messages yet. Say hello!";

            const displayTimestamp =
              lastMessageObj?.created_at || room.created_at;

            return (
              <button
                key={room.room_id}
                className="room-card"
                onClick={() => onSelectRoom(room)}
              >
                <div className="room-avatar">{displayName.charAt(0)}</div>

                <div className="room-info">
                  <div className="room-top">
                    <span className="room-name">{displayName}</span>
                    <span className="room-time">
                      {displayTimestamp
                        ? new Date(displayTimestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </span>
                  </div>
                  <p className="room-preview">{lastMessageText}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
