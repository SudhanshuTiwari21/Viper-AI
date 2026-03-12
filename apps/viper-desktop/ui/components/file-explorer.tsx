import { useState } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import type { FileNode } from "../services/filesystem";
import { fsApi } from "../services/filesystem";
import { FileIcon } from "./file-icons";

const INDENT = 16;

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
  const [expanded, setExpanded] = useState(true);
  const isDir = node.isDirectory;
  const isLoading = !isDir && loadingPath === node.path;

  if (isDir) {
    return (
      <div className="select-none">
        <button
          type="button"
          className="w-full flex items-center gap-1 py-1 px-2 text-left text-xs text-zinc-300 hover:bg-zinc-800/70 rounded cursor-pointer"
          style={{ paddingLeft: 8 + depth * INDENT }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="flex-shrink-0 w-4 text-zinc-500 text-[10px]">
            {expanded ? "▾" : "▸"}
          </span>
          <FileIcon node={node} />
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
      className="w-full flex items-center py-1 px-2 text-left text-xs text-zinc-300 hover:bg-zinc-800/70 rounded cursor-pointer"
      style={{ paddingLeft: 8 + depth * INDENT + 16 }}
      onClick={() => onOpenFile(node.path)}
      disabled={isLoading}
    >
      <span className="flex-shrink-0 w-4" />
      <FileIcon node={node} />
      <span className="truncate flex-1">{node.name}</span>
      {isLoading && (
        <span className="text-[10px] text-zinc-500 ml-1">…</span>
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
    <div className="flex flex-col h-full bg-[#0f0f10]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/80 flex-shrink-0">
        <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
          Explorer
        </span>
        <button
          type="button"
          className="text-[11px] px-2 py-1 rounded bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 transition-colors"
          onClick={() => selectWorkspace().catch(console.error)}
        >
          Open Folder…
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 min-h-0">
        {!workspace && (
          <div className="px-3 py-6 text-zinc-500 text-xs text-center">
            No folder opened.
            <br />
            Click &quot;Open Folder…&quot; to choose a project (defaults to your home directory).
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
        <div className="px-3 py-1.5 text-[11px] text-red-400 border-t border-zinc-800/80 bg-red-950/20">
          {error}
        </div>
      )}
    </div>
  );
}
