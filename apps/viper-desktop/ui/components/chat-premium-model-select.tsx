import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";
import { listPremiumSelectableModels } from "@repo/model-registry";

export interface ChatPremiumModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ChatPremiumModelSelect({ value, onChange, disabled }: ChatPremiumModelSelectProps) {
  const models = useMemo(() => listPremiumSelectableModels(), []);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `viper-chat-premium-${baseId.replace(/:/g, "")}`;
  const triggerId = `${listboxId}-trigger`;

  const currentLabel =
    models.find((m) => String(m.id) === value)?.displayName ?? value;

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
    (id: string) => {
      onChange(id);
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
        aria-label="Premium model"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-v-border/70 bg-v-bg2 text-v-text transition-colors ${triggerRing} ${
          open ? "ring-1 ring-v-accent/40 border-v-accent/40" : ""
        } hover:bg-white/[0.04] hover:text-v-text disabled:opacity-40 disabled:pointer-events-none max-w-[10rem]`}
      >
        <span className="truncate">{currentLabel}</span>
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
          className="absolute left-0 bottom-full mb-1 py-1 rounded-md shadow-lg z-30 min-w-[11rem] max-w-[14rem] border border-v-border bg-v-bg2"
        >
          {models.map((m) => {
            const id = String(m.id);
            const selected = value === id;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(id)}
                className={`flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${optionBase} ${
                  selected
                    ? "bg-v-accent/15 text-v-accent"
                    : "text-v-text2 hover:bg-white/[0.06] hover:text-v-text"
                }`}
              >
                <span className="flex w-full items-center gap-2 min-w-0">
                  <span className="min-w-0 flex-1 truncate">{m.displayName}</span>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                    {selected ? <Check size={12} strokeWidth={2.5} className="text-v-accent" /> : null}
                  </span>
                </span>
                <span className="text-[9px] font-normal text-v-text3 uppercase tracking-wide">
                  {m.provider}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
