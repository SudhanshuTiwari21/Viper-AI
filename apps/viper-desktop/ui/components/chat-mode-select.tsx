import { useState, useRef, useEffect, useCallback, useId } from "react";
import {
  type LucideIcon,
  ChevronDown,
  Check,
  MessageCircle,
  ListOrdered,
  Bug,
  Sparkles,
} from "lucide-react";
import type { ChatMode } from "../contexts/chat-context";

const MODES: { value: ChatMode; label: string; Icon: LucideIcon }[] = [
  { value: "ask", label: "Ask", Icon: MessageCircle },
  { value: "plan", label: "Plan", Icon: ListOrdered },
  { value: "debug", label: "Debug", Icon: Bug },
  { value: "agent", label: "Agent", Icon: Sparkles },
];

export interface ChatModeSelectProps {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export function ChatModeSelect({ value, onChange, disabled }: ChatModeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `viper-chat-mode-${baseId.replace(/:/g, "")}`;
  const triggerId = `${listboxId}-trigger`;

  const current = MODES.find((m) => m.value === value) ?? MODES[MODES.length - 1]!;
  const currentLabel = current.label;
  const CurrentIcon = current.Icon;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    if (open) {
      const t = window.setTimeout(() => window.addEventListener("click", close), 0);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("click", close);
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const first = listRef.current.querySelector<HTMLButtonElement>('[role="option"]');
    first?.focus();
  }, [open]);

  const focusOption = useCallback((delta: number) => {
    const root = listRef.current;
    if (!root) return;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    if (buttons.length === 0) return;
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      i < 0 ? (delta > 0 ? 0 : buttons.length - 1) : Math.min(Math.max(i + delta, 0), buttons.length - 1);
    buttons[next]?.focus();
  }, []);

  const handleSelect = useCallback(
    (m: ChatMode) => {
      onChange(m);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else focusOption(e.key === "ArrowDown" ? 1 : -1);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusOption(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      buttons?.[buttons.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const triggerRing =
    "outline-none focus-visible:ring-2 focus-visible:ring-v-accent/35 focus-visible:ring-offset-0";
  const optionBase =
    "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-v-accent/40";

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label="Chat mode"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-v-border/70 bg-v-bg2 text-v-text transition-colors ${triggerRing} ${
          open ? "ring-1 ring-v-accent/40 border-v-accent/40" : ""
        } hover:bg-white/[0.04] hover:text-v-text disabled:opacity-40 disabled:pointer-events-none`}
      >
        <CurrentIcon size={12} className="shrink-0 text-v-text3" aria-hidden />
        <span>{currentLabel}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-v-text3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute left-0 bottom-full mb-1 py-1 rounded-md shadow-lg z-30 min-w-[10rem] border border-v-border bg-v-bg2"
        >
          {MODES.map((m) => {
            const selected = value === m.value;
            const { Icon } = m;
            return (
              <button
                key={m.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(m.value)}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${optionBase} ${
                  selected
                    ? "bg-v-accent/15 text-v-accent"
                    : "text-v-text2 hover:bg-white/[0.06] hover:text-v-text"
                }`}
              >
                <Icon size={14} className={`shrink-0 ${selected ? "text-v-accent" : "text-v-text3"}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{m.label}</span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {selected ? <Check size={12} strokeWidth={2.5} className="text-v-accent" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
