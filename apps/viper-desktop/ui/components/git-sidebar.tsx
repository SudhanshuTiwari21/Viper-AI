import { useState, useCallback, useEffect } from "react";
import {
  GitBranch,
  RefreshCw,
  Plus,
  Minus,
  Check,
  Undo2,
  FileEdit,
  FilePlus2,
  FileX,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";

interface GitFileStatus {
  status: string;
  file: string;
}

const STATUS_ICONS: Record<string, typeof FileEdit> = {
  M: FileEdit,
  A: FilePlus2,
  D: FileX,
  "?": FilePlus2,
};

const STATUS_LABELS: Record<string, string> = {
  M: "Modified",
  A: "Added",
  D: "Deleted",
  "?": "Untracked",
  R: "Renamed",
  C: "Copied",
  U: "Unmerged",
};

const STATUS_COLORS: Record<string, string> = {
  M: "#eab308",
  A: "#22c55e",
  D: "#ef4444",
  "?": "#22c55e",
  U: "#f97316",
};

export function GitSidebar() {
  const { workspace } = useWorkspaceContext();
  const [branch, setBranch] = useState("");
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspace?.root) return;
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        window.viper.git.branch(workspace.root),
        window.viper.git.status(workspace.root),
      ]);
      setBranch(b);
      setFiles(s);
    } catch {
      setBranch("");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [workspace?.root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stagedFiles = files.filter(
    (f) => f.status.length >= 1 && f.status[0] !== " " && f.status[0] !== "?",
  );
  const unstagedFiles = files.filter(
    (f) => f.status === "??" || (f.status.length >= 2 && f.status[1] !== " "),
  );

  const handleStage = useCallback(
    async (filePath: string) => {
      if (!workspace?.root) return;
      await window.viper.git.stage(workspace.root, filePath);
      refresh();
    },
    [workspace?.root, refresh],
  );

  const handleUnstage = useCallback(
    async (filePath: string) => {
      if (!workspace?.root) return;
      await window.viper.git.unstage(workspace.root, filePath);
      refresh();
    },
    [workspace?.root, refresh],
  );

  const handleDiscard = useCallback(
    async (filePath: string) => {
      if (!workspace?.root) return;
      await window.viper.git.discard(workspace.root, filePath);
      refresh();
    },
    [workspace?.root, refresh],
  );

  const handleCommit = useCallback(async () => {
    if (!workspace?.root || !commitMsg.trim()) return;
    setCommitting(true);
    try {
      const ok = await window.viper.git.commit(workspace.root, commitMsg.trim());
      if (ok) {
        setCommitMsg("");
        refresh();
      }
    } finally {
      setCommitting(false);
    }
  }, [workspace?.root, commitMsg, refresh]);

  const handleStageAll = useCallback(async () => {
    if (!workspace?.root) return;
    for (const f of unstagedFiles) {
      await window.viper.git.stage(workspace.root, f.file);
    }
    refresh();
  }, [workspace?.root, unstagedFiles, refresh]);

  const fileName = (path: string) => path.split("/").pop() ?? path;
  const dirName = (path: string) => {
    const idx = path.lastIndexOf("/");
    return idx > 0 ? path.slice(0, idx) : "";
  };

  if (!workspace) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-xs text-[#6b7280] p-4">
        Open a folder to use source control.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: "var(--viper-sidebar)" }}
    >
      <div
        className="flex items-center justify-between h-9 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
            Source Control
          </span>
          {branch && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#6b7280]">
              <GitBranch size={10} />
              {branch}
            </span>
          )}
        </div>
        <button
          type="button"
          className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      <div className="px-2 pt-2 pb-1.5 flex flex-col gap-1 flex-shrink-0">
        <textarea
          className="w-full min-h-[60px] max-h-[120px] rounded border px-2 py-1.5 text-xs bg-transparent text-[#e5e7eb] outline-none placeholder:text-[#4b5563] resize-y"
          style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
          placeholder="Commit message"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleCommit();
            }
          }}
        />
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40"
          style={{
            background: stagedFiles.length > 0 ? "var(--viper-accent)" : "var(--viper-border)",
            color: stagedFiles.length > 0 ? "#0b0f17" : "#9ca3af",
          }}
          onClick={handleCommit}
          disabled={committing || !commitMsg.trim() || stagedFiles.length === 0}
        >
          {committing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Commit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Staged Changes */}
        <div>
          <button
            type="button"
            className="w-full flex items-center gap-1 px-2 py-1 hover:bg-white/[0.03] transition-colors"
            onClick={() => setStagedExpanded((v) => !v)}
          >
            <ChevronRight
              size={12}
              className={`text-[#6b7280] transition-transform ${stagedExpanded ? "rotate-90" : ""}`}
            />
            <span className="text-[11px] font-medium text-[#9ca3af] uppercase">
              Staged Changes
            </span>
            <span className="ml-auto text-[10px] text-[#4b5563]">{stagedFiles.length}</span>
          </button>
          {stagedExpanded &&
            stagedFiles.map((f) => {
              const st = f.status[0] ?? "M";
              const Icon = STATUS_ICONS[st] ?? FileEdit;
              const color = STATUS_COLORS[st] ?? "#9ca3af";
              return (
                <div
                  key={`s-${f.file}`}
                  className="flex items-center gap-1.5 px-4 py-0.5 group hover:bg-white/[0.03]"
                >
                  <Icon size={12} style={{ color }} className="shrink-0" />
                  <span className="text-xs text-[#e5e7eb] truncate flex-1">{fileName(f.file)}</span>
                  <span className="text-[10px] text-[#4b5563] truncate">{dirName(f.file)}</span>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#6b7280] hover:text-[#e5e7eb]"
                    title="Unstage"
                    onClick={() => handleUnstage(f.file)}
                  >
                    <Minus size={12} />
                  </button>
                </div>
              );
            })}
        </div>

        {/* Changes */}
        <div>
          <button
            type="button"
            className="w-full flex items-center gap-1 px-2 py-1 hover:bg-white/[0.03] transition-colors"
            onClick={() => setChangesExpanded((v) => !v)}
          >
            <ChevronRight
              size={12}
              className={`text-[#6b7280] transition-transform ${changesExpanded ? "rotate-90" : ""}`}
            />
            <span className="text-[11px] font-medium text-[#9ca3af] uppercase">
              Changes
            </span>
            <span className="ml-auto text-[10px] text-[#4b5563]">{unstagedFiles.length}</span>
            {unstagedFiles.length > 0 && (
              <button
                type="button"
                className="p-0.5 text-[#6b7280] hover:text-[#e5e7eb]"
                title="Stage All"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageAll();
                }}
              >
                <Plus size={12} />
              </button>
            )}
          </button>
          {changesExpanded &&
            unstagedFiles.map((f) => {
              const st = f.status === "??" ? "?" : (f.status[1] ?? "M");
              const Icon = STATUS_ICONS[st] ?? FileEdit;
              const color = STATUS_COLORS[st] ?? "#9ca3af";
              return (
                <div
                  key={`u-${f.file}`}
                  className="flex items-center gap-1.5 px-4 py-0.5 group hover:bg-white/[0.03]"
                >
                  <Icon size={12} style={{ color }} className="shrink-0" />
                  <span className="text-xs text-[#e5e7eb] truncate flex-1">{fileName(f.file)}</span>
                  <span className="text-[10px] text-[#4b5563] truncate">{dirName(f.file)}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      className="p-0.5 text-[#6b7280] hover:text-[#ef4444]"
                      title="Discard"
                      onClick={() => handleDiscard(f.file)}
                    >
                      <Undo2 size={12} />
                    </button>
                    <button
                      type="button"
                      className="p-0.5 text-[#6b7280] hover:text-[#e5e7eb]"
                      title="Stage"
                      onClick={() => handleStage(f.file)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {files.length === 0 && !loading && (
          <div className="px-3 py-4 text-xs text-[#6b7280] text-center">
            No changes detected
          </div>
        )}
      </div>
    </div>
  );
}
