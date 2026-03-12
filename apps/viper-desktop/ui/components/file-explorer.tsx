import { useState } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import type { FileNode } from "../services/filesystem";
import { fsApi } from "../services/filesystem";
import { FileIcon } from "./file-icons";

/** Cursor-like compact tree: indent and row height */
const INDENT = 12;

function TreeNode({
  node,
  depth,
  onOpenFile,
  loadingPath,
}: {
  node: FileNode;
  depth: number;
  onOpenFile: (relPath: string) => void;
  loadingPath: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDir = node.isDirectory;
  const isLoading = !isDir && loadingPath === node.path;

  if (isDir) {
    return (
      <div className="select-none">
        <button
          type="button"
          className="w-full flex items-center gap-0 py-[2px] pl-0 pr-1 text-left text-[13px] text-[#cccccc] hover:bg-white/[0.06] rounded cursor-pointer border-transparent min-h-[22px]"
          style={{ paddingLeft: 4 + depth * INDENT }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="flex-shrink-0 w-4 text-[#6b6b6b] text-[8px] flex items-center justify-center leading-none">
            {expanded ? "▼" : "▶"}
          </span>
          <FileIcon node={node} expanded={expanded} />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.length ? (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                loadingPath={loadingPath}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="w-full flex items-center gap-0 py-[2px] pl-0 pr-1 text-left text-[13px] text-[#cccccc] hover:bg-white/[0.06] rounded cursor-pointer min-h-[22px] disabled:opacity-70"
      style={{ paddingLeft: 4 + depth * INDENT + 20 }}
      onClick={() => onOpenFile(node.path)}
      disabled={isLoading}
    >
      <span className="flex-shrink-0 w-4" />
      <FileIcon node={node} />
      <span className="truncate flex-1 text-left">{node.name}</span>
      {isLoading && (
        <span className="text-[10px] text-[#6b6b6b] ml-1">…</span>
      )}
    </button>
  );
}

export function FileExplorer() {
  const { workspace, selectWorkspace } = useWorkspaceContext();
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onOpenFile = async (relPath: string) => {
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
  };

  return (
    <div className="flex flex-col h-full bg-[#252526]">
      {/* Cursor/VS Code style title bar */}
      <div className="flex items-center justify-between h-9 px-3 flex-shrink-0 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#bbbbbb] text-[11px] font-medium uppercase tracking-wider">
            Explorer
          </span>
        </div>
        <button
          type="button"
          className="text-[11px] px-2 py-0.5 rounded text-[#cccccc] hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
          onClick={() => selectWorkspace().catch(console.error)}
          title="Open Folder"
        >
          Open Folder…
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-0.5">
        {!workspace && (
          <div className="px-3 py-6 text-[#858585] text-[13px] text-center">
            No folder opened.
            <br />
            <span className="text-[12px]">Click &quot;Open Folder…&quot; to choose a project.</span>
          </div>
        )}
        {workspace &&
          workspace.tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onOpenFile={onOpenFile}
              loadingPath={loadingPath}
            />
          ))}
      </div>
      {error && (
        <div className="px-3 py-1.5 text-[11px] text-red-400 border-t border-[#3c3c3c] bg-red-950/30">
          {error}
        </div>
      )}
    </div>
  );
}
