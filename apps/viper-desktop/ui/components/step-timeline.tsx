import { useState, useMemo } from "react";
import { ChevronRight, Check, Loader2, SkipForward, Zap } from "lucide-react";
import type { ExecutionStep } from "../contexts/chat-context";

interface StepTimelineProps {
  steps: ExecutionStep[];
  actionNarration?: string;
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
    ANALYZE_CODE: "Analyze code (planner)",
    GENERATE_PATCH: "Generate patch",
  };
  return typeMap[step.stepType] ?? step.stepType;
}

export function StepTimeline({ steps, actionNarration }: StepTimelineProps) {
  const [open, setOpen] = useState(false);

  const totalMs = useMemo(
    () => steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0),
    [steps],
  );

  const running = steps.filter((s) => s.status === "running").length;
  const completed = steps.filter((s) => s.status === "complete").length;

  if (steps.length === 0) return null;

  const summaryText =
    running > 0
      ? `Working\u2026 (${completed}/${steps.length} complete)`
      : `Executed ${completed} steps (${formatMs(totalMs)})`;

  return (
    <div className="animate-v-slide-up space-y-1.5">
      <div className="border-l border-v-border pl-2 space-y-1.5 animate-v-subtle-pulse">
        {actionNarration && running > 0 && (
          <div className="text-xs text-v-text2 italic animate-v-fade-in">
            {actionNarration}
          </div>
        )}

        <div className="rounded-lg border border-v-border bg-v-bg2 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="v-press flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-sm text-v-text2 transition-colors hover:bg-white/[0.03] hover:text-v-text"
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
              <ul className="space-y-0.5 px-2 pb-2 pt-0.5">
                {steps.map((step) => (
                  <li
                    key={step.stepId}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-white/[0.04] cursor-default"
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
      </div>
    </div>
  );
}

