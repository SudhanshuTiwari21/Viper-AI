import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, Send } from "lucide-react";

interface DebugOutputEntry {
  id: string;
  category: "stdout" | "stderr" | "console" | "eval";
  text: string;
  timestamp: number;
}

let entryId = 0;
function nextEntryId() {
  return `dbg-${++entryId}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  stdout: "#e5e7eb",
  stderr: "#ef4444",
  console: "#9ca3af",
  eval: "#22d3ee",
};

export function DebugConsolePanel() {
  const [entries, setEntries] = useState<DebugOutputEntry[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = window.viper.debug.onEvent((event: unknown) => {
      const e = event as Record<string, unknown>;
      if (e.type === "output") {
        setEntries((prev) => [
          ...prev,
          {
            id: nextEntryId(),
            category: (e.category as "stdout" | "stderr" | "console") ?? "console",
            text: String(e.output ?? ""),
            timestamp: Date.now(),
          },
        ]);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const evaluate = useCallback(async () => {
    const expr = input.trim();
    if (!expr) return;
    setInput("");

    setEntries((prev) => [
      ...prev,
      {
        id: nextEntryId(),
        category: "eval",
        text: `> ${expr}`,
        timestamp: Date.now(),
      },
    ]);

    try {
      const res = await window.viper.debug.evaluate(expr);
      if (res.ok && res.result) {
        setEntries((prev) => [
          ...prev,
          {
            id: nextEntryId(),
            category: "eval",
            text: res.result!,
            timestamp: Date.now(),
          },
        ]);
      } else if (res.error) {
        setEntries((prev) => [
          ...prev,
          {
            id: nextEntryId(),
            category: "stderr",
            text: res.error!,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch {
      setEntries((prev) => [
        ...prev,
        {
          id: nextEntryId(),
          category: "stderr",
          text: "Failed to evaluate expression",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [input]);

  const clear = useCallback(() => setEntries([]), []);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--viper-bg)" }}>
      <div
        className="flex items-center justify-between h-8 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Debug Console
        </span>
        <button
          type="button"
          className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
          title="Clear"
          onClick={clear}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 px-2 py-1 font-mono text-[12px] whitespace-pre-wrap break-words"
      >
        {entries.length === 0 && (
          <p className="text-[#4b5563] text-[11px] py-2">
            Debug output will appear here. Use the input below to evaluate expressions.
          </p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="py-[1px] leading-[18px]">
            <span style={{ color: CATEGORY_COLORS[e.category] ?? "#9ca3af" }}>
              {e.text}
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex items-center gap-1 px-2 py-1.5 border-t"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <input
          ref={inputRef}
          className="flex-1 min-w-0 rounded border px-1.5 py-1 text-xs font-mono bg-transparent text-[#e5e7eb] outline-none placeholder:text-[#4b5563]"
          style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
          placeholder="Evaluate expression..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") evaluate();
          }}
        />
        <button
          type="button"
          className="p-1 rounded text-[#6b7280] hover:text-[var(--viper-accent)] hover:bg-white/5"
          title="Evaluate"
          onClick={evaluate}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
