import { useState, useRef, useCallback, useEffect } from "react";

interface PromptInputProps {
  onSend: (prompt: string) => void;
  disabled?: boolean;
}

const MAX_ROWS = 6;

export function PromptInput({ onSend, disabled }: PromptInputProps) {
  const [value, setValue] = useState("");
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

  return (
    <div
      className="flex gap-2 items-end rounded-xl border focus-within:ring-1 transition-colors"
      style={{
        borderColor: "var(--viper-border)",
        background: "var(--viper-bg)",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Viper AI..."
        disabled={disabled}
        rows={1}
        className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-transparent px-4 py-3 text-sm text-[#e5e7eb] placeholder-[#6b7280] outline-none disabled:opacity-50"
        style={{ fieldSizing: "content" }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 m-2 p-2 rounded-lg disabled:opacity-40 disabled:pointer-events-none text-[#0b0f17] font-medium transition-all hover:shadow-[0_0_12px_rgba(34,197,94,0.3)]"
        style={{ background: "var(--viper-accent)" }}
        aria-label="Send"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </div>
  );
}
