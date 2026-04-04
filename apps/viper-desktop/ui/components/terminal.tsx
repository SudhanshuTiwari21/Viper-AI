import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { terminalApi } from "../services/terminal";
import { Plus, X, Trash2, TerminalSquare } from "lucide-react";

interface TermInfo {
  id: string;
  xterm: XTerm;
  fit: FitAddon;
  label: string;
  wrapperEl: HTMLDivElement;
  opened: boolean;
}

interface TerminalProps {
  workspaceRoot: string | null;
}

export function Terminal({ workspaceRoot }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [terminals, setTerminals] = useState<TermInfo[]>([]);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const terminalsRef = useRef(terminals);
  terminalsRef.current = terminals;

  const cwd = workspaceRoot ?? "";

  const createNewTerminal = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    const res = await terminalApi.create(cwd);
    if (!res?.ok || !res.termId) {
      setCreateError(res?.error ?? "Failed to create terminal");
      setCreating(false);
      return;
    }

    const termId = res.termId;

    const xterm = new XTerm({
      theme: { background: "#0b0f17", foreground: "#e5e7eb", cursor: "#22c55e" },
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      cursorBlink: true,
      allowProposedApi: false,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.onData((data: string) => {
      terminalApi.write(termId, data);
    });

    const wrapperEl = document.createElement("div");
    wrapperEl.style.width = "100%";
    wrapperEl.style.height = "100%";
    wrapperEl.style.display = "none";

    const label = `Terminal ${terminalsRef.current.length + 1}`;
    const info: TermInfo = { id: termId, xterm, fit: fitAddon, label, wrapperEl, opened: false };

    setTerminals((prev) => [...prev, info]);
    setActiveTermId(termId);
    setCreating(false);
  }, [cwd, creating]);

  const destroyTerminal = useCallback((termId: string) => {
    setTerminals((prev) => {
      const t = prev.find((t) => t.id === termId);
      if (t) {
        t.xterm.dispose();
        t.wrapperEl.remove();
        terminalApi.destroy(termId);
      }
      const next = prev.filter((t) => t.id !== termId);
      return next;
    });
    setActiveTermId((current) => {
      if (current === termId) {
        const remaining = terminalsRef.current.filter((t) => t.id !== termId);
        return remaining.length > 0 ? remaining[remaining.length - 1]!.id : null;
      }
      return current;
    });
  }, []);

  const clearTerminal = useCallback(() => {
    if (!activeTermId) return;
    const term = terminalsRef.current.find((t) => t.id === activeTermId);
    if (term) {
      term.xterm.clear();
    }
  }, [activeTermId]);

  useEffect(() => {
    const unsub = terminalApi.onData((termId: string, data: string) => {
      const term = terminalsRef.current.find((t) => t.id === termId);
      if (term) term.xterm.write(data);
    });

    const unsubExit = terminalApi.onExit((termId: string) => {
      destroyTerminal(termId);
    });

    return () => {
      if (typeof unsub === "function") unsub();
      if (typeof unsubExit === "function") unsubExit();
    };
  }, [destroyTerminal]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    for (const term of terminalsRef.current) {
      if (!term.opened && !term.wrapperEl.parentElement) {
        el.appendChild(term.wrapperEl);
        term.xterm.open(term.wrapperEl);
        term.opened = true;
      }

      if (term.id === activeTermId) {
        term.wrapperEl.style.display = "block";
        requestAnimationFrame(() => {
          term.fit.fit();
          if (term.xterm.cols && term.xterm.rows) {
            terminalApi.resize(term.id, term.xterm.cols, term.xterm.rows);
          }
        });
      } else {
        term.wrapperEl.style.display = "none";
      }
    }
  }, [activeTermId, terminals]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObs = new ResizeObserver(() => {
      if (!activeTermId) return;
      const term = terminalsRef.current.find((t) => t.id === activeTermId);
      if (term) {
        term.fit.fit();
        if (term.xterm.cols && term.xterm.rows) {
          terminalApi.resize(activeTermId, term.xterm.cols, term.xterm.rows);
        }
      }
    });
    resizeObs.observe(el);
    return () => resizeObs.disconnect();
  }, [activeTermId]);

  useEffect(() => {
    if (cwd && terminals.length === 0) {
      createNewTerminal();
    }
  }, [cwd]);

  useEffect(() => {
    const handler = () => {
      createNewTerminal();
    };
    window.addEventListener("viper:open-terminal-here", handler);
    return () => window.removeEventListener("viper:open-terminal-here", handler);
  }, [createNewTerminal]);

  return (
    <div
      className="h-full w-full flex flex-col text-xs min-h-0 relative"
      style={{ background: "var(--viper-bg)" }}
    >
      <div
        className="flex items-center h-7 flex-shrink-0 border-b overflow-x-auto gap-0"
        style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
      >
        {terminals.map((term) => (
          <button
            key={term.id}
            type="button"
            className={`flex items-center gap-1 px-2 h-full text-[11px] border-r transition-colors shrink-0 ${
              term.id === activeTermId
                ? "bg-[var(--viper-bg)] text-[#e5e7eb]"
                : "text-[#6b7280] hover:text-[#9ca3af] hover:bg-white/[0.03]"
            }`}
            style={{ borderColor: "var(--viper-border)" }}
            onClick={() => setActiveTermId(term.id)}
          >
            <TerminalSquare size={11} />
            <span className="truncate max-w-[80px]">{term.label}</span>
            <span
              className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/10 text-[#6b7280] hover:text-[#e5e7eb]"
              onClick={(e) => {
                e.stopPropagation();
                destroyTerminal(term.id);
              }}
            >
              <X size={10} />
            </span>
          </button>
        ))}

        <div className="flex items-center ml-auto gap-0.5 px-1">
          {createError && (
            <span className="text-[10px] text-red-400 max-w-[220px] truncate" title={createError}>
              {createError}
            </span>
          )}
          <button
            type="button"
            className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
            title="New Terminal"
            onClick={createNewTerminal}
            disabled={creating}
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
            title="Clear Terminal"
            onClick={clearTerminal}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 w-full overflow-hidden p-[var(--viper-space-1)]"
        ref={containerRef}
      />

      {terminals.length === 0 && (
        <div className="absolute inset-0 top-7 flex items-center justify-center text-xs text-[#4b5563]">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-[#6b7280] hover:text-[#e5e7eb] hover:border-[var(--viper-accent)] transition-colors"
            style={{ borderColor: "var(--viper-border)" }}
            onClick={createNewTerminal}
            disabled={creating}
          >
            <Plus size={13} />
            New Terminal
          </button>
        </div>
      )}
    </div>
  );
}
