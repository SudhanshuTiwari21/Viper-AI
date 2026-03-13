import { useState } from "react";
import type { FileNode } from "../services/filesystem";
import { FileIcon } from "./file-icons";
import { useContextMenu } from "../context-menu/context-menu-provider";
import type { ContextMenuItem } from "../context-menu/context-menu-types";

const INDENT = 12;

interface CreateRowProps {
  depth: number;
  mode: "file" | "folder";
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function CreateRow({ depth, mode, value, onChange, onCommit, onCancel }: CreateRowProps) {
  return (
    <div className="px-0" style={{ paddingLeft: 8 + depth * INDENT + 20 }}>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (!value.trim()) {
            onCancel();
          }
        }}
        placeholder={mode === "file" ? "New file name" : "New folder name"}
        className="w-full rounded bg-[#111827] border border-[var(--viper-border)] px-2 py-1 text-[13px] text-[#e5e7eb] placeholder-[#6b7280] outline-none focus:border-[var(--viper-accent)]"
      />
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onOpenFile: (relPath: string) => void;
  loadingPath: string | null;
  onSelectPath: (path: string, isDirectory: boolean) => void;
  createParentPath: string;
  createMode: "file" | "folder" | null;
  createValue: string;
  onCreateChange: (value: string) => void;
  onCreateCommit: () => void;
  onCreateCancel: () => void;
  /** Error count for this file (from diagnostics). */
  errorCount?: number;
  /** Warning count for this file (from diagnostics). */
  warningCount?: number;
  /** Map of path -> error count (passed through for children). */
  errorsByPath?: Record<string, number>;
  /** Map of path -> warning count (passed through for children). */
  warningsByPath?: Record<string, number>;
  /** Workspace root (absolute) for building context menu targets. */
  workspaceRoot?: string | null;
}

function TreeNode({
  node,
  depth,
  onOpenFile,
  loadingPath,
  onSelectPath,
  createParentPath,
  createMode,
  createValue,
  onCreateChange,
  onCreateCommit,
  onCreateCancel,
  errorCount = 0,
  warningCount = 0,
  errorsByPath = {},
  warningsByPath = {},
  workspaceRoot,
}: TreeNodeProps) {
  const { openMenu } = useContextMenu();
  const [expanded, setExpanded] = useState(false);
  const isDir = node.isDirectory;
  const isLoading = !isDir && loadingPath === node.path;
  const hasErrors = !isDir && errorCount > 0;
  const hasWarnings = !isDir && warningCount > 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!workspaceRoot) return;
    e.preventDefault();
    e.stopPropagation();

    const target = {
      path: node.path,
      isDirectory: isDir,
      workspaceRoot,
      name: node.name,
    };

    const items: ContextMenuItem[] = [];

    if (isDir) {
      items.push(
        { id: "new-file", label: "New File…", command: "explorer.newFileInFolder" },
        { id: "new-folder", label: "New Folder…", command: "explorer.newFolderInFolder" },
        { id: "reveal", label: "Reveal in Finder", command: "explorer.revealInFinder" },
        { id: "open-term", label: "Open in Integrated Terminal", command: "explorer.openTerminalHere" },
        { id: "sep-1", label: "-", separator: true },
        {
          id: "share",
          label: "Share",
          submenu: [
            { id: "copy-abs", label: "Copy Absolute Path", command: "explorer.copyAbsolutePath" },
            { id: "copy-url", label: "Copy File URL", command: "explorer.copyFileUrl" },
          ],
        },
        { id: "sep-2", label: "-", separator: true },
        { id: "add-chat", label: "Add Directory to Viper Chat", command: "viper.chat.addDirectory" },
        { id: "add-chat-new", label: "Add Directory to New Viper Chat", command: "viper.chat.addDirectoryNew" },
        { id: "sep-3", label: "-", separator: true },
        { id: "copy-path", label: "Copy Path", command: "explorer.copyRelativePath" },
        { id: "rename", label: "Rename", command: "explorer.rename" },
        { id: "delete", label: "Delete", command: "explorer.delete" }
      );
    } else {
      items.push(
        { id: "open-side", label: "Open to the Side", command: "explorer.openToSide" },
        { id: "reveal", label: "Reveal in Finder", command: "explorer.revealInFinder" },
        { id: "open-term", label: "Open in Integrated Terminal", command: "explorer.openTerminalHere" },
        { id: "sep-1", label: "-", separator: true },
        {
          id: "share",
          label: "Share",
          submenu: [
            { id: "copy-abs", label: "Copy Absolute Path", command: "explorer.copyAbsolutePath" },
            { id: "copy-url", label: "Copy File URL", command: "explorer.copyFileUrl" },
          ],
        },
        { id: "sep-2", label: "-", separator: true },
        { id: "add-chat", label: "Add File to Viper Chat", command: "viper.chat.addFile" },
        { id: "add-chat-new", label: "Add File to New Viper Chat", command: "viper.chat.addFileNew" },
        { id: "sep-3", label: "-", separator: true },
        { id: "copy-path", label: "Copy Path", command: "explorer.copyRelativePath" },
        { id: "rename", label: "Rename", command: "explorer.rename" },
        { id: "delete", label: "Delete", command: "explorer.delete" }
      );
    }

    openMenu(items, { x: e.clientX, y: e.clientY }, target);
  };

  if (isDir) {
    return (
      <div className="select-none">
        <button
          type="button"
          className="w-full flex items-center gap-0 py-[2px] pl-0 pr-[var(--viper-space-1)] text-left text-[13px] text-[#e5e7eb] hover:bg-white/[0.06] rounded cursor-pointer border-transparent min-h-[22px]"
          style={{ paddingLeft: 8 + depth * INDENT }}
          onClick={() => {
            onSelectPath(node.path, true);
            setExpanded((e) => !e);
          }}
          onContextMenu={handleContextMenu}
        >
          <span className="flex-shrink-0 w-4 text-[#6b6b6b] text-[8px] flex items-center justify-center leading-none">
            {expanded ? "▼" : "▶"}
          </span>
          <FileIcon node={node} expanded={expanded} />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onOpenFile={onOpenFile}
                loadingPath={loadingPath}
                onSelectPath={onSelectPath}
                createParentPath={createParentPath}
                createMode={createMode}
                createValue={createValue}
                onCreateChange={onCreateChange}
                onCreateCommit={onCreateCommit}
                onCreateCancel={onCreateCancel}
                errorCount={errorsByPath[child.path]}
                warningCount={warningsByPath[child.path]}
                errorsByPath={errorsByPath}
                warningsByPath={warningsByPath}
              />
            )) ?? null}
            {createMode && createParentPath === node.path && (
              <CreateRow
                depth={depth + 1}
                mode={createMode}
                value={createValue}
                onChange={onCreateChange}
                onCommit={onCreateCommit}
                onCancel={onCreateCancel}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="w-full flex items-center gap-0 py-[2px] pl-0 pr-[var(--viper-space-1)] text-left text-[13px] hover:bg-white/[0.06] rounded cursor-pointer min-h-[22px] disabled:opacity-70"
      style={{ paddingLeft: 8 + depth * INDENT + 20 }}
      onClick={() => {
        onSelectPath(node.path, false);
        onOpenFile(node.path);
      }}
      onContextMenu={handleContextMenu}
      disabled={isLoading}
    >
      <span className="flex-shrink-0 w-4" />
      <FileIcon node={node} />
      <span
        className={`truncate flex-1 text-left ${hasErrors ? "text-red-400" : hasWarnings ? "text-amber-400" : "text-[#e5e7eb]"}`}
      >
        {node.name}
      </span>
      {hasErrors && (
        <span
          className="flex-shrink-0 ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-medium bg-red-500/20 text-red-400"
          title={`${errorCount} error(s)`}
        >
          {errorCount}
        </span>
      )}
      {hasWarnings && !hasErrors && (
        <span
          className="flex-shrink-0 ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400"
          title={`${warningCount} warning(s)`}
        >
          {warningCount}
        </span>
      )}
      {isLoading && !hasErrors && !hasWarnings && (
        <span className="text-[10px] text-[#6b6b6b] ml-1">…</span>
      )}
    </button>
  );
}

export interface FileTreeProps {
  tree: FileNode[];
  loadingPath: string | null;
  onOpenFile: (relPath: string) => void;
  /** Increment to collapse all folders (remounts tree) */
  collapseAllTrigger?: number;
  onSelectPath?: (path: string, isDirectory: boolean) => void;
  createParentPath?: string | null;
  createMode?: "file" | "folder" | null;
  createValue?: string;
  onCreateChange?: (value: string) => void;
  onCreateCommit?: () => void;
  onCreateCancel?: () => void;
  /** Map of workspace-relative path -> error count (for badges and red file names). */
  errorsByPath?: Record<string, number>;
  /** Map of workspace-relative path -> warning count (for yellow badges). */
  warningsByPath?: Record<string, number>;
  /** Workspace root (absolute) for context menu targets. */
  workspaceRoot?: string | null;
}

export function FileTree({
  tree,
  loadingPath,
  onOpenFile,
  collapseAllTrigger = 0,
  onSelectPath,
  createParentPath,
  createMode,
  createValue,
  onCreateChange,
  onCreateCommit,
  onCreateCancel,
  errorsByPath = {},
  warningsByPath = {},
  workspaceRoot,
}: FileTreeProps) {
  const handleSelect =
    onSelectPath ??
    (() => {
      // no-op if no selection handler provided
    });

  const parentPath = createParentPath ?? "";
  const createModeSafe = createMode ?? null;
  const createValueSafe = createValue ?? "";
  const handleCreateChange = onCreateChange ?? (() => {});
  const handleCreateCommit = onCreateCommit ?? (() => {});
  const handleCreateCancel = onCreateCancel ?? (() => {});

  return (
    <div key={collapseAllTrigger}>
      {createModeSafe && parentPath === "" && (
        <CreateRow
          depth={0}
          mode={createModeSafe}
          value={createValueSafe}
          onChange={handleCreateChange}
          onCommit={handleCreateCommit}
          onCancel={handleCreateCancel}
        />
      )}
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onOpenFile={onOpenFile}
          loadingPath={loadingPath}
          onSelectPath={handleSelect}
          createParentPath={parentPath}
          createMode={createModeSafe}
          createValue={createValueSafe}
          onCreateChange={handleCreateChange}
          onCreateCommit={handleCreateCommit}
          onCreateCancel={handleCreateCancel}
          errorCount={errorsByPath[node.path]}
          warningCount={warningsByPath[node.path]}
          errorsByPath={errorsByPath}
          warningsByPath={warningsByPath}
          workspaceRoot={workspaceRoot}
        />
      ))}
    </div>
  );
}
