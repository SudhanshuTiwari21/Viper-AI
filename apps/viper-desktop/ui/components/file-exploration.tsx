import { useState } from "react";
import { ChevronRight, FileText, Loader2 } from "lucide-react";
import type { ExploredCounts, ExplorationPhase } from "../contexts/chat-context";

interface FileExplorationProps {
  files: string[];
  counts?: ExploredCounts;
  phase?: ExplorationPhase;
}

export function FileExploration({ files, counts, phase }: FileExplorationProps) {
  const [open, setOpen] = useState(false);

  const isExploring = phase === "exploring";

  let summary: string;
  if (isExploring && files.length === 0) {
    summary = "Exploring files\u2026";
  } else if (isExploring) {
    summary = `Exploring ${files.length} file${files.length !== 1 ? "s" : ""}\u2026`;
  } else if (counts) {
    summary = `Explored ${counts.files} files, ${counts.functions} functions`;
  } else {
    summary = `Explored ${files.length} file${files.length !== 1 ? "s" : ""}`;
  }

  return (
    <div className="animate-v-slide-up rounded-lg border border-v-border bg-v-bg2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="v-press flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-sm text-v-text2 transition-colors hover:bg-white/[0.03] hover:text-v-text"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        {isExploring ? (
          <Loader2 size={14} className="shrink-0 text-v-accent animate-v-spin" />
        ) : (
          <FileText size={14} className="shrink-0 text-v-accent" />
        )}
        <span>{summary}</span>
      </button>

      <div className={`v-collapsible ${open ? "v-open" : ""}`}>
        <div className="v-collapsible-inner">
          <ul className="space-y-0.5 px-2 pb-2 pt-0.5">
            {files.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs font-mono text-v-text2 hover:bg-white/[0.03] hover:text-v-text transition-colors cursor-pointer"
              >
                <FileText size={12} className="shrink-0 text-v-text3" />
                <span className="truncate">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
