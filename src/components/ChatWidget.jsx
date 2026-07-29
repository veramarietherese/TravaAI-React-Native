import { useState, useRef, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import "./Chatwidget.css";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: input }]);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <>
      <button
        className="chat-fab"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <X size={24} strokeWidth={2.2} /> : <MessageCircle size={24} strokeWidth={2.2} />}
        {!isOpen && <span className="chat-fab__dot" />}
      </button>

      <div className={`chat-panel ${isOpen ? "chat-panel--open" : ""}`}>
        <div className="chat-panel__header">
          <span>Assistant</span>
        </div>

        <div className="chat-panel__messages" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="chat-panel__empty">Ask me anything to get started.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
              {m.text}
            </div>
          ))}
        </div>

        <div className="chat-panel__input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </>
  );
}