import { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { getAllCommands, runCommand } from "../commands/command-registry";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(() => (open ? getAllCommands() : []), [open]);
  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ["title", "category", "id"],
        threshold: 0.3,
      }),
    [commands]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return fuse.search(query).map((r) => r.item);
  }, [commands, query, fuse]);

  const selected = filtered[selectedIndex] ?? null;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        onClose();
        runCommand(selected.id).catch(console.error);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, filtered.length, selected]);

  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex, filtered]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-[560px] rounded-lg shadow-2xl border overflow-hidden"
        style={{
          background: "var(--viper-sidebar)",
          borderColor: "var(--viper-border)",
        }}
      >
        <div className="flex items-center border-b px-3" style={{ borderColor: "var(--viper-border)" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 py-3 bg-transparent text-[#e5e7eb] placeholder-[#6b7280] outline-none text-sm"
            autoComplete="off"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto py-1"
          style={{ background: "var(--viper-bg)" }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[#6b7280]">No commands found.</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  i === selectedIndex
                    ? "bg-[var(--viper-accent)]/20 text-[var(--viper-accent)]"
                    : "text-[#e5e7eb] hover:bg-white/5"
                }`}
                onClick={() => {
                  onClose();
                  runCommand(cmd.id).catch(console.error);
                }}
              >
                {cmd.category && (
                  <span className="text-[10px] uppercase text-[#6b7280] w-24 truncate">
                    {cmd.category}
                  </span>
                )}
                <span className="flex-1 truncate">{cmd.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
