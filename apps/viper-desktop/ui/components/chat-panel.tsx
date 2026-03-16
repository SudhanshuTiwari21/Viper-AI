import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Clock, MoreHorizontal } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatPromptBox } from "./chat-prompt-box";
import { useChat } from "../contexts/chat-context";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { sendChat, formatChatResponse } from "../services/agent-api";

function formatTimeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "Now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h`;
  return `${Math.floor(d / 86400_000)}d`;
}

export function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateMessage,
  } = useChat();
  const { workspace } = useWorkspaceContext();
  const [streaming, setStreaming] = useState(false);
  const [pastChatsOpen, setPastChatsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || streaming || !activeSessionId) return;

      const workspacePath = workspace?.root ?? "";
      if (!workspacePath) {
        addMessage(activeSessionId, {
          role: "assistant",
          content: "Open a workspace folder first so the agent can use your codebase context.",
        });
        return;
      }

      addMessage(activeSessionId, {
        role: "user",
        content: prompt.trim(),
      });

      const assistantId = addMessage(activeSessionId, {
        role: "assistant",
        content: "",
        streaming: true,
      });

      setStreaming(true);
      try {
        const data = await sendChat(prompt.trim(), workspacePath);
        const full = formatChatResponse(data);
        updateMessage(activeSessionId, assistantId, full, false);
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Request failed";
        updateMessage(
          activeSessionId,
          assistantId,
          `Error: ${errorText}`,
          false
        );
      } finally {
        setStreaming(false);
      }
    },
    [
      activeSessionId,
      streaming,
      workspace?.root,
      addMessage,
      updateMessage,
    ]
  );

  const pastChats = sessions
    .slice(0, 10)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar: Chat tabs + New Chat, + , Clock, ... */}
      <div
        className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <button
          type="button"
          className="px-3 py-1.5 rounded text-xs font-medium text-[#9ca3af] hover:bg-white/5 hover:text-[#e5e7eb] transition-colors"
        >
          Chat
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-[#e5e7eb]"
          onClick={() => createSession()}
        >
          New Chat
        </button>
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          className="p-2 rounded text-[#6b7280] hover:bg-white/5 hover:text-[#e5e7eb]"
          title="New chat"
          onClick={() => createSession()}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="p-2 rounded text-[#6b7280] hover:bg-white/5 hover:text-[#e5e7eb]"
          title="History"
        >
          <Clock size={16} />
        </button>
        <button
          type="button"
          className="p-2 rounded text-[#6b7280] hover:bg-white/5 hover:text-[#e5e7eb]"
          title="More"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Prompt area: agent + context + input */}
      <div
        className="flex-shrink-0 p-2 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <ChatPromptBox onSend={handleSend} disabled={streaming} />
      </div>

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-4 p-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <p className="text-sm text-[#6b7280]">
              Send a message to start. Use @ for context, / for commands.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Past Chats */}
      <div
        className="flex-shrink-0 border-t"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-[#9ca3af] hover:bg-white/5"
          onClick={() => setPastChatsOpen((v) => !v)}
        >
          <span className="font-medium">Past Chats</span>
          <span className="text-[10px] text-[#6b7280]">
            {pastChatsOpen ? "▼" : "▶"}
          </span>
        </button>
        {pastChatsOpen && (
          <div className="px-3 pb-3">
            <div className="flex justify-end mb-1">
              <button
                type="button"
                className="text-[10px] text-[var(--viper-accent)] hover:underline"
              >
                View All
              </button>
            </div>
            <ul className="space-y-0.5 max-h-32 overflow-y-auto">
              {pastChats.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1.5 rounded text-xs truncate flex items-center justify-between gap-2 ${
                      s.id === activeSessionId
                        ? "bg-white/10 text-[#e5e7eb]"
                        : "text-[#9ca3af] hover:bg-white/5 hover:text-[#e5e7eb]"
                    }`}
                    onClick={() => setActiveSessionId(s.id)}
                  >
                    <span className="truncate min-w-0">{s.title}</span>
                    <span className="text-[10px] text-[#6b7280] flex-shrink-0">
                      {formatTimeAgo(s.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
