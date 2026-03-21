import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import type { ExploredCounts } from "../contexts/chat-context";

interface FileExplorationProps {
  files: string[];
  counts?: ExploredCounts;
}

export function FileExploration({ files, counts }: FileExplorationProps) {
  const [open, setOpen] = useState(false);

  if (files.length === 0) return null;

  const summary = counts
    ? `Explored ${counts.files} files, ${counts.functions} functions`
    : `Explored ${files.length} files`;

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
        <FileText size={14} className="shrink-0 text-v-accent" />
        <span>{summary}</span>
      </button>

      <div className={`v-collapsible ${open ? "v-open" : ""}`}>
        <div className="v-collapsible-inner">
          <ul className="space-y-0.5 px-3 pb-3 pt-1">
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
