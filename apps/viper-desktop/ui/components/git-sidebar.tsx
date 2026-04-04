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
  Sparkles,
  Copy,
  X,
} from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import {
  fetchSuggestCommitMessage,
  fetchSuggestPrBody,
} from "../services/agent-api";

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

  // G.38: AI commit assistant state
  const [aiCommitLoading, setAiCommitLoading] = useState(false);
  const [aiCommitError, setAiCommitError] = useState<string | null>(null);

  // G.38: AI PR description state
  const [aiPrLoading, setAiPrLoading] = useState(false);
  const [aiPrError, setAiPrError] = useState<string | null>(null);
  const [prDescription, setPrDescription] = useState<{ title: string; body: string } | null>(null);
  const [prModalOpen, setPrModalOpen] = useState(false);

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

  // G.38: Generate AI commit message
  const handleAiCommit = useCallback(async () => {
    if (!workspace?.root) return;
    setAiCommitLoading(true);
    setAiCommitError(null);
    try {
      const stagedDiff = await window.viper.git.diffStaged(workspace.root);
      if (!stagedDiff) {
        setAiCommitError("No staged changes to generate a commit message for.");
        return;
      }
      const result = await fetchSuggestCommitMessage({
        workspacePath: workspace.root,
        branch: branch || undefined,
        stagedDiff,
        style: "conventional",
      });
      // Fill commit message textarea: subject + optional body
      const full = result.body
        ? `${result.subject}\n\n${result.body}`
        : result.subject;
      setCommitMsg(full);
    } catch (err) {
      setAiCommitError(err instanceof Error ? err.message : "AI commit failed.");
    } finally {
      setAiCommitLoading(false);
    }
  }, [workspace?.root, branch]);

  // G.38: Generate AI PR description
  const handleAiPr = useCallback(async () => {
    if (!workspace?.root) return;
    setAiPrLoading(true);
    setAiPrError(null);
    try {
      const stagedDiff = await window.viper.git.diffStaged(workspace.root);
      if (!stagedDiff) {
        setAiPrError("No staged changes to generate a PR description for.");
        return;
      }
      const result = await fetchSuggestPrBody({
        workspacePath: workspace.root,
        branch: branch || undefined,
        stagedDiff,
      });
      setPrDescription(result);
      setPrModalOpen(true);
    } catch (err) {
      setAiPrError(err instanceof Error ? err.message : "AI PR description failed.");
    } finally {
      setAiPrLoading(false);
    }
  }, [workspace?.root, branch]);

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

        {/* G.38: AI generate commit message */}
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 w-full py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40 border"
          style={{
            borderColor: "var(--viper-accent)",
            color: "var(--viper-accent)",
            background: "transparent",
          }}
          onClick={handleAiCommit}
          disabled={aiCommitLoading || stagedFiles.length === 0}
          title="Generate commit message from staged diff"
        >
          {aiCommitLoading
            ? <Loader2 size={11} className="animate-spin" />
            : <Sparkles size={11} />}
          Generate commit message (AI)
        </button>

        {aiCommitError && (
          <p className="text-[10px] text-[#ef4444] px-0.5">{aiCommitError}</p>
        )}

        {/* G.38: AI generate PR description */}
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 w-full py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40 border"
          style={{
            borderColor: "var(--viper-border)",
            color: "#9ca3af",
            background: "transparent",
          }}
          onClick={handleAiPr}
          disabled={aiPrLoading || stagedFiles.length === 0}
          title="Generate PR description from staged diff"
        >
          {aiPrLoading
            ? <Loader2 size={11} className="animate-spin" />
            : <Sparkles size={11} />}
          Generate PR description (AI)
        </button>

        {aiPrError && (
          <p className="text-[10px] text-[#ef4444] px-0.5">{aiPrError}</p>
        )}

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

      {/* G.38: PR description modal */}
      {prModalOpen && prDescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPrModalOpen(false)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-[600px] mx-4 rounded-lg shadow-2xl border flex flex-col max-h-[80vh]"
            style={{ background: "var(--viper-sidebar)", borderColor: "var(--viper-border)" }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: "var(--viper-border)" }}
            >
              <h2 className="text-sm font-medium text-[#e5e7eb]">
                AI-Generated PR Description
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-white/10 transition-colors"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${prDescription.title}\n\n${prDescription.body}`,
                      );
                    } catch { /* ignore */ }
                  }}
                  title="Copy to clipboard"
                >
                  <Copy size={12} />
                  Copy
                </button>
                <button
                  type="button"
                  className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/10"
                  onClick={() => setPrModalOpen(false)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Title */}
            <div
              className="px-4 pt-3 pb-2 flex-shrink-0 border-b"
              style={{ borderColor: "var(--viper-border)" }}
            >
              <p className="text-[10px] text-[#6b7280] mb-1 uppercase tracking-wider">
                Title
              </p>
              <p className="text-sm text-[#e5e7eb] font-medium">{prDescription.title}</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              <p className="text-[10px] text-[#6b7280] mb-1 uppercase tracking-wider">
                Body
              </p>
              <pre
                className="text-xs text-[#d1d5db] whitespace-pre-wrap font-sans leading-relaxed"
              >
                {prDescription.body}
              </pre>
            </div>

            <div
              className="flex justify-end gap-2 px-4 py-3 border-t flex-shrink-0"
              style={{ borderColor: "var(--viper-border)" }}
            >
              <button
                type="button"
                className="px-3 py-1.5 rounded text-xs text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-white/5 transition-colors"
                onClick={() => setPrModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{ background: "var(--viper-accent)", color: "#0b0f17" }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${prDescription.title}\n\n${prDescription.body}`,
                    );
                    setPrModalOpen(false);
                  } catch { /* ignore */ }
                }}
              >
                <Copy size={11} />
                Copy &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

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
