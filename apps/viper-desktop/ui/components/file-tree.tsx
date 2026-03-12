import { useState } from "react";
import type { FileNode } from "../services/filesystem";
import { FileIcon } from "./file-icons";

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
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isDir = node.isDirectory;
  const isLoading = !isDir && loadingPath === node.path;

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
      className="w-full flex items-center gap-0 py-[2px] pl-0 pr-[var(--viper-space-1)] text-left text-[13px] text-[#e5e7eb] hover:bg-white/[0.06] rounded cursor-pointer min-h-[22px] disabled:opacity-70"
      style={{ paddingLeft: 8 + depth * INDENT + 20 }}
      onClick={() => {
        onSelectPath(node.path, false);
        onOpenFile(node.path);
      }}
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
        />
      ))}
    </div>
  );
}
