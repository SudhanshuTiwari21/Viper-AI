import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { PromptInput } from "./prompt-input";
import { createChatStream } from "../lib/websocket";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const CHAT_API_URL = "http://localhost:3000/agent/chat";

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (prompt: string) => {
    if (!prompt.trim() || streaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    setStreaming(true);

    try {
      const stream = createChatStream(CHAT_API_URL, { prompt });
      let full = "";

      for await (const chunk of stream) {
        full += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: full, streaming: true }
              : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: full, streaming: false } : m
        )
      );
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errorText}`, streaming: false }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/80">
        <h2 className="text-sm font-medium text-zinc-300">AI Chat</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Ask about your codebase, refactors, or agents.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 p-4">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <p className="text-sm text-zinc-500">
              Send a message to start. Try &quot;Refactor login service&quot; or
              &quot;Explain this module.&quot;
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-4 border-t border-zinc-800/80">
        <PromptInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  );
}
