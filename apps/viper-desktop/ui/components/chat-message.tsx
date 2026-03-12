import type { Message } from "./chat-panel";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
            : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content || (message.streaming ? "..." : "")}
          {message.streaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-zinc-400 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
