import type { ChatMessage as ChatMessageType } from "../contexts/chat-context";
import { PatchDiffView } from "./patch-diff-view";

interface ChatMessageProps {
  message: ChatMessageType;
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
        {!isUser && message.patches && message.patches.length > 0 && (
          <>
            <PatchDiffView patches={message.patches} />
            <div className="mt-3 flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("viper:apply-patch", {
                      detail: { patches: message.patches },
                    })
                  );
                }}
              >
                Apply Changes
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded text-xs font-medium border border-zinc-600 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
              >
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
