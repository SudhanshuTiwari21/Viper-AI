import { useState } from "react";
import { ChevronRight, ListChecks } from "lucide-react";
import type { PlanStep } from "../contexts/chat-context";

interface PlanDisplayProps {
  steps: PlanStep[];
}

export function PlanDisplay({ steps }: PlanDisplayProps) {
  const [open, setOpen] = useState(false);

  if (steps.length === 0) return null;

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
        <ListChecks size={14} className="shrink-0 text-v-accent" />
        <span>Plan ({steps.length} steps)</span>
      </button>

      <div className={`v-collapsible ${open ? "v-open" : ""}`}>
        <div className="v-collapsible-inner">
          <ul className="space-y-1 px-3 pb-3 pt-1">
            {steps.map((step, i) => (
              <li key={step.id} className="flex items-start gap-2 text-sm">
                <span className="mt-px shrink-0 w-5 text-right text-v-text3 font-mono text-xs">
                  {i + 1}.
                </span>
                <span className="text-v-text">
                  {step.description ?? step.type}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
