import { useState, useMemo } from "react";
import { ChevronRight, Check, Loader2, SkipForward, Zap } from "lucide-react";
import type { ExecutionStep } from "../contexts/chat-context";

interface StepTimelineProps {
  steps: ExecutionStep[];
}

function formatMs(ms?: number): string {
  if (ms == null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function StepIcon({ status }: { status: ExecutionStep["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 size={14} className="shrink-0 text-v-accent animate-v-spin" />;
    case "complete":
      return <Check size={14} className="shrink-0 text-v-success" />;
    case "skipped":
      return <SkipForward size={14} className="shrink-0 text-v-text3" />;
  }
}

function stepLabel(step: ExecutionStep): string {
  const typeMap: Record<string, string> = {
    SEARCH_SYMBOL: "Searching symbols",
    SEARCH_EMBEDDING: "Semantic search",
    READ_FILE: "Reading file",
    IMPLEMENT: "Generating code",
    VALIDATE: "Validating changes",
    ANALYZE: "Analyzing codebase",
  };
  return typeMap[step.stepType] ?? step.stepType;
}

export function StepTimeline({ steps }: StepTimelineProps) {
  const [open, setOpen] = useState(false);

  const totalMs = useMemo(
    () => steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0),
    [steps],
  );

  const running = steps.filter((s) => s.status === "running").length;
  const completed = steps.filter((s) => s.status === "complete").length;

  if (steps.length === 0) return null;

  const summaryText = running > 0
    ? `Running step ${completed + 1} of ${steps.length}\u2026`
    : `Executed ${completed} steps (${formatMs(totalMs)})`;

  return (
    <div className="animate-v-fade-in rounded-lg border border-v-border bg-v-bg2 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="v-press flex w-full items-center gap-2 px-3 py-2 text-sm text-v-text2 hover:text-v-text transition-colors"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        <Zap size={14} className="shrink-0 text-v-warning" />
        <span className="flex-1 text-left">{summaryText}</span>
        {running > 0 && (
          <Loader2 size={12} className="animate-v-spin text-v-accent" />
        )}
      </button>

      <div className={`v-collapsible ${open ? "v-open" : ""}`}>
        <div className="v-collapsible-inner">
          <ul className="space-y-0.5 px-3 pb-3 pt-1">
            {steps.map((step) => (
              <li
                key={step.stepId}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white/[0.03] transition-colors"
              >
                <StepIcon status={step.status} />
                <span
                  className={`flex-1 ${step.status === "skipped" ? "text-v-text3" : "text-v-text"}`}
                >
                  {stepLabel(step)}
                </span>
                {step.durationMs != null && (
                  <span className="text-xs text-v-text3 font-mono tabular-nums">
                    {formatMs(step.durationMs)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
