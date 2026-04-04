import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const MAX_ROWS = 8;
  const LINE_HEIGHT = 20;

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = LINE_HEIGHT * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, []);

  useEffect(() => resize(), [value, resize]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    setTimeout(() => {
      if (ref.current) {
        ref.current.style.height = "auto";
        ref.current.focus();
      }
    }, 0);
  }, [value, disabled, onSend]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="relative flex items-end gap-1.5 rounded-lg border border-v-border bg-v-bg2 px-2.5 py-1.5 transition-colors focus-within:border-v-accent/40">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        disabled={disabled}
        rows={1}
        placeholder={placeholder ?? "Ask anything about your code..."}
        className="flex-1 resize-none bg-transparent text-sm leading-5 text-v-text placeholder:text-v-text3 outline-none min-h-[20px] py-0.5"
        style={{ lineHeight: `${LINE_HEIGHT}px`, maxHeight: LINE_HEIGHT * MAX_ROWS }}
      />
      <button
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className="v-press flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-v-text3 transition-colors hover:text-v-accent disabled:opacity-30 disabled:pointer-events-none mb-px"
      >
        <Send size={15} />
      </button>
    </div>
  );
}
