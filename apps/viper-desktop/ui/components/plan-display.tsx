import { useState } from "react";
import { ChevronRight, ListChecks } from "lucide-react";
import type { PlanStep } from "../contexts/chat-context";
import { stripMarkdownForChat } from "../services/agent-api";

interface PlanDisplayProps {
  /** Streamed LLM plan (preferred over raw step types). */
  narrative?: string;
  /** Legacy: structured steps when narrative not used. */
  steps?: PlanStep[];
}

export function PlanDisplay({ narrative, steps = [] }: PlanDisplayProps) {
  const [open, setOpen] = useState(true);

  const hasNarrative = Boolean(narrative?.trim());
  const hasSteps = steps.length > 0;
  if (!hasNarrative && !hasSteps) return null;

  return (
    <div className="animate-v-fade-in">
      <div className="animate-v-subtle-pulse rounded-lg border border-v-border bg-v-bg2 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="v-press flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-v-text2 transition-colors hover:bg-white/[0.03] hover:text-v-text"
        >
          <ChevronRight
            size={14}
            className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          <ListChecks size={14} className="shrink-0 text-v-accent" />
          <span>{hasNarrative ? "Plan" : `Plan (${steps.length} steps)`}</span>
        </button>

        <div className={`v-collapsible ${open ? "v-open" : ""}`}>
          <div className="v-collapsible-inner">
            {hasNarrative ? (
              <div className="px-3 pb-3 pt-1 text-sm text-v-text leading-relaxed whitespace-pre-wrap">
                {stripMarkdownForChat(narrative!)}
              </div>
            ) : (
              <ul className="space-y-1.5 px-3 pb-3 pt-1">
                {steps.map((step) => (
                  <li key={step.id} className="text-sm text-v-text leading-snug">
                    {step.description ?? step.type}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
