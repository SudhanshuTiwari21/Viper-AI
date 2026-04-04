import type { StreamingPhase } from "../contexts/chat-context";

interface ThinkingIndicatorProps {
  phase?: StreamingPhase;
}

const PHASE_LABELS: Record<string, string> = {
  intent: "Understanding intent\u2026",
  planning: "Planning approach\u2026",
  indexing: "Indexing workspace\u2026",
  executing: "Executing steps\u2026",
  reasoning: "Analyzing context\u2026",
  generating: "Generating solution\u2026",
  awaiting_approval: "Waiting for approval\u2026",
};

export function ThinkingIndicator({ phase }: ThinkingIndicatorProps) {
  const label = phase ? PHASE_LABELS[phase] ?? "Thinking\u2026" : "Thinking\u2026";

  return (
    <div className="flex items-center gap-2.5 py-2 animate-v-fade-in">
      <div className="flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-v-accent animate-v-thinking v-dot-1" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-v-accent animate-v-thinking v-dot-2" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-v-accent animate-v-thinking v-dot-3" />
      </div>
      <span className="text-sm text-v-text2">{label}</span>
    </div>
  );
}
