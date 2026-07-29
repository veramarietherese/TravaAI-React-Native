import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  CircleStop,
  Mic,
  MoreHorizontal,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import "./AIChatScreen.css";
import { supabase } from "../auth/supabaseClient";

const STORAGE_PREFIX = "trava-ai-conversation";

const DEFAULT_CARDS = [
  {
    id: "paris",
    title: "Paris, France",
    subtitle: "5 days • Romantic",
    priceLabel: "Plan from ₱58k",
    tag: "Best for romance",
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "prague",
    title: "Prague, Czechia",
    subtitle: "5 days • Culture",
    priceLabel: "Plan from ₱49k",
    tag: "Most popular",
    image:
      "https://images.unsplash.com/photo-1541849546-216549ae216d?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "amalfi",
    title: "Amalfi Coast",
    subtitle: "5 days • Coastal",
    priceLabel: "Plan from ₱67k",
    tag: "Coastal view",
    image:
      "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?q=85&w=900&auto=format&fit=crop",
  },
];

const DEFAULT_QUICK_PROMPTS = [
  "Plan a solo trip to Japan",
  "Best beaches in Asia",
  "Budget trip to Switzerland",
  "Visa requirements for Bali",
];

function createId(prefix = "message") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function getUserName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Explorer"
  );
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getStorageKey(user) {
  return `${STORAGE_PREFIX}:${user?.id || "guest"}`;
}

function loadConversation(user) {
  try {
    const stored = window.localStorage.getItem(
      getStorageKey(user),
    );

    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversation(user, messages) {
  try {
    window.localStorage.setItem(
      getStorageKey(user),
      JSON.stringify(messages.slice(-40)),
    );
  } catch {
    // The chat remains usable even without local storage.
  }
}

function BotAvatar() {
  return (
    <div className="trava-ai-bot-avatar" aria-hidden="true">
      <Bot size={19} />
      <i />
    </div>
  );
}

function MessageText({ text }) {
  const paragraphs = String(text || "")
    .split(/\n{2,}/)
    .filter(Boolean);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 20)}-${index}`}>
          {paragraph.split("\n").map((line, lineIndex) => (
            <span key={`${line.slice(0, 20)}-${lineIndex}`}>
              {line}
              {lineIndex < paragraph.split("\n").length - 1 && (
                <br />
              )}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function DestinationCards({ cards, onSelect }) {
  if (!cards?.length) return null;

  return (
    <div className="trava-ai-card-track">
      {cards.slice(0, 4).map((card) => (
        <button
          type="button"
          className="trava-ai-destination-card"
          key={card.id || card.title}
          onClick={() => onSelect(card)}
        >
          <div className="trava-ai-destination-image">
            <img src={card.image} alt={card.title} />
            {card.tag && <span>{card.tag}</span>}
          </div>

          <div className="trava-ai-destination-copy">
            <strong>{card.title}</strong>
            <span>{card.subtitle}</span>
            <small>{card.priceLabel}</small>
          </div>
        </button>
      ))}
    </div>
  );
}

function ConfirmOverwriteModal({ destination, onConfirm, onCancel }) {
  return (
    <div className="trava-modal-overlay" onClick={onCancel}>
      <div className="trava-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trava-modal-header">
          <h2>Replace itinerary?</h2>
          <p>
            Would you like TravaAI to generate a new day-by-day itinerary
            for <strong>{destination}</strong> and replace the current one?
          </p>
        </div>

        <div className="trava-modal-actions">
          <button
            type="button"
            className="trava-modal-cancel"
            onClick={onCancel}
          >
            Keep existing
          </button>
          <button
            type="button"
            className="trava-modal-confirm"
            onClick={onConfirm}
          >
            Yes, replace it ✨
          </button>
        </div>
      </div>
    </div>
  );
}

function TripChoiceModal({ destinationName, onCreate, onUpdate, onCancel }) {
  return (
    <div className="trava-modal-overlay" onClick={onCancel}>
      <div className="trava-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trava-modal-header">
          <h2>Plan for {destinationName || "Trip"}</h2>
          <p>Would you like to create a new trip or update your currently active trip?</p>
        </div>

        <div className="trava-modal-choice-actions">
          <button type="button" className="btn-create-trip" onClick={onCreate}>
            ➕ Create New Trip
          </button>

          <button type="button" className="btn-update-trip" onClick={onUpdate}>
            ✏️ Update Current Trip
          </button>
        </div>

        <div className="trava-modal-actions">
          <button
            type="button"
            className="trava-modal-cancel trava-modal-cancel-full"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptConfirmModal({ prompt, onConfirm, onCancel }) {
  const [editedPrompt, setEditedPrompt] = useState(prompt);

  return (
    <div className="trava-modal-overlay" onClick={onCancel}>
      <div className="trava-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trava-modal-header">
          <h2>Review your prompt</h2>
          <p>Edit the message below before sending it to TravaAI.</p>
        </div>

        <textarea
          className="trava-modal-editor"
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          rows={5}
        />

        <div className="trava-modal-actions">
          <button
            type="button"
            className="trava-modal-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="trava-modal-confirm"
            onClick={() => onConfirm(editedPrompt)}
            disabled={!editedPrompt.trim()}
          >
            Confirm ✈️
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIChatScreen({
  onBack,
  tripContext = null,
}) {
  const { user } = useAuth();
  const userName = useMemo(() => getUserName(user), [user]);

  const [messages, setMessages] = useState(() =>
    loadConversation(user),
  );
  const [input, setInput] = useState("");
  const [quickPrompts, setQuickPrompts] = useState(
    DEFAULT_QUICK_PROMPTS,
  );
  const [recommendationCards, setRecommendationCards] =
    useState(DEFAULT_CARDS);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingCard, setPendingCard] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const [userBudget, setUserBudget] = useState(null);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [overwriteModalOpen, setOverwriteModalOpen] = useState(false);
  const [pendingItineraryArgs, setPendingItineraryArgs] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
  console.log("fetchLatestTrip useEffect — user?.id:", user?.id);
  async function fetchLatestTrip() {
    const stored = localStorage.getItem("trava-active-trip-id");
    if (stored) {
      setActiveTripId(stored);
      return;
    }

    if (!user?.id) return;

    const { data, error } = await supabase
      .from("trips")
      .select("trip_id, total_budget")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Supabase trip fetch error:", error.message);
      return;
    }

    if (data) {
      setActiveTripId(data.trip_id);
      if (data.total_budget) setUserBudget(data.total_budget);
    }
  }

  fetchLatestTrip();
  }, [user?.id]);

function handleSelectCreateTrip() {
  if (!selectedCard) return;

  setIsCreateMode(true);

  const budget = selectedCard.priceLabel || "a realistic budget";
  const question = `Give me a practical ${selectedCard.subtitle?.toLowerCase() || "travel"} plan for ${selectedCard.title} with a budget of ${budget}. Include the best areas to stay.`;

  setPendingPrompt(question);
  setPendingCard(selectedCard);
  setChoiceModalOpen(false);
  setModalOpen(true);
}

function handleSelectUpdateTrip() {
  if (!selectedCard) return;

  setIsCreateMode(false);

  const budget = selectedCard.priceLabel?.replace("Plan from ", "") || "a realistic budget";

  const budgetInstruction = budget
    ? `with a budget of ${budget}.`
    : `and ask me what budget I'm planning for this trip before giving a full cost breakdown.`;

  const question = `Give me a practical ${selectedCard.subtitle?.toLowerCase() || "travel"} plan for ${selectedCard.title} ${budgetInstruction} Include the best areas to stay.`;

  setPendingPrompt(question);
  setPendingCard(selectedCard);
  setChoiceModalOpen(false);
  setModalOpen(true);
}

async function handleModalConfirm(editedPrompt) {
  setModalOpen(false);
  setPendingPrompt(null);

  const rawTitle = pendingCard?.title || "";
  const budgetMatch = editedPrompt.match(/(?:₱|PHP|P)\s?([\d,.]+k?)/i);
  const rawBudget = budgetMatch?.[1] || null;
  const extractedBudget = rawBudget
    ? rawBudget.toLowerCase().endsWith("k")
      ? Number(rawBudget.slice(0, -1).replace(/,/g, "")) * 1000
      : Number(rawBudget.replace(/,/g, ""))
    : null;

  const subtitleParts = (pendingCard?.subtitle || "").split("•").map((s) => s.trim());
  const numberOfDays = parseInt(subtitleParts[0]) || 5;

  const actionText = isCreateMode
    ? "Creating your new trip"
    : "Updating your planned trip";

  const statusNoticeText = `${rawTitle} is a great choice! ${actionText} right now! ✈️`;

  let newTripId = null; // ← hoisted here so it's accessible later

  if (isCreateMode && user?.id) {
    try {
      const { data, error } = await supabase
        .from("trips")
        .insert([
          {
            user_id: user.id,
            destination: rawTitle,
            number_of_days: numberOfDays,
            travel_group: "Solo",
            trip_name: `${rawTitle} Trip`,
            start_date: null,
            end_date: null,
            total_budget: extractedBudget,
          },
        ])
        .select("trip_id")
        .single();

      if (!error && data) {
        newTripId = data.trip_id; // ← save to hoisted variable
        setActiveTripId(data.trip_id);
        localStorage.setItem("trava-active-trip-id", data.trip_id);
      } else if (error) {
        console.error("Supabase insert error:", error.message);
      }
    } catch (err) {
      console.error("Failed to create new trip:", err);
    }
  } else if (!isCreateMode && activeTripId && rawTitle) {
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          destination: rawTitle,
          number_of_days: numberOfDays,
          total_budget: extractedBudget,
        })
        .eq("trip_id", activeTripId);

      if (error) {
        console.error("Supabase update error:", error.message);
      }
    } catch (err) {
      console.error("Failed to update trip destination:", err);
    }
  }

  const tripIdToUse = isCreateMode ? newTripId : activeTripId; // ← uses newTripId now

  if (tripIdToUse) {
    const args = {
      tripId: tripIdToUse,
      destination: rawTitle,
      numberOfDays,
      budget: extractedBudget
        ? `₱${extractedBudget.toLocaleString()}`
        : null,
    };

    if (isCreateMode) {
      generateAndSaveItinerary(args.tripId, args.destination, args.numberOfDays, args.budget);
    } else {
      setPendingItineraryArgs(args);
      setOverwriteModalOpen(true);
    }
  }

  setPendingCard(null);

  const noticeMessage = {
    id: createId("assistant"),
    role: "assistant",
    text: statusNoticeText,
    createdAt: new Date().toISOString(),
  };

  await sendMessage(editedPrompt, [noticeMessage], true);
}

async function generateAndSaveItinerary(tripId, destination, numberOfDays, budget) {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("session in generateAndSaveItinerary:", session?.user?.id);

  const { data: tripCheck, error: tripError } = await supabase
    .from("trips")
    .select("trip_id")
    .eq("trip_id", tripId)
    .single();

  console.log("trip check:", tripCheck, tripError?.message);

  if (!tripCheck) {
    console.error("Trip not found — itinerary save aborted");
    return;
  }
  
  try {
    const res = await fetch("/api/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination, numberOfDays, budget }),
    });

    const json = await res.json();

    if (!res.ok || !json.itinerary?.length) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId("assistant"),
          role: "assistant",
          text: "I wasn't able to generate the itinerary right now due to API limits. Your trip destination has been saved — try again in a bit! ✈️",
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    await supabase
      .from("travel_itineraries")
      .delete()
      .eq("trip_id", tripId);

    const rows = json.itinerary.map((day) => ({
      trip_id: tripId,
      day_number: day.dayNumber,
      schedule_details: {
        ...day,
        id: `day-${day.dayNumber}`,
        day: day.dayNumber,
        date: "",
        activities: (day.activities || []).map((activity) => ({
          ...activity,
          id: `act-${day.dayNumber}-${Math.random().toString(36).slice(2, 7)}`,
          asset: guessAsset(activity.title),
          lat: null,
          lng: null,
        })),
      },
    }));

    const { error } = await supabase
      .from("travel_itineraries")
      .insert(rows);

    if (error) console.error("Itinerary save error:", error.message);
  } catch (err) {
    console.error("Failed to generate/save itinerary:", err);
  }
}

function handleModalCancel() {
  setModalOpen(false);
  setPendingPrompt(null);
  setPendingCard(null);
}

function handleOverwriteConfirm() {
  console.log("handleOverwriteConfirm called — pendingItineraryArgs:", pendingItineraryArgs);
  setOverwriteModalOpen(false);
  if (pendingItineraryArgs) {
    generateAndSaveItinerary(
      pendingItineraryArgs.tripId,
      pendingItineraryArgs.destination,
      pendingItineraryArgs.numberOfDays,
      pendingItineraryArgs.budget,
    );
  }
  setPendingItineraryArgs(null);
}

function handleOverwriteCancel() {
  setOverwriteModalOpen(false);
  setPendingItineraryArgs(null);
}
function guessAsset(title = "") {
  const t = title.toLowerCase();
  if (/flight|airport|terminal/.test(t)) return "plane";
  if (/hotel|check.in|resort/.test(t)) return "hotel";
  if (/food|restaurant|dinner|lunch|breakfast|cafe|coffee/.test(t)) return "ramen";
  if (/temple|shrine|museum|castle/.test(t)) return "temple";
  if (/train|metro|subway/.test(t)) return "train";
  if (/shop|mall|market/.test(t)) return "shopping";
  if (/tower|landmark|view|monument|bridge|park|garden|square|plaza|visit|explore|tour|walk|stroll|old town|historic/.test(t)) return "tower";
  return "plane";
}

  const welcomeMessage = useMemo(
    () => ({
      id: "welcome",
      role: "assistant",
      text: `Hello, ${userName}! 👋\nWhere shall we wander today?`,
      createdAt: new Date().toISOString(),
    }),
    [userName],
  );

  useEffect(() => {
    setMessages(loadConversation(user));
  }, [user?.id]);

  useEffect(() => {
    saveConversation(user, messages);
  }, [messages, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading, recommendationCards]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop?.();
    };
  }, []);

  const visibleMessages = messages.length
    ? messages
    : [welcomeMessage];

  function clearConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setRecommendationCards(DEFAULT_CARDS);
    setQuickPrompts(DEFAULT_QUICK_PROMPTS);
    setInput("");
    setNotice("");
    setMenuOpen(false);

    try {
      window.localStorage.removeItem(getStorageKey(user));
    } catch {
      // Nothing else is required.
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setNotice("Generation stopped.");
  }

  function handleDestinationCard(card) {
  setSelectedCard(card);
  setChoiceModalOpen(true);
}

async function sendMessage(rawMessage = input, extraMessages = [], skipApi = false) {
  const messageText = String(rawMessage || "").trim();

  if (!messageText || (loading && !skipApi)) return;

  const userMessage = {
    id: createId("user"),
    role: "user",
    text: messageText,
    createdAt: new Date().toISOString(),
  };

  const nextMessages = [...messages, userMessage, ...extraMessages];

  setMessages(nextMessages);
  setInput("");
  setNotice("");
  setMenuOpen(false);

  // If skipApi is true, return early without calling the backend
  if (skipApi) {
    return;
  }

  setLoading(true);

  const controller = new AbortController();
  abortRef.current = controller;

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 35000);

  try {
    const history = nextMessages
      .slice(-8)
      .map(({ role, text }) => ({
        role,
        text: String(text).slice(0, 1200),
      }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        message: messageText,
        history,
        user: {
          id: user?.id || null,
          name: userName,
        },
        tripContext,
        locale: "en-PH",
        currency: "PHP",
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          "TRAVA AI could not answer right now.",
      );
    }

    const assistantMessage = {
      id: createId("assistant"),
      role: "assistant",
      text:
        payload?.reply ||
        "I’m ready to help with your trip. What destination are you considering?",
      createdAt: new Date().toISOString(),
      source: payload?.source || "gemini",
    };

    setMessages((current) => [
      ...current,
      assistantMessage,
    ]);

    if (Array.isArray(payload?.cards)) {
      setRecommendationCards(payload.cards);
    }

    if (Array.isArray(payload?.quickReplies)) {
      setQuickPrompts(payload.quickReplies.slice(0, 4));
    }

    if (payload?.source === "fallback") {
      setNotice(
        "Gemini is temporarily busy, so TRAVA used a lightweight travel fallback.",
      );
    }

    if (payload?.tripInfo?.allInfoCollected &&(payload?.tripInfo?.action === "create" || payload?.tripInfo?.action === "update")) {
      const { destination, budget, numberOfDays, numberOfPeople, action } = payload.tripInfo;
      console.log("action:", payload.tripInfo.action, "activeTripId:", activeTripId);

      try {
        if (action === "update" && activeTripId) {
          const { error } = await supabase
            .from("trips")
            .update({
              destination,
              ...(budget && { total_budget: budget }),
              ...(numberOfDays && { number_of_days: numberOfDays }),
            })
            .eq("trip_id", activeTripId);

          console.log("supabase update error:", error);

          setPendingItineraryArgs({
            tripId: activeTripId,
            destination,
            numberOfDays: numberOfDays || 5,
            budget: budget ? `₱${budget.toLocaleString()}` : null,
          });
          console.log("pendingItineraryArgs set, opening modal...");
          setTimeout(() => { 
            console.log("setTimeout fired, overwriteModalOpen should be true");
            setOverwriteModalOpen(true) }
            , 50);
        } else if (action === "create") {
          // ... create path
        }
      } catch (tripErr) {
        console.error("trip save error:", tripErr);
      }

      if (action === "update" && activeTripId) {
        await supabase
          .from("trips")
          .update({
            destination,
            ...(budget && { total_budget: budget }),
            ...(numberOfDays && { number_of_days: numberOfDays }),
          })
          .eq("trip_id", activeTripId);
        
        console.log("update error:", error);

        setPendingItineraryArgs({
          tripId: activeTripId,
          destination,
          numberOfDays: numberOfDays || 5,
          budget: budget ? `₱${budget.toLocaleString()}` : null,
        });
        setOverwriteModalOpen(true);

      } else if (action === "create") {
        const { data, error } = await supabase
          .from("trips")
          .insert([{
            user_id: user.id,
            destination,
            number_of_days: numberOfDays || 5,
            travel_group: numberOfPeople > 1 ? "Group" : "Solo",
            trip_name: `${destination} Trip`,
            start_date: null,
            end_date: null,
            total_budget: budget || null,
          }])
          .select("trip_id")
          .single();

        if (!error && data) {
          setActiveTripId(data.trip_id);
          localStorage.setItem("trava-active-trip-id", data.trip_id);
          generateAndSaveItinerary(
            data.trip_id,
            destination,
            numberOfDays || 5,
            budget ? `₱${budget.toLocaleString()}` : null,
          );
        }
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      setNotice(
        "The request took too long or was stopped. Please send it again.",
      );
    } else {
      setMessages((current) => [
        ...current,
        {
          id: createId("assistant-error"),
          role: "assistant",
          text:
            "I couldn’t reach the travel assistant just now. Please try again in a moment.",
          createdAt: new Date().toISOString(),
          error: true,
        },
      ]);

      setNotice(error?.message || "Something went wrong.");
    }
  } finally {
    window.clearTimeout(timeout);
    abortRef.current = null;
    setLoading(false);
  }
}

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice(
        "Voice input is not supported by this browser.",
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-PH";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setNotice("Listening…");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("");

      setInput(transcript);
    };

    recognition.onerror = () => {
      setNotice("Voice input could not start.");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setNotice("");
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <section className="trava-ai-screen">
      <header className="trava-ai-header">
        <div className="trava-ai-brand">
          <div className="trava-ai-brand-icon">
            <Sparkles size={23} />
          </div>

          <div>
            <h1>TRAVA AI</h1>
            <p>Your smart travel companion</p>
          </div>
        </div>

        <div className="trava-ai-header-actions">
          {onBack && (
            <button
              type="button"
              className="trava-ai-header-secondary"
              onClick={onBack}
              aria-label="Close AI assistant"
            >
              <X size={19} />
            </button>
          )}

          <button
            type="button"
            className="trava-ai-menu-button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="AI chat menu"
          >
            <MoreHorizontal size={21} />
          </button>

          {menuOpen && (
            <div className="trava-ai-menu">
              <button type="button" onClick={clearConversation}>
                <Trash2 size={16} />
                Clear conversation
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="trava-ai-conversation">
        <div className="trava-ai-chat-column">
          {visibleMessages.map((message) => {
            const isAssistant = message.role === "assistant";

            return (
              <article
                className={`trava-ai-message-row ${
                  isAssistant ? "assistant" : "user"
                }`}
                key={message.id}
              >
                {isAssistant && <BotAvatar />}

                <div className="trava-ai-message-group">
                  <div
                    className={`trava-ai-message-bubble ${
                      message.error ? "error" : ""
                    }`}
                  >
                    <MessageText text={message.text} />
                  </div>

                  <time>
                    {formatTime(
                      new Date(message.createdAt || Date.now()),
                    )}
                  </time>
                </div>
              </article>
            );
          })}

          {loading && (
            <article className="trava-ai-message-row assistant">
              <BotAvatar />

              <div className="trava-ai-message-group">
                <div className="trava-ai-message-bubble trava-ai-thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </article>
          )}

          <DestinationCards
            cards={recommendationCards}
            onSelect={handleDestinationCard}
          />

          <div className="trava-ai-prompt-section">
            <strong>You can also try asking:</strong>

            <div className="trava-ai-prompt-grid">
              {quickPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div ref={endRef} />
        </div>
      </div>

      <div className="trava-ai-composer-area">
        {notice && (
          <div className="trava-ai-notice">
            {notice}
          </div>
        )}

        <form
          className="trava-ai-composer"
          onSubmit={handleSubmit}
        >
          <button
            type="button"
            className={`trava-ai-mic-button ${
              listening ? "active" : ""
            }`}
            onClick={startVoiceInput}
            aria-label={
              listening
                ? "Stop voice input"
                : "Start voice input"
            }
          >
            {listening ? (
              <CircleStop size={19} />
            ) : (
              <Mic size={19} />
            )}
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={1500}
            placeholder="Ask me anything about travel..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />

          <button
            type={loading ? "button" : "submit"}
            className="trava-ai-send-button"
            onClick={loading ? stopGeneration : undefined}
            disabled={!loading && !input.trim()}
            aria-label={
              loading ? "Stop generating" : "Send message"
            }
          >
            {loading ? (
              <CircleStop size={20} />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>

        <p className="trava-ai-disclaimer">
          AI suggestions may be inaccurate. Confirm prices,
          availability, visas, and bookings with official sources
          or the travel agency.
        </p>
      </div>
      
      {/* Choice Modal */}
      {choiceModalOpen && selectedCard && (
        <TripChoiceModal
          destinationName={selectedCard.title}
          onCreate={handleSelectCreateTrip}
          onUpdate={handleSelectUpdateTrip}
          onCancel={() => setChoiceModalOpen(false)}
        />
      )}

      {modalOpen && pendingPrompt && (
        <PromptConfirmModal
          prompt={pendingPrompt}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}
      
      {overwriteModalOpen && pendingItineraryArgs && (
        <ConfirmOverwriteModal
          destination={pendingItineraryArgs.destination}
          onConfirm={handleOverwriteConfirm}
          onCancel={handleOverwriteCancel}
        />
      )}
    </section>
  );
}