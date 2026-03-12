import { useState, useRef, useCallback, useEffect } from "react";
import { Infinity, ChevronDown, Image, Mic } from "lucide-react";

interface ChatPromptBoxProps {
  onSend: (prompt: string) => void;
  disabled?: boolean;
}

const AGENT_OPTIONS = ["Auto", "Codebase", "Editor", "Review", "Plan"];
const CONTEXT_OPTIONS = ["Local", "Workspace", "File"];

export function ChatPromptBox({ onSend, disabled }: ChatPromptBoxProps) {
  const [value, setValue] = useState("");
  const [agent, setAgent] = useState("Auto");
  const [context, setContext] = useState("Local");
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    const onFocus = () => textareaRef.current?.focus();
    window.addEventListener("viper:focus-chat", onFocus);
    return () => window.removeEventListener("viper:focus-chat", onFocus);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setShowAgentDropdown(false);
      setShowContextDropdown(false);
    };
    if (showAgentDropdown || showContextDropdown) {
      setTimeout(() => window.addEventListener("click", close), 0);
      return () => window.removeEventListener("click", close);
    }
  }, [showAgentDropdown, showContextDropdown]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border flex flex-col gap-2 p-2 focus-within:ring-1 focus-within:ring-[var(--viper-accent)]/50 transition-all"
      style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Plan, @ for context, / for commands"
        disabled={disabled}
        rows={2}
        className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-[#e5e7eb] placeholder-[#6b7280] outline-none disabled:opacity-50 min-h-[52px]"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 rounded text-[#9ca3af] hover:bg-white/5 hover:text-[#e5e7eb] text-xs"
              onClick={() => setShowAgentDropdown((v) => !v)}
            >
              <Infinity size={14} />
              <span>{agent}</span>
              <ChevronDown size={12} />
            </button>
            {showAgentDropdown && (
              <div
                className="absolute left-0 bottom-full mb-1 py-1 rounded shadow-lg z-10 min-w-[120px]"
                style={{ background: "var(--viper-sidebar)", border: "1px solid var(--viper-border)" }}
              >
                {AGENT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs text-[#e5e7eb] hover:bg-white/10"
                    onClick={() => {
                      setAgent(opt);
                      setShowAgentDropdown(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 rounded text-[#9ca3af] hover:bg-white/5 hover:text-[#e5e7eb] text-xs"
              onClick={() => setShowContextDropdown((v) => !v)}
            >
              <span>{context}</span>
              <ChevronDown size={12} />
            </button>
            {showContextDropdown && (
              <div
                className="absolute left-0 bottom-full mb-1 py-1 rounded shadow-lg z-10 min-w-[100px]"
                style={{ background: "var(--viper-sidebar)", border: "1px solid var(--viper-border)" }}
              >
                {CONTEXT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs text-[#e5e7eb] hover:bg-white/10"
                    onClick={() => {
                      setContext(opt);
                      setShowContextDropdown(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded text-[#6b7280] hover:bg-white/5 hover:text-[#9ca3af]"
            title="Attach image"
          >
            <Image size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded text-[#6b7280] hover:bg-white/5 hover:text-[#9ca3af]"
            title="Voice input"
          >
            <Mic size={16} />
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40 text-[#0b0f17]"
          style={{ background: "var(--viper-accent)" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
