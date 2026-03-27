import { useEffect, useRef, useState } from "react";
import { ChevronRight, TerminalSquare, CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react";

interface CommandOutputProps {
  command: string;
  output: string;
  isRunning: boolean;
  exitStatus?: string;
}

const MAX_VISIBLE_LINES = 30;

export function CommandOutput({ command, output, isRunning, exitStatus }: CommandOutputProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (outputRef.current && expanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, expanded]);

  const lines = output.split("\n");
  const truncated = lines.length > MAX_VISIBLE_LINES;
  const visibleOutput = truncated
    ? lines.slice(-MAX_VISIBLE_LINES).join("\n")
    : output;

  const handleCopy = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const isSuccess = exitStatus?.includes("succeeded");
  const isFailed = exitStatus?.includes("failed");

  return (
    <div
      className="rounded-lg border overflow-hidden animate-v-fade-in"
      style={{
        borderColor: isRunning
          ? "rgba(34, 197, 94, 0.3)"
          : isFailed
            ? "rgba(239, 68, 68, 0.2)"
            : "var(--viper-border)",
        background: "#0a0e14",
      }}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 text-v-text3/60 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        {isRunning ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-emerald-400" />
        ) : isSuccess ? (
          <CheckCircle2 size={12} className="shrink-0 text-emerald-500/70" />
        ) : isFailed ? (
          <XCircle size={12} className="shrink-0 text-red-400/70" />
        ) : (
          <TerminalSquare size={12} className="shrink-0 text-v-text3/60" />
        )}
        <span className="text-2xs font-mono text-v-text2 truncate">
          $ {command}
        </span>
        {isRunning && (
          <span className="ml-auto text-[9px] text-emerald-400/70 tabular-nums animate-pulse">
            running
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t relative" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {truncated && (
            <div className="px-2.5 py-0.5 text-[9px] text-v-text3/50 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              ... {lines.length - MAX_VISIBLE_LINES} lines above
            </div>
          )}
          <pre
            ref={outputRef}
            className="px-2.5 py-2 text-[11px] leading-[1.5] font-mono text-[#a1a1aa] overflow-auto select-text"
            style={{
              maxHeight: 280,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              tabSize: 4,
            }}
          >
            {visibleOutput || (isRunning ? "" : "(no output)")}
            {isRunning && <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
          </pre>

          <div className="absolute top-1 right-1">
            <button
              type="button"
              className="p-1 rounded text-v-text3/40 hover:text-v-text2 hover:bg-white/5 transition-colors"
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              title="Copy output"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
