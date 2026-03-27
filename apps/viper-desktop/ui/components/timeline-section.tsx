import { useState, useEffect } from "react";
import { GitCommit } from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { useCurrentFile } from "../contexts/current-file-context";
import type { SidebarView } from "./activity-bar";

export interface TimelineSectionProps {
  activeView: SidebarView;
}

export function TimelineSection({ activeView }: TimelineSectionProps) {
  const { workspace } = useWorkspaceContext();
  const { currentFile } = useCurrentFile();
  const [commits, setCommits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeView !== "timeline" || !workspace?.root || !currentFile.path) {
      setCommits([]);
      return;
    }
    setLoading(true);
    setError(null);
    window.viper.git
      .log(workspace.root, currentFile.path)
      .then(setCommits)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeView, workspace?.root, currentFile.path]);

  if (activeView !== "timeline") return null;

  return (
    <div className="flex flex-col h-full bg-[#252526]">
      <div className="flex items-center h-9 px-3 flex-shrink-0 border-b border-[#3c3c3c]">
        <span className="text-[#bbbbbb] text-[11px] font-medium uppercase tracking-wider">
          Timeline
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 py-1 px-2">
        {!currentFile.path && (
          <p className="text-[#858585] text-[12px]">Select a file to see its history.</p>
        )}
        {currentFile.path && loading && (
          <p className="text-[#858585] text-[12px]">Loading…</p>
        )}
        {currentFile.path && error && (
          <p className="text-red-400 text-[12px]">{error}</p>
        )}
        {currentFile.path && !loading && !error && commits.length === 0 && (
          <p className="text-[#858585] text-[12px]">No commits found.</p>
        )}
        {commits.length > 0 && (
          <ul className="text-[12px] text-[#cccccc] space-y-1">
            {commits.map((line) => (
              <li
                key={line}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/[0.06] cursor-pointer"
              >
                <GitCommit size={14} className="text-[#6b6b6b] flex-shrink-0" />
                <span className="truncate font-mono">{line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
