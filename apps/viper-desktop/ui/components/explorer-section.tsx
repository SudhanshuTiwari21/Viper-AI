import { useState, useCallback, useEffect, useRef } from "react";
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { fsApi } from "../services/filesystem";
import { FileTree } from "./file-tree";
import type { SidebarView } from "./activity-bar";

export interface ExplorerSectionProps {
  activeView: SidebarView;
}

export function ExplorerSection({ activeView }: ExplorerSectionProps) {
  const { workspace, reload, selectWorkspace } = useWorkspaceContext();
  const [collapseAll, setCollapseAll] = useState(0);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<"file" | "folder" | null>(null);
  const [createValue, setCreateValue] = useState("");
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [createParentPath, setCreateParentPath] = useState<string | null>(null);

  const workspaceName = workspace?.root
    ? workspace.root.replace(/\/$/, "").split("/").pop() ?? "Workspace"
    : null;
  const headerLabel = workspaceName ? workspaceName.toUpperCase() : "NO FOLDER OPENED";

  const onOpenFile = useCallback(
    async (relPath: string) => {
      if (!workspace) return;
      setError(null);
      setLoadingPath(relPath);
      try {
        const content = await fsApi.readFile(workspace.root, relPath);
        window.dispatchEvent(
          new CustomEvent("viper:open-file", {
            detail: { root: workspace.root, path: relPath, content },
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open file");
      } finally {
        setLoadingPath(null);
      }
    },
    [workspace]
  );

  const handleNewFile = useCallback(async () => {
    if (!workspace) return;
    setError(null);
    setCreateMode("file");
    setCreateValue("");
    setCreateParentPath(activeDir ?? "");
  }, [workspace, activeDir]);

  const handleNewFolder = useCallback(async () => {
    if (!workspace) return;
    setError(null);
    setCreateMode("folder");
    setCreateValue("");
    setCreateParentPath(activeDir ?? "");
  }, [workspace, activeDir]);

  const commitCreate = useCallback(async () => {
    if (!workspace || !createMode) {
      setCreateMode(null);
      setCreateValue("");
      setCreateParentPath(null);
      return;
    }
    const name = createValue.trim();
    if (!name) {
      setCreateMode(null);
      setCreateValue("");
      setCreateParentPath(null);
      return;
    }
    // Determine the base directory: the folder where the inline input was created.
    const baseDir = createParentPath ?? "";
    const base = baseDir.replace(/\/$/, "");
    const relPath = base ? `${base}/${name}` : name;
    try {
      if (createMode === "file") {
        await fsApi.createFile(workspace.root, relPath);
      } else {
        await fsApi.createFolder(workspace.root, relPath);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create path");
    } finally {
      setCreateMode(null);
      setCreateValue("");
      setCreateParentPath(null);
    }
  }, [workspace, createMode, createValue, createParentPath, reload]);

  const handleRefresh = useCallback(() => reload(), [reload]);
  const handleCollapseAll = useCallback(() => setCollapseAll((c) => c + 1), []);

  const handleSelectPath = useCallback((path: string, isDirectory: boolean) => {
    if (isDirectory) {
      setActiveDir(path);
    } else {
      const parts = path.split("/");
      parts.pop();
      const dir = parts.join("/");
      setActiveDir(dir || null);
    }
  }, []);

  const toolbarBtnClass =
    "p-[var(--viper-space-1)] rounded text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-white/5 transition-all duration-150 hover:shadow-[0_0_8px_rgba(34,197,94,0.12)]";

  if (activeView !== "explorer") return null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--viper-sidebar)" }}>
      {/* Styled section header: DOCKERA */}
      <div
        className="flex items-center justify-between min-h-9 px-[var(--viper-space-1)] flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wider text-[#e5e7eb] truncate flex-1 min-w-0"
          title={workspace?.root ?? ""}
        >
          {headerLabel}
        </span>
        <div className="flex items-center gap-0" style={{ gap: "var(--viper-space-1)" }}>
          <button type="button" className={toolbarBtnClass} title="New File" onClick={handleNewFile}>
            <FilePlus size={14} />
          </button>
          <button type="button" className={toolbarBtnClass} title="New Folder" onClick={handleNewFolder}>
            <FolderPlus size={14} />
          </button>
          <button type="button" className={toolbarBtnClass} title="Refresh" onClick={handleRefresh}>
            <RefreshCw size={14} />
          </button>
          <button type="button" className={toolbarBtnClass} title="Collapse All" onClick={handleCollapseAll}>
            <ChevronDown size={14} className="rotate-[-90deg]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-[var(--viper-space-1)]">
        {!workspace && (
          <div className="px-[var(--viper-space-2)] py-[var(--viper-space-3)] text-[13px] text-center text-[#6b7280]">
            No folder opened.
            <br />
            <button
              type="button"
              className="text-[var(--viper-accent)] hover:underline mt-[var(--viper-space-1)]"
              onClick={() => selectWorkspace().catch(console.error)}
            >
              Open Folder…
            </button>
          </div>
        )}
        {workspace && (
          <>
            <FileTree
              tree={workspace.tree}
              loadingPath={loadingPath}
              onOpenFile={onOpenFile}
              collapseAllTrigger={collapseAll}
              onSelectPath={handleSelectPath}
              createParentPath={createParentPath}
              createMode={createMode}
              createValue={createValue}
              onCreateChange={setCreateValue}
              onCreateCommit={() => {
                void commitCreate();
              }}
              onCreateCancel={() => {
                setCreateMode(null);
                setCreateValue("");
                setCreateParentPath(null);
              }}
            />
          </>
        )}
      </div>

      {error && (
        <div
          className="px-[var(--viper-space-2)] py-[var(--viper-space-1)] text-[11px] text-red-400 border-t"
          style={{ borderColor: "var(--viper-border)", background: "rgba(239,68,68,0.1)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
