import { apiRequest } from "@/lib/api-client";

export interface AiHistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AiReply {
  reply: string;
  source: "gemini" | "fallback" | string;
  quickReplies?: string[];
}

export async function sendAiMessage(message: string, history: AiHistoryTurn[]): Promise<AiReply> {
  return apiRequest<AiReply>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      history: history.slice(-10),
      locale: "en-PH",
      currency: "PHP",
    }),
  });
}
